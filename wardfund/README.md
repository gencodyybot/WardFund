# WardFund — Civic Funding, Powered by Community Insight

> **Understand local needs. Explore solutions. Show what communities want prioritized.**

WardFund is a civic-tech prototype that helps Toronto residents explore neighbourhood issues, ask questions about local data, and express their funding priorities through a virtual **$10,000 community budget**. It combines Toronto 311 service-request data, Gemini-powered explanations, a public-preference dashboard, and a Solana Devnet ledger for transparent demonstration transactions.

**Important:** WardFund is a prototype for civic education and public input. Its virtual allocations do **not** move real tax dollars, constitute a binding vote, or determine a government's budget. Government officials could consider aggregated results as one additional input alongside public consultation, evidence, legal requirements, equity considerations, and budget constraints.

---

## Contents

- [The problem](#the-problem)
- [Our solution](#our-solution)
- [How it works](#how-it-works)
- [Core features](#core-features)
- [Example user journey](#example-user-journey)
- [Data, AI, and trust](#data-ai-and-trust)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Environment variables](#environment-variables)
- [Getting started](#getting-started)
- [Running the application](#running-the-application)
- [Loading Toronto 311 data](#loading-toronto-311-data)
- [Solana Devnet and the demo ledger](#solana-devnet-and-the-demo-ledger)
- [Testing and verification](#testing-and-verification)
- [Security and responsible use](#security-and-responsible-use)
- [Limitations and future work](#limitations-and-future-work)
- [Hackathon prize-track fit](#hackathon-prize-track-fit)
- [Team responsibilities](#team-responsibilities)
- [Demo script](#demo-script)
- [License](#license)

---

## The problem

Residents often have difficulty finding understandable, neighbourhood-level information about local issues and understanding the options available to address them. Public datasets can be difficult to interpret, while consultations do not always give residents a clear way to compare priorities.

WardFund aims to make local information easier to explore and public preferences easier to communicate.

## Our solution

WardFund brings four things into one interface:

1. **Local evidence:** explore Toronto 311 service-request trends by ward and category.
2. **AI explanations:** ask questions about the available evidence and learn about possible responses.
3. **A virtual community budget:** distribute a fictional $10,000 across proposed community projects.
4. **A transparent demo ledger:** record test-token transactions on Solana Devnet and link to the relevant explorer records.

WardFund aggregates virtual allocations into a community-preference view. This can help users understand the priorities expressed by participants. It is not a representative poll unless the project later adds a suitable sampling and verification method.

## How it works

1. A user chooses a Toronto ward.
2. WardFund displays available 311 indicators, trends, and data coverage.
3. The user asks Gemini a question or reads an AI-generated evidence summary.
4. The user divides a virtual $10,000 budget among project ideas.
5. The frontend submits the allocation to the backend.
6. The backend validates the amounts, records the allocation, and asks the chain service to perform the configured Devnet demonstration transaction.
7. The UI displays the allocation receipt and transaction status when available.
8. Aggregated allocations update the community-preference dashboard.

The prototype must clearly distinguish **virtual preferences**, **test-token transfers**, and **actual public spending**.

## Core features

### 1. Ward explorer

- Select a ward and inspect the data currently available for it.
- Show counts and trends for selected 311 request categories.
- Provide chart labels, date ranges, and data-source links.
- Explain that a 311 request is not a complete measure of community need: reporting rates, population, service definitions, and data quality can differ.

### 2. Gemini AI insights

- Summarize relevant supplied data in plain language.
- Answer user questions about the selected ward and indicators.
- Suggest possible community responses while distinguishing evidence from suggestions.
- Link factual claims to the underlying data sources when possible.
- If the available data cannot answer a question, say so instead of inventing facts.

**AI rule:** Gemini should use the context and data provided by the backend, avoid unsupported claims, and clearly label recommendations as possibilities rather than official advice or government commitments.

### 3. $10,000 funding simulator

- Give each user a fictional $10,000 budget for the simulation.
- Allow users to distribute it among available project ideas using sliders or numeric inputs.
- Keep the total at exactly $10,000 before submission, or clearly show any unallocated amount if partial allocation is allowed.
- Display each project's share and the combined preferences of participants.
- Explain that these are expressions of preference, not real tax payments or binding budget decisions.

Example projects:

- **Greener Neighbourhoods:** trees, parks, and public green space.
- **Cleaner and Safer Streets:** waste collection, cleanup initiatives, and related public-realm improvements.
- **Youth and Community Programs:** recreation, community programming, and shared spaces.

These are illustrative project ideas, not approved or costed municipal proposals. Avoid implying that a proposed project is feasible without checking its cost, jurisdiction, and evidence.

### 4. Community preference dashboard

- Aggregate valid virtual allocations by project and, where appropriate, by ward.
- Show totals, percentage shares, and the number of participating submissions.
- Explain how results are calculated and when they were last updated.
- Avoid presenting voluntary platform participation as representative of all residents.
- Do not imply that the city has accepted or acted on the results.

### 5. Solana Devnet ledger

- Demonstrate an actual supported Devnet transaction, such as a transfer of Devnet SOL or a test-token transfer.
- Show the transaction signature and a Solana Explorer link configured for Devnet.
- Keep private keys and seed phrases out of source control and the frontend.
- Label all balances and transfers as test-network activity with no real monetary value.
- Do not claim a project allocation was executed on-chain unless the transaction was submitted and confirmed successfully.

For the hackathon demo, a simple Devnet transfer is preferable to building a custom smart contract unless the contract provides a clear, implemented benefit.

### 6. Data time series with Tiger Data

If integrated, Tiger Data (TimescaleDB) can store timestamped observations and support time-series queries and aggregates for trends. The dashboard should only claim Tiger Data integration once the application genuinely writes and reads the relevant data through it.

---

## Example user journey

1. Open WardFund and select a ward.
2. Review the ward's available 311 indicators and trend chart.
3. Ask Gemini: “What does this trend show, and what can it not tell us?”
4. Compare a few project ideas and their intended outcomes.
5. Allocate the virtual $10,000.
6. Review the resulting allocation percentages and submit.
7. View the ledger receipt and, if the chain operation succeeded, open the Devnet transaction in Solana Explorer.
8. Compare the submission with aggregated community preferences.

## Data, AI, and trust

### Toronto 311 data

The initial data source is Toronto's publicly available 311 service-request data or another suitable Toronto Open Data dataset. The exact dataset, fields, update cadence, and applicable licence must be confirmed during implementation.

- Preserve source attribution and link to the source dataset.
- Document the date range and the meaning of the selected fields.
- Handle missing values and duplicate records explicitly.
- Do not assume that more complaints always mean a problem is objectively worse.
- Do not infer a resident's identity or sensitive characteristics from service-request records.
- Never fabricate real ward statistics for the final demo. Seeded mock data must be labelled as mock data.

### Gemini

- Send only the minimum data needed to answer a question.
- Treat user input and retrieved data as untrusted content, not instructions that can override system rules.
- Do not expose API keys, internal prompts, database credentials, or private user data.
- Show source links or explain the basis for generated claims.
- Make uncertainty and data limitations visible.
- Do not present generated suggestions as official city plans, verified costs, or guaranteed outcomes.

### Community preference results

- State how allocations are aggregated.
- Consider rate limits or basic abuse prevention before accepting public submissions.
- Avoid collecting personal information unless it is necessary.
- If accounts are not implemented, explain that submissions may not represent unique individuals.
- Provide a way to reset demo data before judging if appropriate.

---

## Technology stack

The proposed stack is:

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, Vite, JavaScript | Dashboard and user interaction |
| Map | Leaflet | Ward/area map visualization |
| Charts | A charting library selected by the team | Display time-series indicators |
| Backend | Python, FastAPI | API routes and application logic |
| AI | Gemini API | Evidence-grounded summaries and Q&A |
| Database | Tiger Data / TimescaleDB, PostgreSQL-compatible | Store observations and time-series aggregates |
| Blockchain | Solana Devnet | Demonstration transactions and explorer receipts |
| Data | Toronto Open Data / 311 | Local service-request indicators |

This is the **intended** stack. The README should be updated to match what is actually integrated by submission time.

## Architecture

```text
┌──────────────────────────────────────────┐
│              React + Vite                │
│ Ward explorer · Gemini Q&A · Budget UI   │
│ Community preferences · Ledger receipts  │
└─────────────────────┬────────────────────┘
                      │ HTTP / JSON
┌─────────────────────▼────────────────────┐
│             FastAPI backend              │
│ Validation · Aggregation · API routes    │
└──────────────┬──────────────┬─────────────┘
               │              │
       ┌───────▼──────┐ ┌─────▼───────────┐
       │ Gemini API   │ │ Tiger Data      │
       │ AI insights  │ │ PostgreSQL data │
       └──────────────┘ └─────────────────┘
               │
       ┌───────▼──────────────────────────┐
       │ Chain service / Solana Devnet     │
       │ Test transfer · Signature · URL  │
       └──────────────────────────────────┘
```

The frontend should call the backend for application data. API keys and signing secrets must never be placed in frontend environment variables. The chain service should report transaction status and signatures back to the backend; the UI must not display success until the backend has verified the result.

## Project structure

```text
wardfund/
├── README.md
├── .gitignore
├── .env.example
│
├── docs/
│   ├── api.md
│   ├── mockup.png
│   └── demo-script.md
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── mockData.json
│       └── components/
│           ├── WardMap.jsx
│           ├── WardPanel.jsx
│           ├── ProjectCard.jsx
│           ├── FundingSimulator.jsx
│           └── Ledger.jsx
│
├── backend/
│   ├── requirements.txt
│   ├── main.py
│   ├── db.py
│   ├── schema.sql
│   ├── routes/
│   │   ├── wards.py
│   │   ├── projects.py
│   │   └── allocate.py
│   ├── services/
│   │   ├── gemini.py
│   │   └── chain_client.py
│   └── scripts/
│       └── load_311.py
│
└── chain/
    ├── package.json
    ├── wallets.json
    ├── send.js
    └── server.js
```

### Directory responsibilities

- `frontend/`: user interface, map, charts, allocation controls, and ledger display.
- `backend/`: API validation, Gemini integration, data processing, database access, and orchestration.
- `chain/`: isolated Solana Devnet transaction code and a small service interface.
- `docs/`: API contract, dashboard mockup, and judging/demo notes.
- `.env.example`: documents required environment variable names with placeholder values only.

`wallets.json` must contain **public addresses only**. Never put private keys, seed phrases, or secret key material in this file.

## API overview

The endpoints below are the proposed contract. Implement and document the final request/response schemas in [`docs/api.md`](docs/api.md). All responses should use JSON, consistent error shapes, and appropriate HTTP status codes.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report whether the backend is running |
| `GET` | `/api/wards` | List available wards |
| `GET` | `/api/wards/{id}/summary` | Return indicators, trends, data range, and source metadata |
| `POST` | `/api/wards/{id}/ask` | Ask Gemini a question grounded in the selected ward's data |
| `GET` | `/api/projects` | List the current illustrative project ideas |
| `POST` | `/api/allocate` | Validate and submit a virtual budget allocation |
| `GET` | `/api/ledger` | Return allocation receipts and transaction statuses |
| `GET` | `/api/community-preferences` | Return aggregated virtual allocations |

### Suggested allocation request

```json
{
  "ward_id": "ward-14",
  "allocations": [
    { "project_id": "greener-neighbourhoods", "amount_cad": 3500 },
    { "project_id": "cleaner-streets", "amount_cad": 4000 },
    { "project_id": "community-programs", "amount_cad": 2500 }
  ],
  "currency": "CAD",
  "simulation": true
}
```

The values above are fictional simulation units, not a real payment. The backend should validate that the project IDs exist, amounts are non-negative integers, duplicate project IDs are handled, and the total matches the configured virtual budget. Do not trust client-side validation alone.

A successful response should distinguish the recorded virtual allocation from the blockchain transaction status. A database record can succeed even if a Devnet transaction fails; represent these states separately and allow a safe retry without double-counting the allocation.

### Suggested error shape

```json
{
  "error": {
    "code": "INVALID_ALLOCATION",
    "message": "Allocation amounts must total 10000."
  }
}
```

Never return secrets, stack traces, database credentials, or provider API keys in API errors.

## Environment variables

Create a local `.env` file based on `.env.example`. Use real values only in the local environment or deployment secret manager; do not commit `.env`.

Example `.env.example`:

```dotenv
# Backend
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

# Gemini
GEMINI_API_KEY=

# Tiger Data / PostgreSQL
DATABASE_URL=

# Solana Devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_TREASURY_KEYPAIR_PATH=
SOLANA_TOKEN_MINT=
SOLANA_PROJECT_WALLET_GREEN=
SOLANA_PROJECT_WALLET_STREETS=
SOLANA_PROJECT_WALLET_COMMUNITY=

# Frontend: only public, non-secret configuration belongs here
VITE_API_BASE_URL=http://localhost:8000
```

Adjust names to match the actual code. `SOLANA_TREASURY_KEYPAIR_PATH` must point to a local, ignored keypair file and must never be exposed to the frontend. If the project uses a hosted signing service, use its secure configuration instead. Never commit a populated `.env`, keypair, mnemonic, or private key.

## Getting started

### Prerequisites

Install the versions required by the project's package files:

- Node.js and npm
- Python 3.11+ (or the version pinned by the team)
- Git
- A Gemini API key for AI features
- A PostgreSQL-compatible Tiger Data connection, if database features are enabled
- A funded Solana Devnet wallet for blockchain testing, if transfers are enabled

The frontend can be developed against `mockData.json` while the backend and external integrations are still being built.

### 1. Clone and configure

```bash
git clone <YOUR_REPOSITORY_URL>
cd wardfund
cp .env.example .env
```

Edit `.env` locally. Do not paste secrets into commits, screenshots, public logs, or frontend code.

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

Ensure `frontend/package.json` includes the scripts and packages the implementation uses, including Vite, React, Leaflet, and the chosen chart library.

### 3. Install backend dependencies

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

**macOS/Linux**
```bash
source .venv/bin/activate
```

**Windows PowerShell**
```powershell
.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
cd ..
```

### 4. Install chain-service dependencies

```bash
cd chain
npm install
cd ..
```

Only install and run the chain service if blockchain functionality is being used. Check its package scripts and required environment variables before starting it.

## Running the application

Start each service in a separate terminal from the repository root.

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, activate the environment with the PowerShell command above before running `uvicorn`.

Expected local API base URL: `http://127.0.0.1:8000`

FastAPI's interactive docs are usually available at `http://127.0.0.1:8000/docs` when enabled.

### Frontend

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

### Chain service

If implemented as an HTTP service, start it using the script configured in `chain/package.json`, for example:

```bash
cd chain
npm run start
```

The exact script name depends on the implementation. Confirm that the service is configured for **Devnet** and that its signing key is kept out of the repository. Do not expose a signing endpoint publicly without authentication, validation, rate limits, and strict restrictions on what it can transfer.

### Mock-data mode

If the backend, Gemini, database, or chain service is not ready, the frontend may use clearly labelled mock data. In mock mode:

- Label generated or seeded numbers as **demo data**.
- Do not display fake transaction signatures or fake Solana Explorer links.
- Show unavailable integrations as unavailable, not as successful.
- Keep the allocation simulator usable for the presentation.

## Loading Toronto 311 data

The intended loader is `backend/scripts/load_311.py`.

Before running it:

1. Choose the exact Toronto Open Data dataset.
2. Confirm its licence, fields, date coverage, and download method.
3. Map the dataset's fields to the schema in `backend/schema.sql`.
4. Handle missing, malformed, duplicate, and updated records.
5. Make the loader safe to rerun without duplicating the same records.
6. Record import time and source metadata.

Once configured, run the loader using the command documented by the script. For example, if it is a normal Python script:

```bash
cd backend
python scripts/load_311.py
```

Do not claim that the dashboard is using live or current data unless the data pipeline actually refreshes it. Show the dataset's last-updated timestamp and selected date range.

## Solana Devnet and the demo ledger

WardFund's blockchain component is a demonstration of transparent test-network activity.

- Use Solana **Devnet**, not Mainnet.
- Fund the demo wallet with Devnet SOL through an official faucet if needed.
- Use test tokens only if the token mint and transfer flow are correctly configured.
- Confirm the transaction before displaying it as successful.
- Store the signature, network, timestamp, amount, and transaction status in the receipt.
- Construct the Explorer link using the Devnet cluster parameter, and verify that the link opens the actual transaction.
- Handle RPC timeouts, failed transactions, and insufficient funds.
- Make retries idempotent or otherwise prevent duplicate transfers.

A successful virtual allocation is not the same as a successful blockchain transaction. The UI should show separate statuses such as:

- `Allocation saved`
- `Devnet transaction pending`
- `Devnet transaction confirmed`
- `Devnet transaction failed`

Do not store a private key in `wallets.json`, the frontend, Git, or a public issue. Do not use real funds or real personal financial information in the demo.

## Testing and verification

At minimum, test:

### Frontend

- Ward selection updates the displayed data.
- The funding controls cannot silently exceed the $10,000 budget.
- Percentages and totals are calculated correctly.
- Loading, empty, error, and mock-data states are visible.
- Explorer links are only shown for real transaction signatures.

### Backend

- `/api/health` reports service status.
- Invalid ward IDs and unknown project IDs return clear errors.
- Negative, non-numeric, duplicate, and over-budget allocations are handled.
- The backend validates totals independently of the frontend.
- Gemini failures and rate limits produce useful error responses.
- Database failures do not cause false success messages.
- Community totals exclude invalid or duplicate submissions according to the documented rules.

### Chain service

- A small Devnet transfer can be submitted and confirmed.
- The transaction signature resolves in Solana Explorer on Devnet.
- Invalid destinations and insufficient balances are handled safely.
- Failed or pending transactions are not marked confirmed.
- Secrets are absent from logs and repository history.

### Final demo checklist

- [ ] The app starts from a clean checkout using the README.
- [ ] At least one ward view uses real, attributed data, or is explicitly labelled mock data.
- [ ] Gemini answers a question grounded in the displayed data.
- [ ] The $10,000 simulator validates allocations.
- [ ] Community preference totals update from stored submissions.
- [ ] A real Devnet transaction is confirmed if blockchain functionality is claimed.
- [ ] Every external integration is accurately labelled as live, mock, or unavailable.
- [ ] No secrets are committed.
- [ ] The team has a backup demo path if Wi-Fi or an external API fails.

## Security and responsible use

- Keep `.env`, private keys, seed phrases, and credential files out of Git.
- Restrict CORS to the intended frontend origin.
- Validate and limit user input on the server.
- Add rate limiting for public API endpoints and Gemini requests.
- Avoid logging secrets or unnecessary personal information.
- Use a constrained signing wallet with only the funds needed for testing.
- Never expose a general-purpose transaction-signing endpoint.
- Treat AI outputs as generated assistance, not verified facts.
- Provide data-source links and communicate limitations.
- Make it clear that WardFund is not affiliated with or endorsed by the City of Toronto unless formal authorization exists.

## Limitations and future work

The hackathon prototype may have limited data coverage, a small number of project ideas, and a non-representative sample of participants. Toronto 311 records reflect reported service requests, not every issue or every resident's needs. Voluntary virtual allocations can be affected by who discovers and uses the site.

Potential future work:

- Add more verified public datasets and clearer ward boundaries.
- Compare trends with population or other relevant context when suitable data is available.
- Improve accessibility and multilingual support.
- Add transparent participation and anti-abuse safeguards.
- Support moderated community proposals with verified cost estimates.
- Provide exportable reports for community organizations and officials.
- Explore a formal civic-participation partnership before presenting results as official consultation.
- Evaluate whether the platform reaches residents across different neighbourhoods and demographics without overclaiming representativeness.

## Hackathon prize-track fit

WardFund is designed to be relevant to these tracks, subject to the official rules and the features actually implemented:

- **Hack the Valley × School of Cities:** the primary fit. WardFund helps residents understand Toronto urban issues and express priorities relevant to civic decision-making, while remaining politically neutral.
- **Best Use of Solana (MLH):** a fit if the demo includes a meaningful, working Devnet capability and verified transactions—not merely a wallet graphic or a link.
- **Best Use of Gemini API (MLH):** a fit if Gemini is meaningfully integrated into evidence-grounded explanations and question answering.
- **Best Use of Tiger Data (MLH):** a fit if the app genuinely uses Tiger Data/TimescaleDB for time-series storage or analytics.
- **Best AI for Social Impact:** potentially relevant if the AI is used responsibly to make civic information more accessible.
- **Sustainable FinTech & Economic Inclusion:** a possible but less direct fit; WardFund is primarily civic technology, not a financial service.

Prize eligibility and judging criteria can change. Check the current hackathon rules and ensure every claimed integration is functional.

## Team responsibilities

For a team of three:

### Person 1 — Frontend

- Build the React/Vite dashboard and navigation.
- Implement ward selection, map, charts, project cards, and allocation sliders.
- Connect all requests through `frontend/src/api.js`.
- Build loading, error, and mock-data states.
- Display community results and ledger receipts clearly.

### Person 2 — Blockchain

- Implement and test the Devnet transaction flow in `chain/`.
- Maintain public project wallet addresses.
- Build the small chain HTTP wrapper if needed.
- Return confirmed signatures and network metadata to the backend.
- Keep signing keys secure and ensure failures are represented honestly.

### Person 3 — AI & Data / Backend

- Implement the FastAPI routes and validation.
- Load and normalize Toronto 311 data.
- Configure Tiger Data and time-series queries if used.
- Integrate Gemini with evidence-grounded prompts.
- Coordinate the allocation record and chain transaction status.

Agree on the API contract in `docs/api.md` before everyone builds independently. Start with mock data and a basic working vertical slice, then integrate one real data source, Gemini, and a verified Devnet transaction. Prioritize a reliable end-to-end demo over unfinished integrations.

## Demo script

See [`docs/demo-script.md`](docs/demo-script.md) for the full judging walkthrough.

Suggested short pitch:

> “WardFund helps Toronto residents understand neighbourhood issues using public service-request data, ask AI questions about what the evidence means, and express their priorities through a virtual $10,000 community budget. We aggregate those choices to show what participating residents want prioritized, and use Solana Devnet to demonstrate a transparent test-network transaction. These results are a source of community input—not real tax spending or a binding government decision.”

## License

Choose a license before publishing the repository. If you have not selected one yet, do not imply that the code is open-source under a specific license. Add a `LICENSE` file and update this section once the team agrees.
