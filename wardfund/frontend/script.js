const API = "http://localhost:8000";

/**
 * WardFund Civic Funding Demo
 * Plain JS frontend adhering strictly to STACK, DATA, API, and BEHAVIOUR rules.
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  wards: [],
  selectedWardId: null,
  currentWard: null,
  projects: [],
  allocations: {}, // project_id -> number
  totalBudget: 10000,
  isAllocating: false,
  isDemoFallback: false,
  map: null,
  mapMarkers: {},
  trendChart: null,
};

// ============================================================================
// Fallback / Demo Dataset (Matches reference mockup if backend is offline)
// ============================================================================
const DEMO_DATA = {
  wards: [
    {
      id: "ward-14",
      name: "Ward 14 – Toronto-Danforth",
      requests_30d: 2842,
      top_category: "Noise Complaints",
      trend: "↑ 15% (vs. last 6 months)",
      lat: 43.6800,
      lon: -79.3300,
    },
    {
      id: "ward-10",
      name: "Ward 10 – Spadina-Fort York",
      requests_30d: 3120,
      top_category: "Property Standards",
      trend: "↑ 9% (vs. last 6 months)",
      lat: 43.6426,
      lon: -79.4000,
    },
    {
      id: "ward-13",
      name: "Ward 13 – Toronto Centre",
      requests_30d: 3450,
      top_category: "Illegal Dumping",
      trend: "↑ 22% (vs. last 6 months)",
      lat: 43.6580,
      lon: -79.3750,
    },
    {
      id: "ward-4",
      name: "Ward 4 – Parkdale-High Park",
      requests_30d: 1980,
      top_category: "Parks & Recreation",
      trend: "↑ 7% (vs. last 6 months)",
      lat: 43.6500,
      lon: -79.4700,
    },
  ],
  summaries: {
    "ward-14": {
      summary:
        "Based on 311 data, Ward 14 has seen a 22% increase in illegal dumping reports over the last 6 months, particularly around Danforth Ave and Pape Ave.\n\nThis suggests a need for more frequent waste collection and public awareness in these areas.\n\nPotential projects to consider:\n• More waste management bins\n• Community clean-up programs\n• Increased bylaw enforcement presence",
      sources: [
        "https://open.toronto.ca/dataset/311-service-requests-customer-initiated/",
      ],
    },
  },
  trends: {
    "ward-14": [
      { day: "Jan", n: 45 },
      { day: "Feb", n: 58 },
      { day: "Mar", n: 72 },
      { day: "Apr", n: 65 },
      { day: "May", n: 82 },
      { day: "Jun", n: 96 },
      { day: "Jul", n: 80 },
      { day: "Aug", n: 110 },
      { day: "Sep", n: 95 },
      { day: "Oct", n: 130 },
      { day: "Nov", n: 145 },
      { day: "Dec", n: 172 },
    ],
  },
  projects: {
    "ward-14": [
      {
        id: "p-greener-danforth",
        name: "Greener Danforth",
        cost: 3500,
        impact: "🌱 Lower temps, 🌱 Better air quality",
        wallet: "0x4aS...9f2e",
        description:
          "Plant more trees and improve green spaces to create a healthier, cooler neighbourhood.",
        image:
          "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&auto=format&fit=crop&q=80",
      },
      {
        id: "p-clean-safe-streets",
        name: "Clean & Safe Streets",
        cost: 4000,
        impact: "🛡️ Cleaner streets, 🛡️ Safer community",
        wallet: "0x8b7...1f04",
        description:
          "Increase waste collection and address illegal dumping hotspots in the area.",
        image:
          "https://images.unsplash.com/photo-1517732306149-e8f829eb588a?w=200&auto=format&fit=crop&q=80",
      },
      {
        id: "p-community-programs",
        name: "Community Programs",
        cost: 2500,
        impact: "👥 Youth engagement, 👥 Stronger community",
        wallet: "0x2e6...7a8b",
        description:
          "Fund local youth programs and recreation spaces to build a stronger, more connected community.",
        image:
          "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=200&auto=format&fit=crop&q=80",
      },
    ],
  },
  ledger: [
    {
      ward: "Ward 14",
      project_id: "p-clean-safe-streets",
      amount: 4000,
      signature: "5KG2...8Fse",
      explorer_url: "https://explorer.solana.com/tx/5KG2uFse?cluster=devnet",
      created_at: "Just now",
    },
    {
      ward: "Ward 14",
      project_id: "p-greener-danforth",
      amount: 3500,
      signature: "3PL8...2Km9",
      explorer_url: "https://explorer.solana.com/tx/3PL82Km9?cluster=devnet",
      created_at: "2 hours ago",
    },
  ],
};

// ============================================================================
// API & Data Access Functions (Logic separated from rendering)
// ============================================================================

/**
 * Fetch list of wards from GET /api/wards
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
    console.warn(`[WardFund] Live API error on GET /api/wards: ${err.message}. Enabling demo preview data.`);
    state.isDemoFallback = true;
    showErrorNotification(`Notice: Could not reach ${API}/api/wards. Using offline demo dataset matching mockup.`);
    return DEMO_DATA.wards;
  }
}

/**
 * Fetch ward summary from GET /api/wards/{id}/summary
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
    return DEMO_DATA.summaries[wardId] || DEMO_DATA.summaries["ward-14"];
  }
}

/**
 * Fetch ward trend from GET /api/wards/{id}/trend
 */
async function apiGetWardTrend(wardId) {
  if (state.isDemoFallback) {
    return DEMO_DATA.trends[wardId] || DEMO_DATA.trends["ward-14"];
  }
  try {
    const res = await fetch(`${API}/api/wards/${encodeURIComponent(wardId)}/trend`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/wards/${wardId}/trend:`, err.message);
    return DEMO_DATA.trends[wardId] || DEMO_DATA.trends["ward-14"];
  }
}

/**
 * Fetch projects for a ward from GET /api/projects?ward={id}
 */
async function apiGetProjects(wardId) {
  if (state.isDemoFallback) {
    return DEMO_DATA.projects[wardId] || DEMO_DATA.projects["ward-14"];
  }
  try {
    const res = await fetch(`${API}/api/projects?ward=${encodeURIComponent(wardId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WardFund] Live API error on GET /api/projects?ward=${wardId}:`, err.message);
    return DEMO_DATA.projects[wardId] || DEMO_DATA.projects["ward-14"];
  }
}

/**
 * POST /api/allocate body {ward, allocations: [{project_id, amount}]}
 */
async function apiAllocate(wardId, allocationsArray) {
  if (state.isDemoFallback) {
    // Simulate real Solana devnet confirmation latency (5 to 15 seconds)
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const randomSig = "5KG2" + Math.random().toString(36).substring(2, 6).toUpperCase() + "...8Fse";
    return {
      txs: allocationsArray.map((alloc) => ({
        project_id: alloc.project_id,
        amount: alloc.amount,
        signature: randomSig,
        explorer_url: `https://explorer.solana.com/tx/${randomSig}?cluster=devnet`,
      })),
    };
  }

  const res = await fetch(`${API}/api/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ward: wardId,
      allocations: allocationsArray,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Allocation failed (${res.status}): ${errText || res.statusText}`);
  }

  return await res.json();
}

/**
 * Fetch ledger from GET /api/ledger
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
    return DEMO_DATA.ledger;
  }
}

// ============================================================================
// UI Rendering Functions
// ============================================================================

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

  const reqEl = document.getElementById("statRequests");
  if (reqEl && ward.requests_30d !== undefined) {
    reqEl.textContent = Number(ward.requests_30d).toLocaleString();
  }

  const trendEl = document.getElementById("statTrend");
  if (trendEl && ward.trend) {
    trendEl.textContent = ward.trend;
  }

  const catLabelEl = document.getElementById("statTopCategoryLabel");
  if (catLabelEl && ward.top_category) {
    catLabelEl.textContent = ward.top_category;
  }

  const trendSub = document.getElementById("trendSubtitle");
  if (trendSub) {
    trendSub.textContent = `${ward.top_category || "Requests"} in ${ward.name} (last 12 months)`;
  }
}

/**
 * Render AI Summary into #summary and sources into #sources
 * DATA RULE: Set API text with textContent, not innerHTML
 */
function renderSummaryAndSources(data) {
  const summaryEl = document.getElementById("summary");
  const sourcesEl = document.getElementById("sources");

  if (summaryEl) {
    if (data && data.summary) {
      summaryEl.textContent = data.summary;
    } else {
      summaryEl.textContent = "No AI summary available for this ward.";
    }
  }

  if (sourcesEl) {
    sourcesEl.innerHTML = "";
    if (data && Array.isArray(data.sources) && data.sources.length > 0) {
      data.sources.forEach((url) => {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        sourcesEl.appendChild(link);
      });
    } else {
      const emptySpan = document.createElement("span");
      emptySpan.textContent = "Toronto Open Data (311 Service Requests)";
      sourcesEl.appendChild(emptySpan);
    }
  }
}

/**
 * Render Trend Chart with Chart.js
 * Rule: draw with Chart.js; if it fails, hide the chart
 */
function renderTrendChart(trendData) {
  const canvas = document.getElementById("trendChart");
  const chartWrapper = canvas ? canvas.parentElement : null;

  if (!canvas || !chartWrapper) return;

  if (!Array.isArray(trendData) || trendData.length === 0) {
    chartWrapper.style.display = "none";
    return;
  }

  try {
    chartWrapper.style.display = "block";

    const labels = trendData.map((d) => d.day);
    const values = trendData.map((d) => d.n);

    if (state.trendChart) {
      state.trendChart.destroy();
    }

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, "rgba(124, 58, 237, 0.45)");
    gradient.addColorStop(1, "rgba(124, 58, 237, 0.0)");

    state.trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Requests",
            data: values,
            borderColor: "#8b5cf6",
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.38,
            pointBackgroundColor: "#c084fc",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1e293b",
            titleColor: "#94a3b8",
            bodyColor: "#f8fafc",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 10 },
            },
          },
          y: {
            grid: {
              color: "rgba(255, 255, 255, 0.05)",
            },
            ticks: {
              color: "#64748b",
              font: { size: 10 },
              maxTicksLimit: 5,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("[WardFund] Failed to render trend chart:", err);
    chartWrapper.style.display = "none";
  }
}

/**
 * Initialize and render Leaflet map
 */
function renderLeafletMap(wards, selectedWardId) {
  const mapContainer = document.getElementById("map");
  if (!mapContainer || typeof L === "undefined") return;

  // Toronto center fallback
  const centerLat = 43.6800;
  const centerLon = -79.3600;

  if (!state.map) {
    state.map = L.map("map", {
      center: [centerLat, centerLon],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    // Sleek Dark Filtered OpenStreetMap Tiles
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        subdomains: "abc",
        maxZoom: 18,
      }
    ).addTo(state.map);
  }

  // Clear existing markers
  Object.values(state.mapMarkers).forEach((marker) => marker.remove());
  state.mapMarkers = {};

  if (!Array.isArray(wards) || wards.length === 0) return;

  wards.forEach((ward) => {
    if (ward.lat !== undefined && ward.lon !== undefined) {
      const isSelected = ward.id === selectedWardId;
      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class="custom-ward-pin ${isSelected ? "selected" : ""}" title="${ward.name}">●</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([ward.lat, ward.lon], { icon: customIcon }).addTo(state.map);
      marker.bindPopup(`<strong>${ward.name}</strong><br/>${ward.requests_30d || 0} requests`);

      marker.on("click", () => {
        selectWard(ward.id);
      });

      state.mapMarkers[ward.id] = marker;

      if (isSelected) {
        state.map.panTo([ward.lat, ward.lon]);
      }
    }
  });
}

/**
 * Render Project Cards into #projects
 */
function renderProjects(projects) {
  const projectsContainer = document.getElementById("projects");
  if (!projectsContainer) return;

  projectsContainer.innerHTML = "";

  if (!Array.isArray(projects) || projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state-text";
    empty.textContent = "No community projects currently listed for this ward.";
    projectsContainer.appendChild(empty);
    updateTotalAndConfirmState();
    return;
  }

  // Pre-populate allocations if not set
  projects.forEach((proj) => {
    if (state.allocations[proj.id] === undefined) {
      state.allocations[proj.id] = Number(proj.cost) || 0;
    }
  });

  projects.forEach((proj) => {
    const card = document.createElement("div");
    card.className = "project-card";

    // Top row with thumbnail & title
    const topRow = document.createElement("div");
    topRow.className = "project-top-row";

    const thumb = document.createElement("img");
    thumb.className = "project-thumb";
    thumb.alt = proj.name;
    thumb.src =
      proj.image ||
      "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200&auto=format&fit=crop&q=80";

    const info = document.createElement("div");
    info.className = "project-info";

    const nameEl = document.createElement("h4");
    nameEl.className = "project-name";
    nameEl.textContent = proj.name;

    const descEl = document.createElement("p");
    descEl.className = "project-desc";
    descEl.textContent =
      proj.description ||
      `Support civic initiatives and sustainable community development in this ward.`;

    info.appendChild(nameEl);
    info.appendChild(descEl);
    topRow.appendChild(thumb);
    topRow.appendChild(info);

    // Impact row
    const impactBox = document.createElement("div");
    impactBox.className = "project-impact-box";

    const impactHeading = document.createElement("span");
    impactHeading.className = "impact-heading";
    impactHeading.textContent = "Estimated Impact";
    impactBox.appendChild(impactHeading);

    const tagsContainer = document.createElement("div");
    tagsContainer.className = "impact-tags";

    if (proj.impact) {
      const tags = proj.impact.split(",");
      tags.forEach((tagText) => {
        const tag = document.createElement("span");
        tag.className = "impact-tag";
        tag.textContent = tagText.trim();
        tagsContainer.appendChild(tag);
      });
    } else {
      const defaultTag = document.createElement("span");
      defaultTag.className = "impact-tag";
      defaultTag.textContent = "Community benefit";
      tagsContainer.appendChild(defaultTag);
    }
    impactBox.appendChild(tagsContainer);

    // Slider section
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

    slider.addEventListener("input", (e) => {
      const newVal = parseInt(e.target.value, 10) || 0;
      state.allocations[proj.id] = newVal;
      amountSpan.textContent = `$${newVal.toLocaleString()}`;
      const newPct = Math.round((newVal / state.totalBudget) * 100);
      pctSpan.textContent = `${newPct}%`;
      updateTotalAndConfirmState();
    });

    sliderSection.appendChild(valRow);
    sliderSection.appendChild(slider);

    card.appendChild(topRow);
    card.appendChild(impactBox);
    card.appendChild(sliderSection);

    projectsContainer.appendChild(card);
  });

  updateTotalAndConfirmState();
}

/**
 * Update live Total Allocated / Remaining and Confirm button state
 * RULE: Disable Confirm when the total is 0 or above $10,000
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
    if (remaining > 0) {
      remainingHint.textContent = `$${remaining.toLocaleString()} remaining`;
      remainingHint.style.color = "var(--text-gray-400)";
    } else if (remaining === 0) {
      remainingHint.textContent = "Exact allocation reached ($0 remaining)";
      remainingHint.style.color = "var(--accent-green)";
    } else {
      remainingHint.textContent = `Over budget by $${Math.abs(remaining).toLocaleString()}!`;
      remainingHint.style.color = "var(--accent-red)";
    }
  }

  // Update icon styling
  if (totalCheckIcon) {
    totalCheckIcon.className = "total-check-icon";
    if (totalAllocated === 0) {
      totalCheckIcon.classList.add("warning");
    } else if (totalAllocated > state.totalBudget) {
      totalCheckIcon.classList.add("error");
    }
  }

  // Confirm button disabled when total is 0 or above 10,000 or allocating
  if (confirmBtn) {
    const isDisabled =
      totalAllocated <= 0 ||
      totalAllocated > state.totalBudget ||
      state.isAllocating;
    confirmBtn.disabled = isDisabled;
  }
}

/**
 * Render ledger records into #ledger
 * RULE: Every row has a link to explorer_url that opens in a new tab
 */
function renderLedger(ledgerList) {
  const ledgerEl = document.getElementById("ledger");
  if (!ledgerEl) return;

  ledgerEl.innerHTML = "";

  if (!Array.isArray(ledgerList) || ledgerList.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state-text";
    empty.textContent = "No recent allocations recorded.";
    ledgerEl.appendChild(empty);
    return;
  }

  ledgerList.forEach((tx) => {
    const item = document.createElement("div");
    item.className = "ledger-item";

    const top = document.createElement("div");
    top.className = "ledger-top";

    const wardSpan = document.createElement("span");
    wardSpan.className = "ledger-ward";
    wardSpan.textContent = tx.ward || "Ward 14";

    const amtSpan = document.createElement("span");
    amtSpan.className = "ledger-amount";
    amtSpan.textContent = `+$${Number(tx.amount || 0).toLocaleString()} WFT`;

    top.appendChild(wardSpan);
    top.appendChild(amtSpan);

    const bottom = document.createElement("div");
    bottom.className = "ledger-bottom";

    const link = document.createElement("a");
    link.className = "ledger-link";
    link.href = tx.explorer_url || "https://explorer.solana.com";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${tx.signature || "Explorer Link"} ↗`;

    const dateSpan = document.createElement("span");
    dateSpan.className = "ledger-date";
    dateSpan.textContent = tx.created_at || "Recent";

    bottom.appendChild(link);
    bottom.appendChild(dateSpan);

    item.appendChild(top);
    item.appendChild(bottom);

    ledgerEl.appendChild(item);
  });
}

// ============================================================================
// Controller & User Journey Actions
// ============================================================================

/**
 * Select a Ward by ID, fetch its data, and update views
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

  // Update map marker selection
  Object.entries(state.mapMarkers).forEach(([id, marker]) => {
    const el = marker.getElement();
    if (el) {
      const pin = el.querySelector(".custom-ward-pin");
      if (pin) {
        if (id === wardId) {
          pin.classList.add("selected");
        } else {
          pin.classList.remove("selected");
        }
      }
    }
  });

  if (state.currentWard && state.map) {
    state.map.panTo([state.currentWard.lat, state.currentWard.lon]);
  }

  // Update stats
  renderWardStats(state.currentWard);

  // Set loading states
  const summaryEl = document.getElementById("summary");
  if (summaryEl) summaryEl.textContent = "Loading ward AI insights from Gemini...";

  const projectsEl = document.getElementById("projects");
  if (projectsEl) {
    projectsEl.innerHTML = '<div class="empty-state-text"><span class="loading-spinner"></span> Loading projects...</div>';
  }

  // Fetch summary, trend, projects in parallel
  const [summaryData, trendData, projectsData] = await Promise.all([
    apiGetWardSummary(wardId),
    apiGetWardTrend(wardId),
    apiGetProjects(wardId),
  ]);

  state.projects = projectsData || [];
  state.allocations = {};

  renderSummaryAndSources(summaryData);
  renderTrendChart(trendData);
  renderProjects(state.projects);
}

/**
 * Handle Confirm Allocation button click
 */
async function handleConfirmAllocation() {
  if (state.isAllocating) return;

  const totalAllocated = Object.values(state.allocations).reduce((a, b) => a + b, 0);
  if (totalAllocated <= 0 || totalAllocated > state.totalBudget) {
    showErrorNotification("Allocation must be greater than $0 and cannot exceed $10,000.");
    return;
  }

  state.isAllocating = true;
  const confirmBtn = document.getElementById("confirm");
  const origText = confirmBtn ? confirmBtn.innerHTML : "";

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="loading-spinner"></span> <span>Allocating on Solana Devnet...</span>';
  }

  showErrorNotification("");

  try {
    const allocationsArray = Object.entries(state.allocations)
      .filter(([_, amount]) => amount > 0)
      .map(([projectId, amount]) => ({
        project_id: projectId,
        amount: amount,
      }));

    const result = await apiAllocate(state.selectedWardId, allocationsArray);

    // Update Recent Transaction Box
    const recentTxBox = document.getElementById("recentTxBox");
    const sigLink = document.getElementById("recentTxSigLink");
    const explorerLink = document.getElementById("recentTxExplorerLink");

    if (result && result.txs && result.txs.length > 0) {
      const primaryTx = result.txs[0];
      if (sigLink) {
        sigLink.textContent = `${primaryTx.signature} ↗`;
        sigLink.href = primaryTx.explorer_url;
      }
      if (explorerLink) {
        explorerLink.href = primaryTx.explorer_url;
      }
      if (recentTxBox) {
        recentTxBox.style.display = "flex";
      }

      // Add to demo ledger if in fallback
      if (state.isDemoFallback) {
        result.txs.forEach((tx) => {
          DEMO_DATA.ledger.unshift({
            ward: state.currentWard ? state.currentWard.name.split("–")[0].trim() : "Ward 14",
            project_id: tx.project_id,
            amount: tx.amount,
            signature: tx.signature,
            explorer_url: tx.explorer_url,
            created_at: "Just now",
          });
        });
      }
    }

    // Refresh ledger
    const updatedLedger = await apiGetLedger();
    renderLedger(updatedLedger);
  } catch (err) {
    console.error("[WardFund] Allocation request failed:", err);
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

  // Wire demo toggle button
  const toggleBtn = document.getElementById("toggleDemoBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      state.isDemoFallback = !state.isDemoFallback;
      toggleBtn.textContent = state.isDemoFallback ? "Demo Mode (Active)" : "Live API Mode";
      showErrorNotification(
        state.isDemoFallback
          ? "Switched to local Demo Mode dataset."
          : `Switched to Live API Mode (${API}).`
      );
      loadInitialData();
    });
  }

  await loadInitialData();
}

async function loadInitialData() {
  try {
    const wards = await apiGetWards();
    state.wards = wards || [];

    if (state.wards.length > 0) {
      // Pick first ward (or ward-14 if present)
      const defaultWard = state.wards.find((w) => w.id === "ward-14") || state.wards[0];
      state.selectedWardId = defaultWard.id;
      state.currentWard = defaultWard;

      renderWardsDropdown(state.wards);
      renderLeafletMap(state.wards, state.selectedWardId);
      await selectWard(state.selectedWardId);
    } else {
      showErrorNotification("No wards available from API.");
    }

    const ledgerList = await apiGetLedger();
    renderLedger(ledgerList);

    // Ensure map tiles and chart render crisp at the exact container dimensions
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
      if (state.trendChart) state.trendChart.resize();
    }, 150);
  } catch (err) {
    console.error("[WardFund] Initialization error:", err);
    showErrorNotification(`Initialization failed: ${err.message}`);
  }
}

// Keep map and chart responsive on window resizing
window.addEventListener("resize", () => {
  if (state.map) state.map.invalidateSize();
  if (state.trendChart) state.trendChart.resize();
});

// Start app on DOMContentLoaded
document.addEventListener("DOMContentLoaded", initWardFund);

