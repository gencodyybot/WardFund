const API = "http://127.0.0.1:8000";

/**
 * WardFund Civic Funding Demo
 * Plain JS frontend updated to match real backend API shapes and behavior.
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  wards: [],
  selectedWardId: "ward-14",
  currentWard: null,
  projects: [],
  allocations: {}, // project_id -> amount_cad
  totalBudget: 10000,
  isAllocating: false,
  isAskingGemini: false,
  isDemoFallback: false,
  map: null,
  preferencesChart: null,
  sliderRefs: {},
};

// ============================================================================
// Fallback / Demo Dataset (Matches the real backend response shapes)
// ============================================================================
const DEMO_DATA = {
  wards: {
    wards: [
      {
        id: "ward-14",
        name: "Ward 14 – Toronto-Danforth",
        indicators: {
          "311_requests_total": 2842,
          "top_category": "Noise Complaints",
          "noise_complaints": 1240,
          "illegal_dumping": 892,
          "parks_rec_requests": 421,
        },
      },
      {
        id: "ward-10",
        name: "Ward 10 – Spadina-Fort York",
        indicators: {
          "311_requests_total": 3120,
          "top_category": "Property Standards",
          "noise_complaints": 980,
          "illegal_dumping": 650,
          "parks_rec_requests": 510,
        },
      },
      {
        id: "ward-13",
        name: "Ward 13 – Toronto Centre",
        indicators: {
          "311_requests_total": 3450,
          "top_category": "Illegal Dumping",
          "noise_complaints": 1420,
          "illegal_dumping": 1150,
          "parks_rec_requests": 380,
        },
      },
      {
        id: "ward-4",
        name: "Ward 4 – Parkdale-High Park",
        indicators: {
          "311_requests_total": 1980,
          "top_category": "Parks & Recreation",
          "noise_complaints": 720,
          "illegal_dumping": 430,
          "parks_rec_requests": 610,
        },
      },
    ],
  },
  summaries: {
    "ward-14": {
      name: "Ward 14 – Toronto-Danforth",
      indicators: {
        "311_requests_total": 2842,
        "top_category": "Noise Complaints",
        "noise_growth_6m": "18% increase",
        "illegal_dumping_growth_6m": "22% increase in Danforth & Pape",
        "priority_need": "Waste management and public space maintenance",
      },
      source: "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/",
    },
    "ward-10": {
      name: "Ward 10 – Spadina-Fort York",
      indicators: {
        "311_requests_total": 3120,
        "top_category": "Property Standards",
        "construction_noise": "High density in waterfront corridor",
        "priority_need": "Pedestrian safety and public realm standards",
      },
      source: "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/",
    },
    "ward-13": {
      name: "Ward 13 – Toronto Centre",
      indicators: {
        "311_requests_total": 3450,
        "top_category": "Illegal Dumping",
        "priority_need": "Sanitation and community safety initiatives",
      },
      source: "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/",
    },
    "ward-4": {
      name: "Ward 4 – Parkdale-High Park",
      indicators: {
        "311_requests_total": 1980,
        "top_category": "Parks & Recreation",
        "priority_need": "Urban tree canopy and recreational programming",
      },
      source: "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/",
    },
  },
  projects: {
    projects: [
      {
        id: "proj-clean-safe-streets",
        name: "Clean & Safe Streets",
        description: "Increase waste collection and address illegal dumping hotspots in the area.",
      },
      {
        id: "proj-greener-danforth",
        name: "Greener Danforth",
        description: "Plant more trees and improve green spaces to create a healthier, cooler neighbourhood.",
      },
      {
        id: "proj-community-programs",
        name: "Community Programs",
        description: "Fund local youth programs and recreation spaces to build a stronger, more connected community.",
      },
    ],
  },
  community_preferences: {
    participant_count: 142,
    preferences: [
      {
        name: "Clean & Safe Streets",
        total_allocated_cad: 450000,
        percentage_share: 40,
      },
      {
        name: "Greener Danforth",
        total_allocated_cad: 380000,
        percentage_share: 35,
      },
      {
        name: "Community Programs",
        total_allocated_cad: 270000,
        percentage_share: 25,
      },
    ],
  },
  ledger: {
    ledger_entries: [
      {
        ward_id: "ward-14",
        created_at: "Just now",
        transactions: [
          {
            project_id: "proj-clean-safe-streets",
            amount_cad: 4000,
            signature: "5KG2...8Fse",
            explorer_url: "https://explorer.solana.com/tx/5KG2uFse?cluster=devnet",
          },
          {
            project_id: "proj-greener-danforth",
            amount_cad: 3500,
            signature: "3PL8...2Km9",
            explorer_url: "https://explorer.solana.com/tx/3PL82Km9?cluster=devnet",
          },
          {
            project_id: "proj-community-programs",
            amount_cad: 2500,
            signature: "7RQ1...9Vp2",
            explorer_url: "https://explorer.solana.com/tx/7RQ19Vp2?cluster=devnet",
          },
        ],
      },
    ],
  },
};

// ============================================================================
// API & Data Access Functions (Strictly match the real backend shapes)
// ============================================================================

/**
 * GET /api/wards -> { wards: [{ id, name, indicators: { 311_requests_total, top_category } }] }
 */
async function apiGetWards() {
  if (state.isDemoFallback) {
    return DEMO_DATA.wards;
  }
  try {
    const res = await fetch(`${API}/api/wards`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/wards: ${err.message}. Using offline demo fallback.`);
    state.isDemoFallback = true;
    showErrorNotification(`Notice: Could not connect to ${API}/api/wards. Using demo mode.`);
    return DEMO_DATA.wards;
  }
}

/**
 * GET /api/wards/{id}/summary -> { name, indicators, source }
 */
async function apiGetWardSummary(wardId) {
  if (state.isDemoFallback) {
    return DEMO_DATA.summaries[wardId] || DEMO_DATA.summaries["ward-14"];
  }
  try {
    const res = await fetch(`${API}/api/wards/${encodeURIComponent(wardId)}/summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/wards/${wardId}/summary:`, err.message);
    showErrorNotification("Could not load this ward's summary from the backend.");
    return null;
  }
}

/**
 * POST /api/wards/{id}/ask with { question } -> { answer }
 */
async function apiAskWard(wardId, question) {
  if (state.isDemoFallback) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      answer: `Based on open civic data for ${wardId}, 311 requests reflect concentrated reports in high-traffic corridors. Community funding can directly support bylaw enforcement and neighborhood cleanliness.`,
    };
  }

  const res = await fetch(`${API}/api/wards/${encodeURIComponent(wardId)}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, "Ask Gemini error"));
  }

  return await res.json();
}

/**
 * GET /api/projects -> { projects: [{ id, name, description }] }
 */
async function apiGetProjects() {
  if (state.isDemoFallback) {
    return DEMO_DATA.projects;
  }
  try {
    const res = await fetch(`${API}/api/projects`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/projects:`, err.message);
    showErrorNotification("Could not load projects from the backend.");
    return { projects: [] };
  }
}

/**
 * POST /api/allocate with { ward_id, allocations: [{ project_id, amount_cad }] }
 * -> { receipt: { transactions: [{ project_id, amount_cad, signature, explorer_url }] } }
 */
async function apiAllocate(wardId, allocationsArray) {
  if (state.isDemoFallback) {
    // Simulate real Solana devnet confirmation latency (5 to 10 seconds)
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const randomSig = "5KG2" + Math.random().toString(36).substring(2, 6).toUpperCase() + "...8Fse";
    return {
      receipt: {
        transactions: allocationsArray.map((alloc) => ({
          project_id: alloc.project_id,
          amount_cad: alloc.amount_cad,
          signature: randomSig,
          explorer_url: `https://explorer.solana.com/tx/${randomSig}?cluster=devnet`,
        })),
      },
    };
  }

  const res = await fetch(`${API}/api/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
    ward_id: wardId,
    allocations: allocationsArray,
    currency: "CAD",
    simulation: true,
  }),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, "Allocation failed"));
  }

  return await res.json();
}

/**
 * GET /api/ledger -> { ledger_entries: [...] }
 */
async function apiGetLedger() {
  if (state.isDemoFallback) {
    return DEMO_DATA.ledger;
  }
  try {
    const res = await fetch(`${API}/api/ledger`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/ledger:`, err.message);
    return { ledger_entries: [] };
  }
}

/**
 * GET /api/community-preferences
 * -> { participant_count, preferences: [{ name, total_allocated_cad, percentage_share }] }
 */
async function apiGetCommunityPreferences() {
  if (state.isDemoFallback) {
    return DEMO_DATA.community_preferences;
  }
  try {
    const res = await fetch(`${API}/api/community-preferences`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/community-preferences:`, err.message);
    return null;
  }
}

// ============================================================================
// UI Rendering Functions
// ============================================================================

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
const SOLANA_RPC = "https://api.devnet.solana.com";

const WARD_COORDS = {
  "ward-14": [43.68, -79.33],
  "ward-10": [43.6426, -79.4],
  "ward-13": [43.658, -79.375],
  "ward-4": [43.65, -79.47],
};

let wardMarkers = [];

async function readApiError(res, prefix) {
  let message = res.statusText || `HTTP ${res.status}`;
  try {
    const body = await res.json();
    const d = body && body.detail;
    if (body && body.error && body.error.message) message = body.error.message;
    else if (typeof d === "string") message = d;
    else if (d && d.error && d.error.message) message = d.error.message;
    else if (Array.isArray(d) && d[0] && d[0].msg) message = d[0].msg;
  } catch (_) {
    /* body was not JSON */
  }
  return `${prefix} (${res.status}): ${message}`;
}

function shortSig(sig) {
  const s = String(sig || "");
  return s.length > 14 ? `${s.slice(0, 6)}...${s.slice(-6)}` : s;
}

function shortWallet(w) {
  const s = String(w || "");
  return s.length > 10 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;
}

function formatDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value || "Recent") : d.toLocaleString();
}

function projectName(id) {
  const p = state.projects.find((x) => x.id === id);
  return p ? p.name : id;
}

function addDevnetNotice() {
  if (document.getElementById("devnetNotice")) return;
  const header = document.querySelector(".top-header");
  const note = document.createElement("div");
  note.id = "devnetNotice";
  note.style.cssText =
    "text-align:center;font-size:0.75rem;padding:4px 12px;color:#6B7490;border-bottom:1px solid rgba(17,19,15,0.08);";
  note.textContent = "Devnet demo. Demo data. No real money.";
  if (header && header.parentNode) header.parentNode.insertBefore(note, header.nextSibling);
}

function showDemoBanner() {
  if (!state.isDemoFallback || document.getElementById("demoBanner")) return;
  const b = document.createElement("div");
  b.id = "demoBanner";
  b.setAttribute("role", "status");
  b.style.cssText =
    "background:#b45309;color:#fff;padding:8px 16px;text-align:center;font-size:0.85rem;font-weight:600;";
  b.textContent =
    "DEMO MODE: the backend is not reachable. Everything on this page is simulated, including transactions.";
  document.body.prepend(b);
}

async function refreshChainStatus() {
  const el = document.querySelector(".solana-status");
  if (!el) return;
  let text = "Offline";
  if (!state.isDemoFallback) {
    try {
      const res = await fetch(`${API}/api/health`);
      const h = await res.json();
      text = h.chain === "devnet" ? "Connected" : "Chain skipped";
    } catch (_) {
      text = "Offline";
    }
  }
  if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.nodeValue = text;
}

async function getSolBalance(wallet) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data && data.result && typeof data.result.value === "number") {
      return data.result.value / 1e9;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Project Balances card: live devnet SOL balance for each project wallet.
 * Wallet addresses come from GET /api/projects (field: wallet).
 */
async function renderProjectBalances(projects) {
  const el = document.getElementById("projectBalances");
  if (!el) return;
  el.innerHTML = "";

  if (!Array.isArray(projects) || projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state-text";
    empty.textContent = "No project wallets available.";
    el.appendChild(empty);
    return;
  }

  const colors = ["green", "blue", "purple"];
  const rows = projects.map((p, idx) => {
    const item = document.createElement("div");
    item.className = "balance-item";

    const left = document.createElement("div");
    left.className = "balance-left";

    const icon = document.createElement("div");
    icon.className = `balance-icon ${colors[idx % colors.length]}`;
    icon.textContent = (p.name || "?").charAt(0);

    const group = document.createElement("div");
    group.className = "balance-name-group";
    const nm = document.createElement("span");
    nm.className = "balance-name";
    nm.textContent = p.name;
    const wl = document.createElement("span");
    wl.className = "balance-wallet";
    wl.textContent = p.wallet ? shortWallet(p.wallet) : "no wallet";
    group.appendChild(nm);
    group.appendChild(wl);

    left.appendChild(icon);
    left.appendChild(group);

    const right = document.createElement("div");
    right.className = "balance-right";
    const amount = document.createElement("span");
    amount.textContent = "...";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    right.appendChild(amount);
    right.appendChild(dot);

    item.appendChild(left);
    item.appendChild(right);
    el.appendChild(item);
    return { wallet: p.wallet, amount };
  });

  await Promise.all(
    rows.map(async (r) => {
      if (!r.wallet || state.isDemoFallback) {
        r.amount.textContent = "demo";
        return;
      }
      const sol = await getSolBalance(r.wallet);
      r.amount.textContent = sol === null ? "n/a" : `${sol.toFixed(4)} SOL`;
    })
  );
}

function hideRecentTx() {
  const box = document.getElementById("recentTxBox");
  if (box) box.style.display = "none";
}

/**
 * Recent Transaction card: one row per project transfer, each linked to Solana Explorer.
 */
function renderRecentTransactions(txs) {
  const box = document.getElementById("recentTxBox");
  if (!box) return;

  const header = box.querySelector(".tx-header-status");
  box.innerHTML = "";
  if (header) box.appendChild(header);

  const onChain = !state.isDemoFallback && txs.some((t) => t.signature && t.explorer_url);
  if (header) {
    const label = header.querySelector("span");
    if (label) {
      label.textContent = onChain
        ? "Allocation executed on Solana Devnet"
        : "Allocation recorded (no on-chain transfer)";
    }
  }

  txs.forEach((tx) => {
    const row = document.createElement("div");
    row.className = "tx-sig-row";

    const label = document.createElement("span");
    label.textContent = `${projectName(tx.project_id)}:`;
    row.appendChild(label);

    if (!state.isDemoFallback && tx.signature && tx.explorer_url) {
      const a = document.createElement("a");
      a.className = "tx-sig-link";
      a.href = tx.explorer_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `${shortSig(tx.signature)} ↗`;
      row.appendChild(a);
    } else {
      const s = document.createElement("span");
      s.textContent = state.isDemoFallback ? "simulated, not on-chain" : "chain skipped";
      row.appendChild(s);
    }
    box.appendChild(row);
  });

  box.style.display = "flex";
}

/**
 * Keep the allocation at exactly the budget: when one slider moves,
 * the other projects absorb the change in proportion to their current amounts.
 */
function rebalanceAllocations(changedId, rawValue) {
  const ids = Object.keys(state.sliderRefs);
  const total = state.totalBudget;
  const step = 100;
  const others = ids.filter((id) => id !== changedId);
  const next = {};

  if (others.length === 0) {
    next[changedId] = total;
  } else {
    const newVal = Math.min(total, Math.max(0, Math.round(rawValue / step) * step));
    next[changedId] = newVal;
    const remaining = total - newVal;
    const otherSum = others.reduce((s, id) => s + (state.allocations[id] || 0), 0);
    let assigned = 0;
    others.forEach((id, i) => {
      let v;
      if (i === others.length - 1) {
        v = remaining - assigned;
      } else {
        const weight = otherSum > 0 ? (state.allocations[id] || 0) / otherSum : 1 / others.length;
        v = Math.round((remaining * weight) / step) * step;
        v = Math.max(0, Math.min(v, remaining - assigned));
      }
      next[id] = v;
      assigned += v;
    });
  }

  ids.forEach((id) => {
    const v = next[id];
    state.allocations[id] = v;
    const ref = state.sliderRefs[id];
    ref.slider.value = v;
    ref.amountSpan.textContent = `$${v.toLocaleString()}`;
    ref.pctSpan.textContent = `${Math.round((v / total) * 100)}%`;
  });
  updateTotalAndConfirmState();
}

/**
 * Show error message in #error element (Uses textContent)
 */
function showErrorNotification(message) {
  const errorEl = document.getElementById("error");
  if (!errorEl) return;
  if (!message) {
    errorEl.textContent = "";
    errorEl.classList.remove("visible");
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.add("visible");
}

/**
 * Render ward dropdown options into #wards
 */
function renderWardsDropdown(wards) {
  const selectEl = document.getElementById("wards");
  if (!selectEl) return;

  selectEl.innerHTML = "";

  if (!wards || wards.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No wards found";
    selectEl.appendChild(opt);
    return;
  }

  wards.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.name;
    if (w.id === state.selectedWardId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

/**
 * Render Header and Stat Cards for the selected ward
 */
function renderWardStats(ward) {
  if (!ward) return;

  const titleEl = document.getElementById("wardTitle");
  if (titleEl) {
    titleEl.textContent = ward.name;
  }

  const indicators = ward.indicators || {};
  const fmt = (v) => (v === undefined || v === null || v === "" ? "—" : Number(v).toLocaleString());

  const reqEl = document.getElementById("statRequests");
  if (reqEl) reqEl.textContent = fmt(indicators["311_requests_total"] ?? ward.requests_30d);

  const catLabelEl = document.getElementById("statTopCategoryLabel");
  if (catLabelEl) catLabelEl.textContent = indicators.top_category || "Top category";

const categories = Array.isArray(indicators.categories)
  ? indicators.categories
  : [];

const topCategory = categories.find(
  (category) => category.name === indicators.top_category
);

const catCountEl = document.getElementById("statTopCategoryCount");

if (catCountEl) {
  catCountEl.textContent = fmt(
    indicators.top_category_count ?? topCategory?.count
  );
}

  const dumpingCountEl = document.getElementById("statDumpingCount");
  if (dumpingCountEl) dumpingCountEl.textContent = fmt(indicators.illegal_dumping);

  const parksCountEl = document.getElementById("statParksCount");
  if (parksCountEl) parksCountEl.textContent = fmt(indicators.parks_rec_requests);

  const cats = Array.isArray(indicators.categories) ? indicators.categories : [];
  const cards = document.querySelectorAll(".stat-card");
  cats.slice(0, 3).forEach((c, i) => {
    const card = cards[i + 1];
    if (!card) return;
    const v = card.querySelector(".stat-value");
    const l = card.querySelector(".stat-label");
    if (v) v.textContent = Number(c.count).toLocaleString();
    if (l) l.textContent = c.name;
  });

  // The backend does not provide trends, so hide the hardcoded trend lines.
  document.querySelectorAll(".stat-trend").forEach((el) => {
    el.style.display = "none";
  });
}

/**
 * Render Ward Summary and Sources
 * GET /api/wards/{id}/summary returns { name, indicators, source }
 * DATA RULE: Set API text with textContent, not innerHTML
 */
function renderSummaryAndSources(data) {
  const summaryEl = document.getElementById("summary");
  const sourcesEl = document.getElementById("sources");

  if (summaryEl) {
    if (!data) {
      summaryEl.textContent = "No summary data available for this ward.";
    } else {
      let text = "";
      if (data.name) {
        text += `${data.name}\n\n`;
      }
      if (data.indicators && typeof data.indicators === "object") {
        text += "Key Indicators:\n";
        for (const [key, val] of Object.entries(data.indicators)) {
          if (Array.isArray(val)) continue;
          const formattedKey = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const formattedVal =
            typeof val === "number" ? val.toLocaleString() : val;
          text += `• ${formattedKey}: ${formattedVal}\n`;
        }
      } else if (data.summary) {
        text += data.summary;
      }
      const cats = data && data.indicators && Array.isArray(data.indicators.categories) ? data.indicators.categories : [];
      if (cats.length) {
        text += "\nTop categories:\n";
        cats.forEach((c) => {
          text += `• ${c.name}: ${Number(c.count).toLocaleString()} (${c.percentage}%)\n`;
        });
      }
      if (data && data.limitation_note) text += `\nNote: ${data.limitation_note}\n`;
      if (data && data.data_range) text += `Data range: ${data.data_range}\n`;
      summaryEl.textContent = text || "No indicator summary recorded.";
    }
  }

  if (sourcesEl) {
    sourcesEl.innerHTML = "";
    if (data && data.source) {
      const sourcesList = Array.isArray(data.source) ? data.source : [data.source];
      sourcesList.forEach((src) => {
        if (typeof src === "string" && (src.startsWith("http://") || src.startsWith("https://"))) {
          const link = document.createElement("a");
          link.href = src;
          link.textContent = src;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          sourcesEl.appendChild(link);
        } else {
          const span = document.createElement("span");
          span.textContent = String(src);
          sourcesEl.appendChild(span);
        }
      });
    } else {
      const defaultSource = document.createElement("a");
      defaultSource.href = "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/";
      defaultSource.textContent = "Toronto Open Data (311 Service Requests)";
      defaultSource.target = "_blank";
      defaultSource.rel = "noopener noreferrer";
      sourcesEl.appendChild(defaultSource);
    }
  }
}

/**
 * Render Community Preferences Bar Chart (Chart.js)
 * GET /api/community-preferences -> { participant_count, preferences: [{ name, total_allocated_cad, percentage_share }] }
 */
function renderCommunityPreferencesChart(data) {
  const canvas = document.getElementById("trendChart");
  const chartWrapper = canvas ? canvas.parentElement : null;
  const subEl = document.getElementById("communityPreferencesSub");
  const listEl = document.getElementById("preferencesList");

  if (!canvas || !chartWrapper) return;

  if (!data || !Array.isArray(data.preferences) || data.preferences.length === 0) {
    chartWrapper.style.display = "none";
    return;
  }

  chartWrapper.style.display = "block";

  if (subEl && data.participant_count !== undefined) {
    subEl.textContent = `Based on ${Number(data.participant_count).toLocaleString()} civic participants`;
  }

  // Update side breakdown list
  if (listEl) {
    listEl.innerHTML = '<div class="cat-heading">Top Choices</div>';
    const colors = ["#3568D4", "#91ADFF", "#1F3A8A", "#6F8FEA", "#E66A4E"];
    data.preferences.forEach((pref, idx) => {
      const color = colors[idx % colors.length];
      const item = document.createElement("div");
      item.className = "cat-item";

      const left = document.createElement("div");
      left.className = "cat-item-left";

      const dot = document.createElement("span");
      dot.className = "cat-dot";
      dot.style.backgroundColor = color;

      const name = document.createElement("span");
      name.textContent = pref.name;

      left.appendChild(dot);
      left.appendChild(name);

      const pct = document.createElement("span");
      pct.className = "cat-item-pct";
      pct.textContent = `${pref.percentage_share || 0}%`;

      item.appendChild(left);
      item.appendChild(pct);
      listEl.appendChild(item);
    });
  }

  try {
    const labels = data.preferences.map((p) => p.name);
    const shares = data.preferences.map((p) => p.percentage_share);

    if (state.preferencesChart) {
      state.preferencesChart.destroy();
    }

    const ctx = canvas.getContext("2d");

    state.preferencesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Community Share (%)",
            data: shares,
            backgroundColor: [
              "rgba(53, 104, 212, 0.85)",
              "rgba(145, 173, 255, 0.85)",
              "rgba(31, 58, 138, 0.85)",
              "rgba(111, 143, 234, 0.85)",
            ],
            borderColor: [
              "#3568D4",
              "#91ADFF",
              "#1F3A8A",
              "#6F8FEA",
            ],
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0B1226",
            titleColor: "#A9B4CC",
            bodyColor: "#f8fafc",
            borderColor: "#2B3E60",
            borderWidth: 1,
            padding: 8,
            callbacks: {
              label: function (context) {
                const item = data.preferences[context.dataIndex];
                const amt = item.total_allocated_cad
                  ? ` ($${Number(item.total_allocated_cad).toLocaleString()} CAD)`
                  : "";
                return ` ${context.raw}%${amt}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#7A8296",
              font: { size: 10 },
            },
          },
          y: {
            grid: {
              color: "rgba(17, 19, 15, 0.07)",
            },
            ticks: {
              color: "#7A8296",
              font: { size: 10 },
              callback: function (val) {
                return val + "%";
              },
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("[WardFund] Failed to render community preferences chart:", err);
    chartWrapper.style.display = "none";
  }
}

/**
 * Render the Toronto ward map. Only wards returned by the API get a pin,
 * so clicking a pin always selects a ward the backend knows.
 */
function renderWardMap(wards) {
  const mapContainer = document.getElementById("map");
  if (!mapContainer || typeof L === "undefined") return;

  if (!state.map) {
    state.map = L.map("map", {
      center: [43.675, -79.37],
      zoom: 11,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: "abc",
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.map);
  }

  wardMarkers.forEach((m) => m.remove());
  wardMarkers = [];

  (wards || []).forEach((ward) => {
    const coords = WARD_COORDS[ward.id];
    if (!coords) return;

    const pin = document.createElement("div");
    pin.className = "custom-ward-pin" + (ward.id === state.selectedWardId ? " selected" : "");
    pin.dataset.wardId = ward.id;
    pin.title = ward.name;
    pin.textContent = "●";

    const icon = L.divIcon({
      className: "custom-div-icon",
      html: pin,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const popup = document.createElement("strong");
    popup.textContent = ward.name;

    const marker = L.marker(coords, { icon }).addTo(state.map);
    marker.bindPopup(popup);
    marker.on("click", () => selectWard(ward.id));
    wardMarkers.push(marker);
  });
}

/**
 * Render Project Cards into #projects
 * GET /api/projects -> { projects: [{ id, name, description }] }
 * (No cost or impact fields)
 */
function renderProjects(projects) {
  const projectsContainer = document.getElementById("projects");
  if (!projectsContainer) return;

  projectsContainer.innerHTML = "";
  state.sliderRefs = {};

  if (!Array.isArray(projects) || projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state-text";
    empty.textContent = "No community projects available.";
    projectsContainer.appendChild(empty);
    updateTotalAndConfirmState();
    return;
  }

  // Pre-seed allocations if empty to sum up to exactly 10,000
  const hasAllocations = Object.keys(state.allocations).length > 0;
  if (!hasAllocations) {
    if (projects.length === 3) {
      state.allocations[projects[0].id] = 4000;
      state.allocations[projects[1].id] = 3500;
      state.allocations[projects[2].id] = 2500;
    } else {
      const share = Math.floor(state.totalBudget / projects.length / 100) * 100;
      let running = 0;
      projects.forEach((proj, idx) => {
        if (idx === projects.length - 1) {
          state.allocations[proj.id] = state.totalBudget - running;
        } else {
          state.allocations[proj.id] = share;
          running += share;
        }
      });
    }
  }

  const projectImages = [
    "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=200&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=200&auto=format&fit=crop&q=80",
  ];

  projects.forEach((proj, idx) => {
    const card = document.createElement("div");
    card.className = "project-card";

    // Top row: thumbnail & title
    const topRow = document.createElement("div");
    topRow.className = "project-top-row";

    const thumb = document.createElement("img");
    thumb.className = "project-thumb";
    thumb.alt = proj.name;
    thumb.src = projectImages[idx % projectImages.length];
    thumb.onerror = () => {
      thumb.style.display = "none";
    };

    const info = document.createElement("div");
    info.className = "project-info";

    const nameEl = document.createElement("h4");
    nameEl.className = "project-name";
    nameEl.textContent = proj.name;

    const descEl = document.createElement("p");
    descEl.className = "project-desc";
    descEl.textContent = proj.description || "Civic funding initiative for community empowerment.";

    info.appendChild(nameEl);
    info.appendChild(descEl);
    topRow.appendChild(thumb);
    topRow.appendChild(info);

    // Slider controls section
    const sliderSection = document.createElement("div");
    sliderSection.className = "project-slider-section";

    const valRow = document.createElement("div");
    valRow.className = "slider-val-row";

    const amountSpan = document.createElement("span");
    amountSpan.className = "proj-amount";
    const currentAlloc = state.allocations[proj.id] || 0;
    amountSpan.textContent = `$${currentAlloc.toLocaleString()}`;

    const pctSpan = document.createElement("span");
    pctSpan.className = "proj-pct";
    const pct = Math.round((currentAlloc / state.totalBudget) * 100);
    pctSpan.textContent = `${pct}%`;

    valRow.appendChild(amountSpan);
    valRow.appendChild(pctSpan);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "proj-slider";
    slider.min = "0";
    slider.max = "10000";
    slider.step = "100";
    slider.value = currentAlloc;
    slider.setAttribute("aria-label", `Allocation for ${proj.name}`);

    state.sliderRefs[proj.id] = { slider, amountSpan, pctSpan };
    slider.addEventListener("input", (e) => {
      rebalanceAllocations(proj.id, parseInt(e.target.value, 10) || 0);
    });

    sliderSection.appendChild(valRow);
    sliderSection.appendChild(slider);

    card.appendChild(topRow);
    card.appendChild(sliderSection);

    projectsContainer.appendChild(card);
  });

  updateTotalAndConfirmState();
}

/**
 * Update live Total Allocated / Remaining and Confirm button state
 * RULE: The amounts must total exactly 10000, so enable Confirm only when remaining is exactly $0.
 */
function updateTotalAndConfirmState() {
  const totalEl = document.getElementById("total");
  const confirmBtn = document.getElementById("confirm");
  const remainingHint = document.getElementById("remainingHint");
  const totalCheckIcon = document.getElementById("totalCheckIcon");

  let totalAllocated = 0;
  Object.values(state.allocations).forEach((amt) => {
    totalAllocated += amt;
  });

  const remaining = state.totalBudget - totalAllocated;

  if (totalEl) {
    totalEl.textContent = `$${totalAllocated.toLocaleString()} / $${state.totalBudget.toLocaleString()}`;
  }

  if (remainingHint) {
    if (remaining === 0) {
      remainingHint.textContent = "Exact allocation reached ($0 remaining)";
      remainingHint.style.color = "var(--accent-green)";
    } else if (remaining > 0) {
      remainingHint.textContent = `$${remaining.toLocaleString()} remaining (Must equal $0 to confirm)`;
      remainingHint.style.color = "var(--text-gray-400)";
    } else {
      remainingHint.textContent = `Over budget by $${Math.abs(remaining).toLocaleString()}!`;
      remainingHint.style.color = "var(--accent-red)";
    }
  }

  // Update checkmark icon styling
  if (totalCheckIcon) {
    totalCheckIcon.className = "total-check-icon";
    if (remaining === 0) {
      // Valid exact 10,000
    } else if (remaining < 0) {
      totalCheckIcon.classList.add("error");
    } else {
      totalCheckIcon.classList.add("warning");
    }
  }

  // Confirm enabled ONLY when remaining is exactly 0 and not currently allocating
  if (confirmBtn) {
    const isExactBudget = totalAllocated === state.totalBudget;
    confirmBtn.disabled = !isExactBudget || state.isAllocating;
  }
}

/**
 * Render ledger records into #ledger
 * GET /api/ledger returns { ledger_entries: [...] }
 * Each entry has transactions with explorer_url. Link each one to Solana Explorer in a new tab.
 */
function renderLedger(ledgerData) {
  const ledgerEl = document.getElementById("ledger");
  if (!ledgerEl) return;

  ledgerEl.innerHTML = "";

  const entries =
    (ledgerData && ledgerData.ledger_entries) ||
    (Array.isArray(ledgerData) ? ledgerData : []);

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state-text";
    empty.textContent = "No recent allocations recorded.";
    ledgerEl.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const wardLabel = entry.ward_id || entry.ward || "Ward 14";
    const dateLabel = formatDate(entry.created_at);
    const txs = entry.transactions || [entry];

    txs.forEach((tx) => {
      const item = document.createElement("div");
      item.className = "ledger-item";

      const top = document.createElement("div");
      top.className = "ledger-top";

      const wardSpan = document.createElement("span");
      wardSpan.className = "ledger-ward";
      wardSpan.textContent = `${wardLabel} · ${projectName(tx.project_id)}`;

      const amtSpan = document.createElement("span");
      amtSpan.className = "ledger-amount";
      const amt = tx.amount_cad ?? tx.amount ?? 0;
      amtSpan.textContent = `+$${Number(amt).toLocaleString()} CAD`;

      top.appendChild(wardSpan);
      top.appendChild(amtSpan);

      const bottom = document.createElement("div");
      bottom.className = "ledger-bottom";

      let link;
      if (!state.isDemoFallback && tx.signature && tx.explorer_url) {
        link = document.createElement("a");
        link.className = "ledger-link";
        link.href = tx.explorer_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${shortSig(tx.signature)} ↗`;
      } else {
        link = document.createElement("span");
        link.className = "ledger-date";
        link.textContent = state.isDemoFallback ? "simulated" : "no on-chain tx";
      }

      const dateSpan = document.createElement("span");
      dateSpan.className = "ledger-date";
      dateSpan.textContent = dateLabel;

      bottom.appendChild(link);
      bottom.appendChild(dateSpan);

      item.appendChild(top);
      item.appendChild(bottom);

      ledgerEl.appendChild(item);
    });
  });
}

// ============================================================================
// Controller & User Journey Actions
// ============================================================================

/**
 * Select a Ward by ID, fetch summary and update views
 */
async function selectWard(wardId) {
  if (!wardId) return;
  state.selectedWardId = wardId;
  state.currentWard = state.wards.find((w) => w.id === wardId) || null;

  // Sync dropdown selection
  const selectEl = document.getElementById("wards");
  if (selectEl && selectEl.value !== wardId) {
    selectEl.value = wardId;
  }

  // Update stats cards
  renderWardStats(state.currentWard);

  // Highlight the selected pin on the map
  document.querySelectorAll(".custom-ward-pin").forEach((el) => {
    el.classList.toggle("selected", el.dataset.wardId === wardId);
  });

  // Clear previous Ask Gemini answer
  const answerBox = document.getElementById("askGeminiAnswer");
  if (answerBox) {
    answerBox.textContent = "";
    answerBox.style.display = "none";
  }

  // Set loading summary
  const summaryEl = document.getElementById("summary");
  if (summaryEl) summaryEl.textContent = "Loading ward indicators and summary...";

  // Fetch summary for this ward
  const summaryData = await apiGetWardSummary(wardId);
  renderSummaryAndSources(summaryData);
}

/**
 * Handle "Ask Gemini about this ward"
 * POST /api/wards/{id}/ask with { question } -> { answer }
 * DATA RULE: Show the answer with textContent
 */
async function handleAskGemini() {
  const inputEl = document.getElementById("askGeminiInput");
  const btnEl = document.getElementById("askGeminiBtn");
  const answerEl = document.getElementById("askGeminiAnswer");

  if (!inputEl || !btnEl || !answerEl) return;

  const question = inputEl.value.trim();
  if (!question) return;

  state.isAskingGemini = true;
  btnEl.disabled = true;
  btnEl.textContent = "Thinking...";

  answerEl.style.display = "block";
  answerEl.textContent = "Consulting Gemini AI with 311 ward indicators...";

  try {
    const res = await apiAskWard(state.selectedWardId, question);
    if (res && res.answer) {
      answerEl.textContent = res.answer;
    } else {
      answerEl.textContent = "No answer returned for this question.";
    }
  } catch (err) {
    console.error("[WardFund] Ask Gemini error:", err);
    answerEl.textContent = `Error: ${err.message}`;
  } finally {
    state.isAskingGemini = false;
    btnEl.disabled = false;
    btnEl.textContent = "Ask ✦";
  }
}

/**
 * Handle Confirm Allocation button click
 * POST /api/allocate with { ward_id, allocations: [{ project_id, amount_cad }] }
 * -> { receipt: { transactions: [{ project_id, amount_cad, signature, explorer_url }] } }
 */
async function handleConfirmAllocation() {
  if (state.isAllocating) return;

  const totalAllocated = Object.values(state.allocations).reduce((a, b) => a + b, 0);
  if (totalAllocated !== state.totalBudget) {
    showErrorNotification("Allocations must total exactly $10,000 to execute on Solana Devnet.");
    return;
  }

  state.isAllocating = true;
  const confirmBtn = document.getElementById("confirm");
  const origText = confirmBtn ? confirmBtn.innerHTML : "";

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<span class="loading-spinner"></span> <span>Allocating on Solana Devnet...</span>';
  }

  showErrorNotification("");

  try {
    const allocationsArray = Object.entries(state.allocations)
      .filter(([_, amount]) => amount > 0)
      .map(([projectId, amount]) => ({
        project_id: projectId,
        amount_cad: amount,
      }));

    const result = await apiAllocate(state.selectedWardId, allocationsArray);

    const txs =
      (result && result.receipt && result.receipt.transactions) ||
      (result && result.txs) ||
      [];

    if (txs.length > 0) {
      renderRecentTransactions(txs);

      // Add to demo ledger if in fallback mode
      if (state.isDemoFallback) {
        DEMO_DATA.ledger.ledger_entries.unshift({
          ward_id: state.selectedWardId,
          created_at: "Just now",
          transactions: txs,
        });
      }
    }

    // Refresh project balances once the transfers have landed
    renderProjectBalances(state.projects);

    // Refresh ledger
    const updatedLedger = await apiGetLedger();
    renderLedger(updatedLedger);
  } catch (err) {
    console.error("[WardFund] Allocation error:", err);
    showErrorNotification(`Error executing allocation: ${err.message}`);
  } finally {
    state.isAllocating = false;
    if (confirmBtn) {
      confirmBtn.innerHTML = origText || "<span>Execute Allocation →</span>";
    }
    updateTotalAndConfirmState();
  }
}

// ============================================================================
// Initialization & Event Wiring
// ============================================================================

async function initWardFund() {
  // Wire dropdown change
  const selectEl = document.getElementById("wards");
  if (selectEl) {
    selectEl.addEventListener("change", (e) => {
      selectWard(e.target.value);
    });
  }

  // Wire confirm button
  const confirmBtn = document.getElementById("confirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", handleConfirmAllocation);
  }

  // Wire Ask Gemini input and button
  const askBtn = document.getElementById("askGeminiBtn");
  const askInput = document.getElementById("askGeminiInput");
  if (askBtn) {
    askBtn.addEventListener("click", handleAskGemini);
  }
  if (askInput) {
    askInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAskGemini();
      }
    });
  }

  hideRecentTx();
  addDevnetNotice();
  await loadInitialData();
}

async function loadInitialData() {
  try {
    // Wards first: if the backend is down, this switches on demo mode for every later call
    const wardsRes = await apiGetWards();
    const [projectsRes, prefRes, ledgerRes] = await Promise.all([
      apiGetProjects(),
      apiGetCommunityPreferences(),
      apiGetLedger(),
    ]);

    // Handle wards
    state.wards = (wardsRes && wardsRes.wards) || (Array.isArray(wardsRes) ? wardsRes : []);
    if (state.wards.length > 0) {
      const defaultWard =
        state.wards.find((w) => w.id === "ward-14") || state.wards[0];
      state.selectedWardId = defaultWard.id;
      state.currentWard = defaultWard;

      renderWardsDropdown(state.wards);
      renderWardStats(state.currentWard);
      renderWardMap(state.wards);
      await selectWard(state.selectedWardId);
    } else {
      showErrorNotification("No wards available from API.");
    }

    // Handle projects
    state.projects =
      (projectsRes && projectsRes.projects) ||
      (Array.isArray(projectsRes) ? projectsRes : []);
    renderProjects(state.projects);
    renderProjectBalances(state.projects);

    // Handle community preferences bar chart
    renderCommunityPreferencesChart(prefRes);

    // Handle ledger
    renderLedger(ledgerRes);

    showDemoBanner();
    refreshChainStatus();

    // Ensure responsive canvases
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
      if (state.preferencesChart) state.preferencesChart.resize();
    }, 150);
  } catch (err) {
    console.error("[WardFund] Initialization error:", err);
    showErrorNotification(`Initialization error: ${err.message}`);
  }
}

// Keep map and chart responsive on window resizing
window.addEventListener("resize", () => {
  if (state.map) state.map.invalidateSize();
  if (state.preferencesChart) state.preferencesChart.resize();
});

// Start app on DOMContentLoaded
document.addEventListener("DOMContentLoaded", initWardFund);
