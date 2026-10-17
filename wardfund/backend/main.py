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

# Initialize Google Gen AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# --- Dataset matching script.js expectations ---

WARDS = [
    {
        "id": "ward-14",
        "name": "Ward 14 – Toronto-Danforth",
        "requests_30d": 2842,
        "top_category": "Noise Complaints & Waste",
        "trend": "↑ 15% (vs. last 6 months)",
        "lat": 43.6800,
        "lon": -79.3300,
    },
    {
        "id": "ward-10",
        "name": "Ward 10 – Spadina-Fort York",
        "requests_30d": 3120,
        "top_category": "Property Standards & Litter",
        "trend": "↑ 9% (vs. last 6 months)",
        "lat": 43.6426,
        "lon": -79.4000,
    },
    {
        "id": "ward-13",
        "name": "Ward 13 – Toronto Centre",
        "requests_30d": 3450,
        "top_category": "Illegal Dumping & Waste",
        "trend": "↑ 22% (vs. last 6 months)",
        "lat": 43.6580,
        "lon": -79.3750,
    },
    {
        "id": "ward-4",
        "name": "Ward 4 – Parkdale-High Park",
        "requests_30d": 1980,
        "top_category": "Parks & Road Maintenance",
        "trend": "↑ 7% (vs. last 6 months)",
        "lat": 43.6500,
        "lon": -79.4700,
    },
]

PROJECTS = [
    {
        "id": "p-greener-danforth",
        "name": "Greener Neighbourhoods & Canopy",
        "cost": 3500,
        "impact": "🌱 Lower temps, 🌱 Better air quality",
        "wallet": "0x4aS...9f2e",
        "description": "Plant more trees and improve green spaces to create a healthier, cooler neighbourhood.",
        "image": "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&auto=format&fit=crop&q=80",
    },
    {
        "id": "p-clean-safe-streets",
        "name": "Clean & Safe Streets",
        "cost": 4000,
        "impact": "🛡️ Cleaner streets, 🛡️ Safer community",
        "wallet": "0x8b7...1f04",
        "description": "Increase waste collection and address illegal dumping hotspots in the area.",
        "image": "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=200&auto=format&fit=crop&q=80",
    },
    {
        "id": "p-community-programs",
        "name": "Youth & Community Programs",
        "cost": 2500,
        "impact": "👥 Youth engagement, 👥 Stronger community",
        "wallet": "0x2e6...7a8b",
        "description": "Fund local youth programs and recreation spaces to build a stronger, more connected community.",
        "image": "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=200&auto=format&fit=crop&q=80",
    },
]

LEDGER = [
    {
        "ward": "Ward 14",
        "project_id": "p-clean-safe-streets",
        "amount": 4000,
        "signature": "5KG2...8Fse",
        "explorer_url": "https://explorer.solana.com/tx/5KG2uFse?cluster=devnet",
        "created_at": "Just now",
    },
    {
        "ward": "Ward 14",
        "project_id": "p-greener-danforth",
        "amount": 3500,
        "signature": "3PL8...2Km9",
        "explorer_url": "https://explorer.solana.com/tx/3PL82Km9?cluster=devnet",
        "created_at": "2 hours ago",
    },
]

# --- API Endpoints ---

@app.get("/api/health")
def health():
    return {"status": "ok", "gemini_active": bool(gemini_client)}

# 1. GET /api/wards -> Returns raw list for script.js
@app.get("/api/wards")
def get_wards():
    return WARDS

# 2. GET /api/wards/{id}/summary -> Generates Gemini evidence summary
@app.get("/api/wards/{ward_id}/summary")
def get_ward_summary(ward_id: str):
    ward = next((w for w in WARDS if w["id"] == ward_id), None) or WARDS[0]

    # Generate live summary with Gemini if API key is present
    if gemini_client:
        try:
            prompt = (
                f"You are the WardFund Civic Insight Assistant. "
                f"Ward: {ward['name']}. Total 30-day requests: {ward['requests_30d']}. "
                f"Leading category: {ward['top_category']}. Trend: {ward['trend']}. "
                f"Write a concise 3-paragraph civic summary:\n"
                f"1. What the data shows.\n"
                f"2. Data limitations (311 tracks reports, not total need).\n"
                f"3. Three potential community projects to address it."
            )
            response = gemini_client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt
            )
            return {
                "summary": response.text,
                "sources": ["https://open.toronto.ca/dataset/311-service-requests-customer-initiated/"]
            }
        except Exception as e:
            print("Gemini error:", e)

    # Fallback summary
    return {
        "summary": (
            f"Based on 311 data, {ward['name']} has logged {ward['requests_30d']:,} service requests "
            f"over the past month, with '{ward['top_category']}' as the leading issue ({ward['trend']}).\n\n"
            f"Data Limitation: 311 calls reflect reporting frequency, not total neighbourhood need."
        ),
        "sources": ["https://open.toronto.ca/dataset/311-service-requests-customer-initiated/"]
    }

# 3. GET /api/wards/{id}/trend -> Returns monthly trend array for Chart.js
@app.get("/api/wards/{ward_id}/trend")
def get_ward_trend(ward_id: str):
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    base_val = 50
    trend_data = []
    for m in months:
        base_val += random.randint(5, 15)
        trend_data.append({"day": m, "n": base_val})
    return trend_data

# 4. GET /api/projects -> Returns projects array for cards
@app.get("/api/projects")
def get_projects(ward: Optional[str] = None):
    return PROJECTS

# 5. POST /api/allocate -> Allocates virtual budget and returns simulated Solana Devnet receipt
@app.post("/api/allocate")
async def allocate(request: Request):
    payload = await request.json()
    ward = payload.get("ward") or payload.get("ward_id") or "Ward 14"
    allocations = payload.get("allocations", [])

    random_sig = "5KG2" + "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6)) + "...8Fse"
    explorer_url = f"https://explorer.solana.com/tx/{random_sig}?cluster=devnet"

    txs = []
    for a in allocations:
        amt = a.get("amount", 0)
        pid = a.get("project_id", "project")
        tx_item = {
            "project_id": pid,
            "amount": amt,
            "signature": random_sig,
            "explorer_url": explorer_url
        }
        txs.append(tx_item)
        LEDGER.insert(0, {
            "ward": ward,
            "project_id": pid,
            "amount": amt,
            "signature": random_sig[:8] + "...",
            "explorer_url": explorer_url,
            "created_at": "Just now"
        })

    return {"txs": txs}

# 6. GET /api/ledger -> Returns recent ledger records
@app.get("/api/ledger")
def get_ledger():
    return LEDGER