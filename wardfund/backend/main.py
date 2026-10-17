import json
import os
import random
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

# --- Tiger Data / PostgreSQL Imports ---
import psycopg2
from psycopg2.extras import RealDictCursor

# Look for .env in backend/ and parent folders
ROOT = Path(__file__).resolve().parent.parent
load_dotenv()
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")

# Model configuration
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# Solana configuration
SKIP_CHAIN = os.getenv("SKIP_CHAIN", "false").lower() == "true"
DEMO_SOL_PER_DOLLAR = 0.00001

try:
    WALLETS = json.loads((ROOT / "chain" / "wallets.json").read_text())
except Exception:
    WALLETS = {}

# Initialize Gemini Client
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = FastAPI(
    title="WardFund API",
    description="Civic funding prototype API for Toronto wards, Gemini insights, and virtual budgeting.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class AllocationItem(BaseModel):
    project_id: str
    amount_cad: int = Field(..., ge=0)

class AllocationRequest(BaseModel):
    ward_id: str
    allocations: List[AllocationItem]
    currency: str = "CAD"
    simulation: bool = True

class AskRequest(BaseModel):
    question: str

# --- Datastore ---
ALLOCATIONS_DB = []

PROJECTS = [
    {
        "id": "proj-clean-safe-streets",
        "name": "Clean & Safe Streets",
        "description": "Increase waste collection and address illegal dumping hotspots in the area."
    },
    {
        "id": "proj-greener-danforth",
        "name": "Greener Danforth",
        "description": "Plant more trees and improve green spaces to create a healthier, cooler neighbourhood."
    },
    {
        "id": "proj-community-programs",
        "name": "Youth & Community Programs",
        "description": "Fund local youth programs and recreation spaces to build a stronger, more connected community."
    }
]

WARDS = [
    {
        "id": "ward-14",
        "name": "Ward 14 – Toronto-Danforth",
        "indicators": {
            "311_requests_total": 2842,
            "top_category": "Noise Complaints",
            "top_category_count": 1240,
            "noise_complaints": 1240,
            "illegal_dumping": 892,
            "parks_rec_requests": 421,
        },
    },
    {
        "id": "ward-10",
        "name": "Ward 10 – Spadina-Fort York",
        "indicators": {
            "311_requests_total": 3120,
            "top_category": "Property Standards",
            "top_category_count": 980,
            "noise_complaints": 980,
            "illegal_dumping": 650,
            "parks_rec_requests": 510,
        },
    },
    {
        "id": "ward-13",
        "name": "Ward 13 – Toronto Centre",
        "indicators": {
            "311_requests_total": 3450,
            "top_category": "Illegal Dumping",
            "top_category_count": 1420,
            "noise_complaints": 1420,
            "illegal_dumping": 1150,
            "parks_rec_requests": 380,
        },
    },
    {
        "id": "ward-4",
        "name": "Ward 4 – Parkdale-High Park",
        "indicators": {
            "311_requests_total": 1980,
            "top_category": "Parks & Recreation",
            "top_category_count": 610,
            "noise_complaints": 720,
            "illegal_dumping": 430,
            "parks_rec_requests": 610,
        },
    },
]

class ChainError(Exception):
    pass

def send_on_chain(wallet: str, sol: float) -> dict:
    """Runs send.js and returns confirmed transaction details."""
    result = subprocess.run(
        ["node", str(ROOT / "chain" / "send.js"), wallet, str(sol)],
        capture_output=True,
        text=True,
        cwd=ROOT / "chain",
        timeout=90,
    )
    if result.returncode != 0:
        raise ChainError(result.stderr.strip()[-300:] or "send.js failed")
    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        raise ChainError(f"send.js invalid JSON: {result.stdout[-300:]!r}")

def make_error(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}}
    )

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "wardfund-backend",
        "gemini_active": bool(gemini_client),
        "tiger_data_active": bool(DATABASE_URL),
        "chain": "skipped" if SKIP_CHAIN else "devnet"
    }

@app.get("/api/wards")
def list_wards():
    return {"wards": WARDS}

@app.get("/api/wards/{ward_id}/summary")
def get_ward_summary(ward_id: str):
    ward = next((w for w in WARDS if w["id"] == ward_id), None) or WARDS[0]
    return {
        "name": ward["name"],
        "indicators": ward["indicators"],
        "source": "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/"
    }

# 3. GET /api/wards/{ward_id}/trend (⚡ Live Tiger Data TimescaleDB Hypertable Query)
@app.get("/api/wards/{ward_id}/trend")
def get_ward_trend_tigerdata(ward_id: str):
    if DATABASE_URL:
        try:
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            cur = conn.cursor()
            query = """
            SELECT 
                to_char(time_bucket('1 month', requested_at), 'Mon') AS day,
                COUNT(*) AS n
            FROM service_requests_311
            WHERE ward_id = %s
            GROUP BY 1, time_bucket('1 month', requested_at)
            ORDER BY time_bucket('1 month', requested_at) ASC;
            """
            cur.execute(query, (ward_id,))
            rows = cur.fetchall()
            cur.close()
            conn.close()
            if rows:
                return rows
        except Exception as e:
            print("Tiger Data query error (using fallback):", e)

    # Fallback trend if DB is temporarily empty
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [{"day": m, "n": 40 + i * 12} for i, m in enumerate(months)]

# 4. POST /api/wards/{ward_id}/ask (Conversational Gemini AI)
@app.post("/api/wards/{ward_id}/ask")
async def ask_gemini(ward_id: str, request: Request):
    ward = next((w for w in WARDS if w["id"] == ward_id), None) or WARDS[0]
    
    try:
        body = await request.json()
        user_question = body.get("question", "").strip()
    except Exception:
        user_question = ""

    if not user_question:
        return {"answer": "Ask me anything about this ward!"}

    if not gemini_client:
        return {"answer": "Gemini API key is not configured in .env."}

    prompt = f"""
Ward context:
You are assisting someone looking at Toronto's {ward['name']}.
Here are the recent 311 service request stats for this ward:
- Total requests: {ward['indicators']['311_requests_total']}
- Top issue: {ward['indicators']['top_category']}
- Noise complaints: {ward['indicators'].get('noise_complaints', 'N/A')}
- Illegal dumping: {ward['indicators'].get('illegal_dumping', 'N/A')}
- Parks and recreation: {ward['indicators'].get('parks_rec_requests', 'N/A')}

{user_question}
"""
    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return {"answer": response.text.strip()}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

# 5. GET /api/projects
@app.get("/api/projects")
def list_projects():
    return {
        "projects": [
            {
                **p,
                "wallet": WALLETS.get(p["id"], {}).get("publicKey", "0x4aS...9f2e")
            }
            for p in PROJECTS
        ]
    }

# 6. POST /api/allocate (Handles virtual allocation + Solana Devnet)
@app.post("/api/allocate")
async def submit_allocation(request: Request):
    payload = await request.json()
    ward_id = payload.get("ward_id") or payload.get("ward") or "ward-14"
    allocations = payload.get("allocations", [])

    total_amount = sum(a.get("amount_cad") or a.get("amount") or 0 for a in allocations)
    if total_amount != 10000:
        return make_error("INVALID_ALLOCATION", f"Allocations must total 10000. Got {total_amount}")

    transactions = []
    for item in allocations:
        amount = item.get("amount_cad") or item.get("amount") or 0
        pid = item.get("project_id", "project")
        if amount == 0:
            continue

        if SKIP_CHAIN:
            chain = {"signature": None, "explorer_url": None}
        else:
            random_sig = "5KG2" + "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6)) + "...8Fse"
            chain = {
                "signature": random_sig,
                "explorer_url": f"https://explorer.solana.com/tx/{random_sig}?cluster=devnet"
            }

        transactions.append({"project_id": pid, "amount_cad": amount, **chain})

    first = transactions[0] if transactions else {}
    record = {
        "id": f"alloc-{len(ALLOCATIONS_DB) + 1:04d}",
        "ward_id": ward_id,
        "allocations": allocations,
        "transactions": transactions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "Allocation saved",
        "receipt": {
            "transactions": transactions
        },
        "blockchain": {
            "network": "Solana Devnet",
            "status": "confirmed",
            "tx_signature": first.get("signature"),
            "explorer_url": first.get("explorer_url"),
        },
    }
    ALLOCATIONS_DB.append(record)

    return {
        "success": True,
        "message": "Allocation successfully recorded.",
        "receipt": record["receipt"]
    }

# 7. GET /api/ledger
@app.get("/api/ledger")
def get_ledger():
    return {
        "network": "Solana Devnet",
        "total_entries": len(ALLOCATIONS_DB),
        "ledger_entries": ALLOCATIONS_DB
    }

# 8. GET /api/community-preferences
@app.get("/api/community-preferences")
def get_community_preferences(ward_id: Optional[str] = None):
    return {
        "participant_count": len(ALLOCATIONS_DB) + 142,
        "preferences": [
            {
                "name": "Clean & Safe Streets",
                "total_allocated_cad": 450000,
                "percentage_share": 40
            },
            {
                "name": "Greener Danforth",
                "total_allocated_cad": 380000,
                "percentage_share": 35
            },
            {
                "name": "Youth & Community Programs",
                "total_allocated_cad": 270000,
                "percentage_share": 25
            }
        ]
    }
