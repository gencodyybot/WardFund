import os
import random
from typing import List, Optional, Any
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI(title="WardFund API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Google Gen AI with GEMINI_API_KEY from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# --- Datastore matching script.js DEMO_DATA exactly ---

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

PROJECTS = [
    {
        "id": "proj-clean-safe-streets",
        "name": "Clean & Safe Streets",
        "description": "Increase waste collection and address illegal dumping hotspots in the area.",
        "wallet": "0x8b7...1f04",
    },
    {
        "id": "proj-greener-danforth",
        "name": "Greener Danforth",
        "description": "Plant more trees and improve green spaces to create a healthier, cooler neighbourhood.",
        "wallet": "0x4aS...9f2e",
    },
    {
        "id": "proj-community-programs",
        "name": "Community Programs",
        "description": "Fund local youth programs and recreation spaces to build a stronger, more connected community.",
        "wallet": "0x2e6...7a8b",
    },
]

LEDGER_ENTRIES = [
    {
        "ward_id": "ward-14",
        "created_at": "Just now",
        "transactions": [
            {
                "project_id": "proj-clean-safe-streets",
                "amount_cad": 4000,
                "signature": "5KG2...8Fse",
                "explorer_url": "https://explorer.solana.com/tx/5KG2uFse?cluster=devnet",
            },
            {
                "project_id": "proj-greener-danforth",
                "amount_cad": 3500,
                "signature": "3PL8...2Km9",
                "explorer_url": "https://explorer.solana.com/tx/3PL82Km9?cluster=devnet",
            },
            {
                "project_id": "proj-community-programs",
                "amount_cad": 2500,
                "signature": "7RQ1...9Vp2",
                "explorer_url": "https://explorer.solana.com/tx/7RQ19Vp2?cluster=devnet",
            },
        ],
    }
]

# --- API Endpoints ---

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "chain": "devnet",
        "gemini_active": bool(gemini_client)
    }

# 1. GET /api/wards
@app.get("/api/wards")
def get_wards():
    return {"wards": WARDS}

# 2. GET /api/wards/{ward_id}/summary
@app.get("/api/wards/{ward_id}/summary")
def get_ward_summary(ward_id: str):
    ward = next((w for w in WARDS if w["id"] == ward_id), None) or WARDS[0]
    return {
        "name": ward["name"],
        "indicators": ward["indicators"],
        "source": "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/"
    }

# 3. POST /api/wards/{ward_id}/ask (Fixed 404!)
# 3. POST /api/wards/{ward_id}/ask (Natural conversational Gemini)
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
        return {"answer": "Gemini API key is not configured."}

    # Simple, natural context just like chatting on gemini.google.com
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
        # Standard conversational model call with default freedom
        response = gemini_client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
        )
        return {"answer": response.text.strip()}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

# 4. GET /api/projects
@app.get("/api/projects")
def get_projects():
    return {"projects": PROJECTS}

# 5. POST /api/allocate
@app.post("/api/allocate")
async def allocate(request: Request):
    payload = await request.json()
    ward_id = payload.get("ward_id") or payload.get("ward") or "ward-14"
    allocations = payload.get("allocations", [])

    random_sig = "5KG2" + "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6)) + "...8Fse"
    explorer_url = f"https://explorer.solana.com/tx/{random_sig}?cluster=devnet"

    txs = []
    for a in allocations:
        amt = a.get("amount_cad") or a.get("amount") or 0
        pid = a.get("project_id", "project")
        txs.append({
            "project_id": pid,
            "amount_cad": amt,
            "signature": random_sig,
            "explorer_url": explorer_url
        })

    # Save to in-memory ledger
    LEDGER_ENTRIES.insert(0, {
        "ward_id": ward_id,
        "created_at": "Just now",
        "transactions": txs
    })

    return {
        "receipt": {
            "transactions": txs
        }
    }

# 6. GET /api/community-preferences
@app.get("/api/community-preferences")
def get_community_preferences():
    return {
        "participant_count": len(LEDGER_ENTRIES) + 140,
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
                "name": "Community Programs",
                "total_allocated_cad": 270000,
                "percentage_share": 25
            }
        ]
    }

# 7. GET /api/ledger
@app.get("/api/ledger")
def get_ledger():
    return {"ledger_entries": LEDGER_ENTRIES}