import json
import os
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

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT.parent / ".env")

# Run once to list valid names: for m in genai.Client().models.list(): print(m.name)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# SKIP_CHAIN=true skips Solana so the page can be tested before wallets exist.
SKIP_CHAIN = os.getenv("SKIP_CHAIN", "false").lower() == "true"
DEMO_SOL_PER_DOLLAR = 0.00001

# project_id -> devnet public key, written by chain/gen-wallets.js
try:
    WALLETS = json.loads((ROOT / "chain" / "wallets.json").read_text())
except FileNotFoundError:
    WALLETS = {}

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

# Initialize Google Gen AI client with modern SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

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
    {"id": "greener-neighbourhoods", "name": "Greener Neighbourhoods", "description": "Trees, parks, and public green space."},
    {"id": "cleaner-streets", "name": "Cleaner and Safer Streets", "description": "Waste collection, cleanup initiatives, and public-realm improvements."},
    {"id": "community-programs", "name": "Youth and Community Programs", "description": "Recreation, community programming, and shared spaces."}
]

WARDS = [
    {
        "id": "ward-14",
        "name": "Toronto-Danforth (Ward 14)",
        "indicators": {
            "311_requests_total": 1420,
            "top_category": "Waste Overflow",
            "categories": [
                {"name": "Waste Overflow", "count": 620, "percentage": 43.6},
                {"name": "Road & Pothole Repair", "count": 480, "percentage": 33.8},
                {"name": "Parks & Trees", "count": 320, "percentage": 22.6}
            ]
        },
        "limitation_note": "311 counts reflect reported tickets, not total community need or proactive municipal maintenance."
    },
    {
        "id": "ward-4",
        "name": "Parkdale-High Park (Ward 4)",
        "indicators": {
            "311_requests_total": 980,
            "top_category": "Road Maintenance",
            "categories": [
                {"name": "Road Maintenance", "count": 410, "percentage": 41.8},
                {"name": "Park Upkeep", "count": 340, "percentage": 34.7},
                {"name": "Noise & Bylaw", "count": 230, "percentage": 23.5}
            ]
        },
        "limitation_note": "High seasonal park usage causes spring and summer spikes in 311 reporting."
    }
]

class ChainError(Exception):
    pass



def send_on_chain(wallet: str, sol: float) -> dict:
    """Runs send.js and returns the confirmed transaction details."""
    result = subprocess.run(
        [
            "node",
            str(ROOT / "chain" / "send.js"),
            wallet,
            str(sol),
        ],
        capture_output=True,
        text=True,
        cwd=ROOT / "chain",
        timeout=90,
    )

    if result.returncode != 0:
        raise ChainError(
            result.stderr.strip()[-300:] or "send.js failed"
        )

    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        raise ChainError(
            f"send.js returned invalid JSON. "
            f"stdout={result.stdout[-500:]!r}; "
            f"stderr={result.stderr[-500:]!r}"
        )

def make_error(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}}
    )

# --- Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "wardfund-backend",
        "gemini_active": bool(gemini_client),
        "chain": "skipped" if SKIP_CHAIN else "devnet"
    }

@app.get("/api/wards")
def list_wards():
    return {"wards": WARDS}

@app.get("/api/wards/{ward_id}/summary")
def get_ward_summary(ward_id: str):
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        return make_error("NOT_FOUND", f"Ward '{ward_id}' not found.", 404)
    return {
        "ward_id": ward["id"],
        "name": ward["name"],
        "indicators": ward["indicators"],
        "data_range": "2025-01-01 to 2026-10-01",
        "source": "Toronto Open Data - 311 Service Requests",
        "limitation_note": ward["limitation_note"]
    }

@app.post("/api/wards/{ward_id}/ask")
def ask_gemini(ward_id: str, payload: AskRequest):
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        return make_error("NOT_FOUND", f"Ward '{ward_id}' not found.", 404)

    if not payload.question.strip():
        return make_error("INVALID_QUESTION", "Question cannot be empty.")

    if not gemini_client:
        return {
            "answer": (
                f"[Demo Fallback] In {ward['name']}, the leading 311 category is "
                f"{ward['indicators']['top_category']}. (Configure GEMINI_API_KEY for live AI insights)."
            ),
            "source": "Toronto Open Data - 311 Service Requests"
        }

    # WardFund system instruction enforcing evidence grounding and limitations
    system_instruction = (
        "You are the WardFund Civic Insight Assistant for Toronto.\n"
        "RULES:\n"
        "1. Strictly ground factual claims in the provided ward 311 data context.\n"
        "2. Clearly separate empirical 311 evidence from hypothetical community project ideas.\n"
        "3. Explicitly state data limitations: 311 records reflect citizen reporting behavior, not total community need.\n"
        "4. If the provided data cannot answer a question, state so honestly instead of guessing.\n"
        "5. Label all community project suggestions as possibilities, not official municipal plans."
    )

    prompt = f"""
WARD EVIDENCE:
- Ward Name: {ward['name']}
- 311 Indicators: {ward['indicators']}
- Limitations Note: {ward['limitation_note']}

USER QUESTION:
"{payload.question}"

Provide a grounded explanation distinguishing evidence from suggestions:
"""

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.25,
            )
        )
        return {
            "answer": response.text,
            "source": "Toronto Open Data - 311 Service Requests",
            "ward_id": ward_id
        }
    except Exception as e:
        return make_error("GEMINI_ERROR", str(e), 500)

@app.get("/api/projects")
def list_projects():
    return {
        "projects": [
            {
                **p,
                "wallet": WALLETS.get(p["id"], {}).get("publicKey", "")
            }
            for p in PROJECTS
        ]
    }

@app.post("/api/allocate")
def submit_allocation(payload: AllocationRequest):
    # 1. Validate Ward ID
    ward = next((w for w in WARDS if w["id"] == payload.ward_id), None)
    if not ward:
        return make_error("INVALID_WARD", f"Ward '{payload.ward_id}' does not exist.")

    # 2. Validate Project IDs and check for duplicates
    valid_project_ids = {p["id"] for p in PROJECTS}
    seen_projects = set()

    for item in payload.allocations:
        if item.project_id not in valid_project_ids:
            return make_error("INVALID_PROJECT", f"Project ID '{item.project_id}' does not exist.")
        if item.project_id in seen_projects:
            return make_error("DUPLICATE_PROJECT", f"Project '{item.project_id}' was specified multiple times.")
        seen_projects.add(item.project_id)

    # 3. Enforce exactly $10,000 total allocation
    total_amount = sum(item.amount_cad for item in payload.allocations)
    if total_amount != 10000:
        return make_error("INVALID_ALLOCATION", f"Allocation amounts must total 10000. Received: {total_amount}")

    # 4. Send one Solana devnet transfer per funded project
    transactions = []
    for item in payload.allocations:
        if item.amount_cad == 0:
            continue
        
        if SKIP_CHAIN or payload.simulation:
            chain = {
                "signature": None,
                "explorer_url": None
            }
        else:
            wallet = WALLETS.get(item.project_id)
            if not wallet:
                return make_error(
                    "NO_WALLET",
                    f"No wallet for '{item.project_id}'. Run gen-wallets with these project ids."
                )
            try:
                chain = send_on_chain(
                    item.project_id,
                    round(item.amount_cad * DEMO_SOL_PER_DOLLAR, 6)
                )
            except Exception as e:
                return make_error("CHAIN_ERROR", f"Solana transfer failed: {e}", 502)

        transactions.append({"project_id": item.project_id, "amount_cad": item.amount_cad, **chain})

    first = transactions[0] if transactions else {}
    record = {
        "id": f"alloc-{len(ALLOCATIONS_DB) + 1:04d}",
        "ward_id": payload.ward_id,
        "allocations": [item.model_dump() for item in payload.allocations],
        "transactions": transactions,
        "currency": payload.currency,
        "simulation": payload.simulation,
        "status": "Allocation saved",
        "created_at": datetime.now(timezone.utc).isoformat(),
        # Blockchain status stays separate from the save (as required by README)
        "blockchain": {
            "network": "Solana Devnet",
            "status": (
            "simulated" if payload.simulation
            else "skipped" if SKIP_CHAIN
            else "confirmed"
            ),
            "tx_signature": first.get("signature"),
            "explorer_url": first.get("explorer_url"),
        },
    }
    ALLOCATIONS_DB.append(record)

    return {
        "success": True,
        "message": "Allocation successfully recorded.",
        "receipt": record
    }

@app.get("/api/ledger")
def get_ledger():
    return {
        "network": "Solana Devnet",
        "total_entries": len(ALLOCATIONS_DB),
        "ledger_entries": ALLOCATIONS_DB
    }

@app.get("/api/community-preferences")
def get_community_preferences(ward_id: Optional[str] = None):
    entries = ALLOCATIONS_DB
    if ward_id:
        entries = [e for e in entries if e["ward_id"] == ward_id]

    totals = {p["id"]: 0 for p in PROJECTS}
    participant_count = len(entries)

    for entry in entries:
        for item in entry["allocations"]:
            pid = item["project_id"]
            if pid in totals:
                totals[pid] += item["amount_cad"]

    total_allocated = sum(totals.values())

    aggregate_results = []
    for p in PROJECTS:
        pid = p["id"]
        amount = totals[pid]
        percentage = (amount / total_allocated * 100) if total_allocated > 0 else 0.0
        aggregate_results.append({
            "project_id": pid,
            "name": p["name"],
            "total_allocated_cad": amount,
            "percentage_share": round(percentage, 2)
        })

    return {
        "ward_filter": ward_id or "all",
        "participant_count": participant_count,
        "preferences": aggregate_results,
        "disclaimer": "Voluntary participant input. Not an official municipal vote."
    }
