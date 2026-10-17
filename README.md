# WardFund

WardFund is a civic-funding hackathon prototype for Toronto. It combines Toronto 311 service-request data, AI-generated ward insights, a simulated CAD $10,000 project-allocation flow, and an optional Solana Devnet integration.

> WardFund is a prototype, not an official City of Toronto service or municipal voting system. Simulated allocations do not transfer money.

## Features

- Ward dashboards for Toronto-Danforth (Ward 14) and Parkdale-High Park (Ward 4)
- Monthly 311 trends and database-backed category evidence using Tiger Data/PostgreSQL
- Gemini-powered answers to ward questions
- $10,000 CAD allocation across three projects
- Allocation ledger and project preference summaries
- Optional Solana Devnet transactions

## Project structure

```text
wardfund/
├── assets/
│   ├── mockup.png
│   └── mockup2.jpg
├── backend/
│   ├── __pycache__/          # Generated Python cache
│   ├── data/
│   │   └── SR2026.csv
│   ├── scripts/
│   │   └── load_311.py
│   ├── main.py               # FastAPI app
│   ├── requirements.txt
│   └── schema.sql
├── chain/
│   ├── node_modules/         # Installed npm dependencies
│   ├── gen-wallets.js
│   ├── package-lock.json
│   ├── package.json
│   ├── send.js
│   ├── sender-wallet.json    # Sensitive: never commit or share
│   └── wallets.json          # Project wallet mapping
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── .env                      # Local configuration; never commit
├── .env.example
├── .gitignore
└── README.md
```

`__pycache__/` and `node_modules/` are generated directories and usually should not be committed. Keep private wallet material and credentials out of version control.

## Requirements

- Python 3.10+
- Node.js and npm (for Solana transaction support)
- Tiger Data/PostgreSQL connection (for live 311 evidence and trends)
- Gemini API key (for live AI answers)

## Configure

Copy `.env.example` to `.env` in the project root and fill in your own values:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
DATABASE_URL=your_tiger_data_postgresql_url
SKIP_CHAIN=true
```

Use a Gemini model available to your API key. `DATABASE_URL` should be your Tiger Data/PostgreSQL connection string. Keep `SKIP_CHAIN=true` while developing and keep allocation requests set to `"simulation": true`.

**Environment-file path:** confirm `load_dotenv(...)` in `backend/main.py` points to the `.env` location you use. If it uses `ROOT.parent / ".env"`, it expects the file one directory above `wardfund/`; use `ROOT / ".env"` if the file is inside `wardfund/` as shown above.

## Run locally

Start the backend in one terminal:

```bash
cd /path/to/wardfund/backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```bash
cd /path/to/wardfund/frontend
python3 -m http.server 5500
```

Open <http://localhost:5500/index.html>. API health: <http://127.0.0.1:8000/api/health>. Interactive API docs: <http://127.0.0.1:8000/docs>.

## Tiger Data setup

1. Apply `backend/schema.sql` to your Tiger Data/PostgreSQL database.
2. Ensure `backend/data/SR2026.csv` is present.
3. From `backend/`, run `python3 scripts/load_311.py` if the dataset has not already been imported. Check the script before re-running it to avoid duplicate imports.
4. Test the ward trend and Ask endpoints. For AI responses, check the returned `evidence` object and compare counts with the database.

## Main API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service and configuration status |
| `GET` | `/api/wards` | List supported wards |
| `GET` | `/api/wards/{ward_id}/summary` | Ward summary metadata |
| `GET` | `/api/wards/{ward_id}/trend` | Monthly 311 trends |
| `POST` | `/api/wards/{ward_id}/ask` | Ask a ward-related question |
| `GET` | `/api/projects` | List project categories and public wallet addresses |
| `POST` | `/api/allocate` | Record a project allocation |
| `GET` | `/api/ledger` | View allocation receipts |
| `GET` | `/api/community-preferences?ward_id=ward-14` | View a ward's allocation preference totals |

Supported ward IDs: `ward-14` and `ward-4`.

## Test a simulated allocation

Use `POST /api/allocate` in `/docs` with this example:

```json
{
  "ward_id": "ward-14",
  "allocations": [
    {"project_id": "greener-neighbourhoods", "amount_cad": 4000},
    {"project_id": "cleaner-streets", "amount_cad": 3500},
    {"project_id": "community-programs", "amount_cad": 2500}
  ],
  "currency": "CAD",
  "simulation": true
}
```

The amounts must total exactly CAD $10,000. Then check `GET /api/ledger` and `GET /api/community-preferences?ward_id=ward-14`. In simulation mode, no blockchain transaction is submitted and signatures remain `null`.

## Solana Devnet safety

A request with `"simulation": false` may trigger real transactions on Solana Devnet when `SKIP_CHAIN=false`. Before testing, inspect `chain/send.js`, verify the sender and recipient wallets, confirm the sender has only test SOL, and understand the fixed CAD-to-SOL multiplier in `backend/main.py`. Devnet transactions are real transactions on the test network even though Devnet SOL has no intended real-world value. Do not test with mainnet funds or expose private keys.

## Known limitations

- Allocation receipts and preference totals are currently stored in backend memory and reset when the backend restarts; they are not yet persisted to the SQL `allocations` table.
- Ward summary indicators may include demo/placeholder values. Use the database-backed trend and Ask evidence for imported 311 counts.
- 311 requests measure reported service needs, not every resident need or all work done by the City.
- Preference results summarize recorded allocations; they are not an official vote or a verified count of unique residents.
- CAD-to-SOL conversion is a fixed demo multiplier, not a live exchange rate.

---

Built as a hackathon prototype exploring data-informed, transparent community project allocation.
