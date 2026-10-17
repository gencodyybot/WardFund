import os
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="WardFund API",
    description="Civic funding prototype API for Toronto wards, Gemini insights, and virtual budgeting.",
    version="1.0.0"
)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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

# --- In-Memory State (Prototype Datastore) ---
ALLOCATIONS_DB = []

PROJECTS = [
    {"id": "greener-neighbourhoods", "name": "Greener Neighbourhoods", "description": "Trees, parks, and public green space."},
    {"id": "cleaner-streets", "name": "Cleaner and Safer Streets", "description": "Waste collection, cleanup initiatives, and public-realm improvements."},
    {"id": "community-programs", "name": "Youth and Community Programs", "description": "Recreation, community programming, and shared spaces."}
]

WARDS = [
    {"id": "ward-14", "name": "Toronto-Danforth (Ward 14)", "indicators": {"311_requests_total": 1420, "top_category": "Waste Overflow"}},
    {"id": "ward-4", "name": "Parkdale-High Park (Ward 4)", "indicators": {"311_requests_total": 980, "top_category": "Road Maintenance"}}
]

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "wardfund-backend"}

@app.get("/api/wards")
def list_wards():
    return {"wards": WARDS}

@app.get("/api/wards/{ward_id}/summary")
def get_ward_summary(ward_id: str):
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    return {
        "ward_id": ward["id"],
        "name": ward["name"],
        "indicators": ward["indicators"],
        "data_range": "2025-01-01 to 2026-10-01",
        "source": "Toronto Open Data - 311 Service Requests"
    }

@app.post("/api/wards/{ward_id}/ask")
def ask_gemini(ward_id: str, payload: AskRequest):
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    
    if not GEMINI_API_KEY:
        return {
            "answer": f"[Mock AI response] Based on 311 data for {ward['name']}, the leading issue is {ward['indicators']['top_category']}. (Gemini API key not configured)."
        }

    try:
        model = genai.GenerativeModel("gemini-pro")
        prompt = (
            f"You are a helpful civic assistant for Toronto. "
            f"Ward data for {ward['name']}: {ward['indicators']}. "
            f"User question: {payload.question}"
        )
        response = model.generate_content(prompt)
        return {"answer": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@app.get("/api/projects")
def list_projects():
    return {"projects": PROJECTS}

@app.post("/api/allocate")
def submit_allocation(payload: AllocationRequest):
    valid_project_ids = {p["id"] for p in PROJECTS}
    for item in payload.allocations:
        if item.project_id not in valid_project_ids:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "INVALID_PROJECT", "message": f"Project ID '{item.project_id}' does not exist."}}
            )

    # Enforce README rule: Allocation amounts must total exactly 10,000
    total_amount = sum(item.amount_cad for item in payload.allocations)
    if total_amount != 10000:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_ALLOCATION", "message": f"Allocation amounts must total 10000. Received total: {total_amount}"}}
        )

    record = {
        "ward_id": payload.ward_id,
        "allocations": [item.dict() for item in payload.allocations],
        "currency": payload.currency,
        "simulation": payload.simulation,
        "status": "Allocation saved"
    }
    ALLOCATIONS_DB.append(record)

    return {
        "success": True,
        "message": "Allocation successfully recorded.",
        "receipt": record
    }

@app.get("/api/ledger")
def get_ledger():
    return {"ledger_entries": ALLOCATIONS_DB}

@app.get("/api/community-preferences")
def get_community_preferences():
    totals = {p["id"]: 0 for p in PROJECTS}
    participant_count = len(ALLOCATIONS_DB)

    for entry in ALLOCATIONS_DB:
        for item in entry["allocations"]:
            pid = item["project_id"]
            if pid in totals:
                totals[pid] += item["amount_cad"]

    aggregate_results = []
    for p in PROJECTS:
        pid = p["id"]
        amount = totals[pid]
        # Calculate percentage share across total simulated funds ($10,000 per submission)
        max_possible_funds = participant_count * 10000
        percentage = (amount / max_possible_funds * 100) if max_possible_funds > 0 else 0.0
        aggregate_results.append({
            "project_id": pid,
            "name": p["name"],
            "total_allocated_cad": amount,
            "percentage_share": round(percentage, 2)
        })

    return {
        "participant_count": participant_count,
        "preferences": aggregate_results
    }