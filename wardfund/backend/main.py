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

# Tiger Data / PostgreSQL is optional so the rest of the API can still start
# if the database driver has not been installed yet.
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT.parent / ".env")

# GEMINI_MODEL can be set in the root .env file. Use the model that worked
# with this project's API key as the default if the variable is absent.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# Tiger Data connection string. DATABASE_URL is the preferred name;
# TIGER_DATA_URL is accepted as an alternative for compatibility.
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("TIGER_DATA_URL")

# SKIP_CHAIN=true skips Solana so the page can be tested safely.
SKIP_CHAIN = os.getenv("SKIP_CHAIN", "false").lower() == "true"
DEMO_SOL_PER_DOLLAR = 0.00001

# project_id -> Devnet public key, written by chain/gen-wallets.js
try:
    WALLETS = json.loads((ROOT / "chain" / "wallets.json").read_text())
except (FileNotFoundError, json.JSONDecodeError):
    WALLETS = {}

# Initialize Google Gen AI client.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = FastAPI(
    title="WardFund API",
    description="Civic funding prototype API for Toronto wards, Gemini insights, and virtual budgeting.",
    version="1.0.0",
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


# --- In-memory allocation datastore ---
# Note: these records reset when the backend process restarts.
ALLOCATIONS_DB = []

PROJECTS = [
    {
        "id": "greener-neighbourhoods",
        "name": "Greener Neighbourhoods",
        "description": "Trees, parks, and public green space.",
    },
    {
        "id": "cleaner-streets",
        "name": "Cleaner and Safer Streets",
        "description": "Waste collection, cleanup initiatives, and public-realm improvements.",
    },
    {
        "id": "community-programs",
        "name": "Youth and Community Programs",
        "description": "Recreation, community programming, and shared spaces.",
    },
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
                {"name": "Parks & Trees", "count": 320, "percentage": 22.6},
            ],
        },
        "limitation_note": "311 counts reflect reported tickets, not total community need or proactive municipal maintenance.",
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
                {"name": "Noise & Bylaw", "count": 230, "percentage": 23.5},
            ],
        },
        "limitation_note": "High seasonal park usage causes spring and summer spikes in 311 reporting.",
    },
]


class ChainError(Exception):
    pass


def send_on_chain(wallet: str, sol: float) -> dict:
    """Run send.js and return the confirmed transaction details."""
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
        raise ChainError(result.stderr.strip()[-300:] or "send.js failed")

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
        content={"error": {"code": code, "message": message}},
    )


def tiger_data_connection_is_active() -> bool:
    """Check the actual database connection, not only whether a URL is set."""
    if not DATABASE_URL or psycopg2 is None:
        return False

    connection = None
    try:
        connection = psycopg2.connect(DATABASE_URL, connect_timeout=3)
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        return False
    finally:
        if connection is not None:
            connection.close()


def demo_trend_response():
    """Demo-only trend for when the Tiger Data query has no usable results.

    The X-WardFund-Data-Source response header labels these values as demo data.
    Replace/populate the database to show real query results instead.
    """
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return JSONResponse(
        content=[{"day": month, "n": 40 + i * 12} for i, month in enumerate(months)],
        headers={"X-WardFund-Data-Source": "demo-fallback"},
    )


# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "wardfund-backend",
        "gemini_active": bool(gemini_client),
        "tiger_data_configured": bool(DATABASE_URL),
        "tiger_data_active": tiger_data_connection_is_active(),
        "chain": "skipped" if SKIP_CHAIN else "devnet",
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
        "limitation_note": ward["limitation_note"],
    }


@app.get("/api/wards/{ward_id}/trend")
def get_ward_trend_tigerdata(ward_id: str):
    """Return monthly 311 request counts from Tiger Data when available.

    Expects service_requests_311 to contain `ward_id` and `requested_at`,
    with a TimescaleDB installation that supports time_bucket().
    The response stays an array of {day, n} objects for chart compatibility.
    """
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        return make_error("NOT_FOUND", f"Ward '{ward_id}' not found.", 404)

    if not DATABASE_URL or psycopg2 is None:
        return demo_trend_response()

    connection = None
    try:
        connection = psycopg2.connect(DATABASE_URL, connect_timeout=5)
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            query = """
                SELECT
                    to_char(time_bucket('1 month', requested_at), 'Mon YYYY') AS day,
                    COUNT(*) AS n
                FROM service_requests_311
                WHERE ward_id = %s
                GROUP BY time_bucket('1 month', requested_at)
                ORDER BY time_bucket('1 month', requested_at) ASC;
            """
            cursor.execute(query, (ward_id,))
            rows = cursor.fetchall()

        if rows:
            return JSONResponse(
                content=[{"day": row["day"], "n": row["n"]} for row in rows],
                headers={"X-WardFund-Data-Source": "tiger-data"},
            )
    except Exception as exc:
        # Avoid returning database credentials/details to the browser.
        print(f"Tiger Data trend query failed; using demo fallback: {type(exc).__name__}: {exc}")
    finally:
        if connection is not None:
            connection.close()

    return demo_trend_response()


@app.post("/api/wards/{ward_id}/ask")
def ask_gemini(ward_id: str, payload: AskRequest):
    ward = next((w for w in WARDS if w["id"] == ward_id), None)
    if not ward:
        return make_error("NOT_FOUND", f"Ward '{ward_id}' not found.", 404)

    if not payload.question.strip():
        return make_error("INVALID_QUESTION", "Question cannot be empty.")

    # Pull actual totals and category counts from Tiger Data.
    connection = None
    try:
        if not DATABASE_URL or psycopg2 is None:
            raise RuntimeError("Tiger Data is not configured")

        connection = psycopg2.connect(DATABASE_URL, connect_timeout=5)
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT COUNT(*) AS total_requests
                FROM service_requests_311
                WHERE ward_id = %s
            """, (ward_id,))
            total_requests = cursor.fetchone()["total_requests"]

            cursor.execute("""
                SELECT category, COUNT(*) AS request_count
                FROM service_requests_311
                WHERE ward_id = %s
                GROUP BY category
                ORDER BY request_count DESC
                LIMIT 5
            """, (ward_id,))
            top_categories = [
                {"category": row["category"], "count": row["request_count"]}
                for row in cursor.fetchall()
            ]

        if total_requests == 0:
            raise RuntimeError("No 311 records found for this ward")

    except Exception as exc:
        print(f"Ward evidence query failed: {type(exc).__name__}: {exc}")
        return make_error(
            "WARD_DATA_UNAVAILABLE",
            "Could not retrieve current ward evidence from Tiger Data. Please try again.",
            503,
        )
    finally:
        if connection is not None:
            connection.close()

    evidence = {
        "ward_name": ward["name"],
        "total_311_requests": total_requests,
        "top_categories": top_categories,
        "limitation_note": ward["limitation_note"],
        "data_source": "Imported Toronto 311 service request dataset in Tiger Data",
    }

    if not gemini_client:
        return {
            "answer": (
                f"[Demo Fallback] {ward['name']} has {total_requests:,} recorded "
                f"311 requests in the imported dataset. Top categories: "
                + "; ".join(
                    f"{item['category']} ({item['count']:,})"
                    for item in top_categories
                )
                + ". Live AI insights are unavailable because GEMINI_API_KEY "
                  "is not configured."
            ),
            "source": evidence["data_source"],
            "ward_id": ward_id,
            "evidence": evidence,
        }

    system_instruction = (
        "You are the WardFund Civic Insight Assistant for Toronto. "
        "Use only the supplied database evidence for factual 311 claims. "
        "Do not invent statistics or claim these are all community needs. "
        "311 requests reflect resident reporting behavior, not total need "
        "or all work performed by the City. Separate measured evidence from "
        "hypothetical project ideas, and never present suggestions as official "
        "municipal plans. If the evidence cannot answer a question, say so."
    )

    prompt = f"""
DATABASE EVIDENCE (use these figures, not prior or remembered figures):
{json.dumps(evidence, indent=2)}

USER QUESTION:
{payload.question}

Answer clearly and concisely. Use the supplied evidence for statistics.
"""

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.25,
            ),
        )
        return {
            "answer": response.text,
            "source": evidence["data_source"],
            "ward_id": ward_id,
            "evidence": evidence,
        }
    except Exception as exc:
        print(f"Gemini request failed: {type(exc).__name__}: {exc}")
        return make_error(
            "GEMINI_ERROR",
            "Gemini could not generate a response. Check the backend terminal logs.",
            502,
        )

@app.get("/api/projects")
def list_projects():
    return {
        "projects": [
            {
                **project,
                "wallet": WALLETS.get(project["id"], {}).get("publicKey", ""),
            }
            for project in PROJECTS
        ]
    }


@app.post("/api/allocate")
def submit_allocation(payload: AllocationRequest):
    # 1. Validate Ward ID.
    ward = next((w for w in WARDS if w["id"] == payload.ward_id), None)
    if not ward:
        return make_error("INVALID_WARD", f"Ward '{payload.ward_id}' does not exist.")

    # 2. Validate project IDs and check for duplicates.
    valid_project_ids = {project["id"] for project in PROJECTS}
    seen_projects = set()

    for item in payload.allocations:
        if item.project_id not in valid_project_ids:
            return make_error("INVALID_PROJECT", f"Project ID '{item.project_id}' does not exist.")
        if item.project_id in seen_projects:
            return make_error("DUPLICATE_PROJECT", f"Project '{item.project_id}' was specified multiple times.")
        seen_projects.add(item.project_id)

    # 3. Enforce exactly $10,000 total allocation.
    total_amount = sum(item.amount_cad for item in payload.allocations)
    if total_amount != 10000:
        return make_error(
            "INVALID_ALLOCATION",
            f"Allocation amounts must total 10000. Received: {total_amount}",
        )

    # 4. Simulate by default, or send real Devnet transfers only when explicitly
    # requested by the client and SKIP_CHAIN is false.
    transactions = []
    for item in payload.allocations:
        if item.amount_cad == 0:
            continue

        if SKIP_CHAIN or payload.simulation:
            chain = {"signature": None, "explorer_url": None}
        else:
            wallet = WALLETS.get(item.project_id)
            if not wallet:
                return make_error(
                    "NO_WALLET",
                    f"No wallet for '{item.project_id}'. Run gen-wallets with these project ids.",
                )
            try:
                chain = send_on_chain(
                    item.project_id,
                    round(item.amount_cad * DEMO_SOL_PER_DOLLAR, 6),
                )
            except Exception as exc:
                return make_error("CHAIN_ERROR", f"Solana transfer failed: {exc}", 502)

        transactions.append(
            {"project_id": item.project_id, "amount_cad": item.amount_cad, **chain}
        )

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
        # Blockchain status is separate from saving the allocation.
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
        "receipt": record,
    }


@app.get("/api/ledger")
def get_ledger():
    return {
        "network": "Solana Devnet",
        "total_entries": len(ALLOCATIONS_DB),
        "ledger_entries": ALLOCATIONS_DB,
    }


@app.get("/api/community-preferences")
def get_community_preferences(ward_id: Optional[str] = None):
    entries = ALLOCATIONS_DB
    if ward_id:
        entries = [entry for entry in entries if entry["ward_id"] == ward_id]

    totals = {project["id"]: 0 for project in PROJECTS}
    participant_count = len(entries)

    for entry in entries:
        for item in entry["allocations"]:
            project_id = item["project_id"]
            if project_id in totals:
                totals[project_id] += item["amount_cad"]

    total_allocated = sum(totals.values())
    aggregate_results = []
    for project in PROJECTS:
        project_id = project["id"]
        amount = totals[project_id]
        percentage = (amount / total_allocated * 100) if total_allocated > 0 else 0.0
        aggregate_results.append(
            {
                "project_id": project_id,
                "name": project["name"],
                "total_allocated_cad": amount,
                "percentage_share": round(percentage, 2),
            }
        )

    return {
        "ward_filter": ward_id or "all",
        "participant_count": participant_count,
        "preferences": aggregate_results,
        "disclaimer": "Voluntary participant input. Not an official municipal vote.",
    }
