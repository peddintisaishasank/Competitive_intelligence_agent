/**
 * js/components/trends.js
 * ─────────────────────────────────────────────────────────────────
 * Competitive Trends & Pattern Intelligence Component (Phase 10)
 *
 * Features:
 *  - Time window selectors (30D, 90D, 6M, 12M, Custom)
 *  - Single-competitor trend analysis & two-competitor comparison mode
 *  - Quantitative period metrics & responsive SVG timeline & category charts
 *  - Clear separation: OBSERVATION vs PATTERN vs INTERPRETATION
 *  - Strict evidence-backed pattern cards with event inspection
 *  - Hindsight Reflect strategic long-term memory integration
 * ─────────────────────────────────────────────────────────────────
 */

import { apiClient } from "../data/apiClient.js";

const CATEGORY_COLORS = {
  Product: "#6366f1",
  Pricing: "#10b981",
  Marketing: "#ef4444",
  Partnership: "#8b5cf6",
  Hiring: "#06b6d4",
  Funding: "#f59e0b",
  Expansion: "#0ea5e9",
  Other: "#94a3b8",
};

const TYPE_CONFIG = {
  ACTIVITY_INCREASE:     { label: "Activity Increase", class: "trend-badge--increase", icon: "📈" },
  ACTIVITY_DECREASE:     { label: "Activity Decrease", class: "trend-badge--decrease", icon: "📉" },
  CATEGORY_SURGE:        { label: "Category Surge",    class: "trend-badge--surge",    icon: "⚡" },
  CATEGORY_DECLINE:      { label: "Category Decline",  class: "trend-badge--decline",  icon: "⏳" },
  REPEATED_ACTIVITY:     { label: "Repeated Activity", class: "trend-badge--repeat",   icon: "🔄" },
  SEQUENTIAL_PATTERN:    { label: "Sequential Pattern",class: "trend-badge--sequence", icon: "⛓️" },
  CROSS_CATEGORY_PATTERN:{ label: "Cross-Category",    class: "trend-badge--cross",    icon: "🔀" },
  STRATEGIC_SHIFT:       { label: "Strategic Shift",   class: "trend-badge--shift",    icon: "🧭" },
  NO_SIGNIFICANT_CHANGE: { label: "Steady Cadence",    class: "trend-badge--steady",   icon: "⚖️" },
  INSUFFICIENT_DATA:     { label: "Insufficient Data", class: "trend-badge--neutral",  icon: "ℹ️" },
};

let _state = {
  competitors: [],
  selectedCompId: null,
  selectedCompBId: null,
  compareMode: false,
  window: "6m",
  customStart: null,
  customEnd: null,
  loading: false,
  data: null,
  activeFilter: "all",
};

/**
 * Initializes and renders the Competitive Trends dashboard section.
 *
 * @param {string} containerId - Target container ID
 * @param {Array}  competitors - Array of competitor objects from DB
 */
export async function renderTrends(containerId, competitors = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  _state.competitors = competitors;
  if (!_state.selectedCompId && competitors.length > 0) {
    // Default to first competitor with events, e.g. AgroTech AI
    const agro = competitors.find(c => c.name.toLowerCase().includes("agrotech")) || competitors[0];
    _state.selectedCompId = agro.id;
  }
  if (!_state.selectedCompBId && competitors.length > 1) {
    const farm = competitors.find(c => c.name.toLowerCase().includes("farmvision")) || competitors[1];
    _state.selectedCompBId = farm.id;
  }

  renderShell(container);
  await loadTrendsData();
}

/**
 * Renders the container shell, toolbar, and controls.
 */
function renderShell(container) {
  container.innerHTML = `
    <div class="trends-component">
      <!-- Header & Toolbar -->
      <div class="trends-header">
        <div class="trends-header__title-wrap">
          <div class="trends-badge-pill">
            <span class="ai-badge-inline" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">PHASE 10</span>
            <span class="trends-engine-tag">Trend & Pattern Intelligence</span>
          </div>
          <h2 class="section-title" style="margin-top:6px;">Competitive Trends</h2>
          <p class="section-subtitle">Evidence-based pattern detection, categorical momentum shifts, and timeline sequences</p>
        </div>

        <div class="trends-controls">
          <!-- Competitor Selectors -->
          <div class="trends-select-group">
            <label class="trends-label" for="trends-comp-select">Competitor:</label>
            <select id="trends-comp-select" class="trends-select">
              ${_state.competitors.map(c => `
                <option value="${c.id}" ${c.id === _state.selectedCompId ? "selected" : ""}>
                  ${c.name}
                </option>
              `).join("")}
            </select>
          </div>

          <div id="trends-comp-b-wrap" class="trends-select-group" style="display:${_state.compareMode ? "flex" : "none"}">
            <label class="trends-label" for="trends-comp-b-select">Compare with:</label>
            <select id="trends-comp-b-select" class="trends-select">
              ${_state.competitors.map(c => `
                <option value="${c.id}" ${c.id === _state.selectedCompBId ? "selected" : ""}>
                  ${c.name}
                </option>
              `).join("")}
            </select>
          </div>

          <!-- Compare Mode Toggle -->
          <button id="btn-toggle-compare" class="trends-btn ${_state.compareMode ? "trends-btn--active" : ""}" title="Toggle Side-by-Side Comparison">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M2 4h5M2 8h5M2 12h5M9 4h5M9 8h5M9 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            ${_state.compareMode ? "Single Mode" : "Compare Mode"}
          </button>

          <!-- Refresh Button -->
          <button id="btn-refresh-trends" class="trends-btn" title="Recalculate Trends">
            <svg id="trends-refresh-icon" viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M14 8A6 6 0 112 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M14 4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Analyze
          </button>
        </div>
      </div>

      <!-- Time Window Tabs -->
      <div class="trends-window-bar">
        <div class="trends-window-tabs" id="trends-window-tabs">
          <button class="trends-tab ${_state.window === "30d" ? "active" : ""}" data-window="30d">Last 30 Days</button>
          <button class="trends-tab ${_state.window === "90d" ? "active" : ""}" data-window="90d">Last 90 Days</button>
          <button class="trends-tab ${_state.window === "6m" ? "active" : ""}" data-window="6m">Last 6 Months</button>
          <button class="trends-tab ${_state.window === "12m" ? "active" : ""}" data-window="12m">Last 12 Months</button>
          <button class="trends-tab ${_state.window === "custom" ? "active" : ""}" data-window="custom">Custom Range</button>
        </div>

        <div id="trends-custom-range-inputs" style="display:${_state.window === "custom" ? "flex" : "none"};gap:8px;align-items:center;">
          <input type="date" id="trends-start-date" class="ci-form-input ci-form-input--compact" value="${_state.customStart || ""}" />
          <span style="color:var(--color-text-faint);font-size:0.8rem;">to</span>
          <input type="date" id="trends-end-date" class="ci-form-input ci-form-input--compact" value="${_state.customEnd || ""}" />
          <button id="btn-apply-custom-date" class="btn-primary btn-xs">Apply</button>
        </div>
      </div>

      <!-- Main Body Container -->
      <div id="trends-body-container" class="trends-body">
        <div class="trends-loading-state">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22" style="animation:spin 1s linear infinite">
            <path d="M21 12a9 9 0 11-18 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Analyzing historical competitor momentum & detecting patterns…</span>
        </div>
      </div>
    </div>
  `;

  attachEventListeners();
}

/**
 * Attaches DOM events to controls and tabs.
 */
function attachEventListeners() {
  document.getElementById("trends-comp-select")?.addEventListener("change", e => {
    _state.selectedCompId = e.target.value;
    loadTrendsData();
  });

  document.getElementById("trends-comp-b-select")?.addEventListener("change", e => {
    _state.selectedCompBId = e.target.value;
    loadTrendsData();
  });

  document.getElementById("btn-toggle-compare")?.addEventListener("click", () => {
    _state.compareMode = !_state.compareMode;
    const compBWrap = document.getElementById("trends-comp-b-wrap");
    const toggleBtn = document.getElementById("btn-toggle-compare");
    if (compBWrap) compBWrap.style.display = _state.compareMode ? "flex" : "none";
    if (toggleBtn) {
      toggleBtn.classList.toggle("trends-btn--active", _state.compareMode);
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
          <path d="M2 4h5M2 8h5M2 12h5M9 4h5M9 8h5M9 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        ${_state.compareMode ? "Single Mode" : "Compare Mode"}
      `;
    }
    loadTrendsData();
  });

  document.getElementById("btn-refresh-trends")?.addEventListener("click", () => {
    loadTrendsData();
  });

  document.getElementById("trends-window-tabs")?.addEventListener("click", e => {
    const tab = e.target.closest(".trends-tab");
    if (!tab) return;
    document.querySelectorAll(".trends-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    _state.window = tab.dataset.window;

    const customInputs = document.getElementById("trends-custom-range-inputs");
    if (customInputs) {
      customInputs.style.display = _state.window === "custom" ? "flex" : "none";
    }

    if (_state.window !== "custom") {
      loadTrendsData();
    }
  });

  document.getElementById("btn-apply-custom-date")?.addEventListener("click", () => {
    const startVal = document.getElementById("trends-start-date")?.value;
    const endVal = document.getElementById("trends-end-date")?.value;
    if (startVal && endVal) {
      _state.customStart = startVal;
      _state.customEnd = endVal;
      loadTrendsData();
    }
  });
}

/**
 * Loads trends or comparison data from the backend.
 */
async function loadTrendsData() {
  const body = document.getElementById("trends-body-container");
  const refreshIcon = document.getElementById("trends-refresh-icon");
  if (!body) return;

  if (refreshIcon) refreshIcon.style.animation = "spin 1s linear infinite";
  body.innerHTML = `
    <div class="trends-loading-state">
      <svg viewBox="0 0 24 24" fill="none" width="22" height="22" style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 11-18 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Analyzing historical competitor momentum & detecting patterns…</span>
    </div>
  `;

  try {
    if (_state.compareMode) {
      const compA = _state.competitors.find(c => c.id === _state.selectedCompId);
      const compB = _state.competitors.find(c => c.id === _state.selectedCompBId);

      const res = await apiClient.compareTrends({
        competitorAId: _state.selectedCompId,
        competitorAName: compA?.name,
        competitorBId: _state.selectedCompBId,
        competitorBName: compB?.name,
        window: _state.window,
        customStart: _state.customStart,
        customEnd: _state.customEnd,
      });

      if (res.error) throw new Error(res.error);
      _state.data = res.data;
      renderComparisonView(body, res.data);
    } else {
      const comp = _state.competitors.find(c => c.id === _state.selectedCompId);

      const res = await apiClient.trends({
        competitorId: _state.selectedCompId,
        competitorName: comp?.name,
        window: _state.window,
        customStart: _state.customStart,
        customEnd: _state.customEnd,
      });

      if (res.error) throw new Error(res.error);
      _state.data = res.data;
      renderSingleView(body, res.data);
    }
  } catch (err) {
    body.innerHTML = `
      <div class="trends-error-state">
        <div style="font-size:1.5rem;margin-bottom:8px;">⚠️</div>
        <p style="font-weight:600;margin-bottom:4px;">Trend Analysis Unavailable</p>
        <p style="color:var(--color-text-muted);font-size:0.85rem;">${err.message || "Failed to analyze trends."}</p>
        <button class="btn-ghost btn-sm" style="margin-top:12px;" onclick="document.getElementById('btn-refresh-trends').click()">Retry Analysis</button>
      </div>
    `;
  } finally {
    if (refreshIcon) refreshIcon.style.animation = "";
  }
}

/**
 * Renders the single competitor trend dashboard.
 */
function renderSingleView(container, data) {
  const { competitor, windows, metrics, patterns, hindsightReflection, executiveSummary } = data;

  const pctChange = metrics.totalPercentChange;
  const changeSign = pctChange > 0 ? "+" : "";
  const changeClass = pctChange > 0 ? "positive" : pctChange < 0 ? "negative" : "neutral";

  const topCats = Object.values(metrics.categoryBreakdown)
    .filter(c => c.current > 0)
    .sort((a, b) => b.current - a.current)
    .slice(0, 3);

  // Velocity (events per 30-day period)
  const daysInWindow = Math.max(1, Math.round((new Date(windows.current.endDate) - new Date(windows.current.startDate)) / (1000 * 60 * 60 * 24)));
  const velocity = ((metrics.totalCurrent / daysInWindow) * 30).toFixed(1);

  container.innerHTML = `
    <!-- Period Comparison Banner -->
    <div class="trends-period-banner">
      <div class="trends-period-banner__col">
        <span class="trends-period-label">CURRENT EVALUATION PERIOD</span>
        <span class="trends-period-dates">${windows.current.label}</span>
      </div>
      <div class="trends-period-divider">vs</div>
      <div class="trends-period-banner__col">
        <span class="trends-period-label">PREVIOUS BASELINE PERIOD</span>
        <span class="trends-period-dates">${windows.previous.label}</span>
      </div>
    </div>

    <!-- Executive Summary Card -->
    <div class="trends-executive-card">
      <div class="trends-executive-header">
        <span class="trends-tag-pill">STRATEGIC TRAJECTORY</span>
        <span class="trends-velocity-pill">⚡ ${velocity} events/mo</span>
      </div>
      <p class="trends-executive-text">${executiveSummary}</p>
    </div>

    <!-- Key Metrics Grid -->
    <div class="trends-metrics-grid">
      <div class="trends-metric-card">
        <span class="trends-metric-label">Total Events (Current)</span>
        <div class="trends-metric-val-row">
          <span class="trends-metric-val">${metrics.totalCurrent}</span>
          <span class="trends-delta-pill ${changeClass}">${changeSign}${pctChange}% vs prior</span>
        </div>
        <span class="trends-metric-sub">${metrics.totalPrevious} events in baseline window</span>
      </div>

      <div class="trends-metric-card">
        <span class="trends-metric-label">Leading Activity Focus</span>
        <div class="trends-metric-top-cats">
          ${topCats.length > 0 ? topCats.map(c => `
            <span class="trends-cat-pill" style="--cat-color:${CATEGORY_COLORS[c.category] || '#6366f1'}">
              ${c.category} (${c.current})
            </span>
          `).join("") : `<span style="color:var(--color-text-faint);font-size:0.85rem;">None recorded</span>`}
        </div>
        <span class="trends-metric-sub">Dominant categories in current window</span>
      </div>

      <div class="trends-metric-card">
        <span class="trends-metric-label">Patterns & Shifts</span>
        <div class="trends-metric-val-row">
          <span class="trends-metric-val">${patterns.length}</span>
          <span class="trends-delta-pill positive">Verified</span>
        </div>
        <span class="trends-metric-sub">Distinguishing Observation vs Interpretation</span>
      </div>
    </div>

    <!-- Responsive SVG Visualizations Grid -->
    <div class="trends-charts-grid">
      <!-- Chart 1: Timeline Velocity -->
      <div class="trends-chart-card">
        <div class="trends-chart-header">
          <h4 class="trends-chart-title">Activity Timeline (Monthly Volume)</h4>
          <span class="trends-chart-sub">Events per month in evaluation period</span>
        </div>
        <div class="trends-svg-wrap">
          ${renderTimelineChart(metrics.monthlyTimeline)}
        </div>
      </div>

      <!-- Chart 2: Category Shifts (Current vs Previous) -->
      <div class="trends-chart-card">
        <div class="trends-chart-header">
          <h4 class="trends-chart-title">Category Momentum (Current vs Previous)</h4>
          <span class="trends-chart-sub">Comparison of category milestone counts</span>
        </div>
        <div class="trends-svg-wrap">
          ${renderCategoryComparisonChart(metrics.categoryBreakdown)}
        </div>
      </div>
    </div>

    <!-- Patterns Section -->
    <div class="trends-patterns-section">
      <div class="trends-section-header">
        <div>
          <h3 class="trends-section-heading">Detected Behavioral Patterns & Sequences</h3>
          <p class="trends-section-sub">Evidence-based insights strictly separating factual observations from strategic interpretations</p>
        </div>
        <div class="trends-filter-chips" id="trends-pattern-filters">
          <button class="trends-filter-chip active" data-filter="all">All (${patterns.length})</button>
          <button class="trends-filter-chip" data-filter="SEQUENTIAL_PATTERN">Sequences</button>
          <button class="trends-filter-chip" data-filter="SURGE_DECLINE">Surges / Declines</button>
          <button class="trends-filter-chip" data-filter="STRATEGIC_SHIFT">Strategic Shifts</button>
        </div>
      </div>

      <div class="trends-pattern-list" id="trends-pattern-list">
        ${patterns.length > 0
          ? patterns.map(renderPatternCard).join("")
          : `<div class="trends-empty-card">No distinctive behavioral anomalies detected in this timeframe.</div>`
        }
      </div>
    </div>

    <!-- Hindsight Long-term Memory Strategic Reflection (Phase 8/10) -->
    ${hindsightReflection ? `
      <div class="trends-reflection-card">
        <div class="trends-reflection-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="ai-badge-inline" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)">HINDSIGHT REFLECT</span>
            <h4 style="margin:0;font-size:0.95rem;font-weight:600;">Long-Term Memory Synthesis</h4>
          </div>
          <span style="font-size:0.75rem;color:var(--color-text-faint);">Multi-Event Reasoning</span>
        </div>
        <div class="trends-reflection-content markdown-body">
          ${formatMarkdownReflection(hindsightReflection)}
        </div>
      </div>
    ` : ""}
  `;

  attachPatternInteractivity();
}

/**
 * Renders the two-competitor comparison view.
 */
function renderComparisonView(container, data) {
  const { comparison, compAData, compBData } = data;
  const { competitorA: A, competitorB: B, window, period, descriptiveAnalysis } = comparison;

  container.innerHTML = `
    <!-- Comparison Banner -->
    <div class="trends-period-banner">
      <div class="trends-period-banner__col">
        <span class="trends-period-label">COMPARISON EVALUATION WINDOW</span>
        <span class="trends-period-dates">${period} (${window})</span>
      </div>
    </div>

    <!-- Neutral Descriptive Synthesis -->
    <div class="trends-executive-card">
      <div class="trends-executive-header">
        <span class="trends-tag-pill">EVIDENCE-BASED COMPARISON</span>
        <span style="font-size:0.75rem;color:var(--color-text-faint);">Descriptive · No Rankings</span>
      </div>
      <p class="trends-executive-text">${descriptiveAnalysis}</p>
    </div>

    <!-- Side-by-Side Comparison Table -->
    <div class="trends-comparison-grid">
      <!-- Competitor A Column -->
      <div class="trends-compare-col">
        <div class="trends-compare-col__header">
          <h3 class="trends-compare-name">${A.name}</h3>
          <span class="trends-compare-count">${A.totalEventsCurrent} events</span>
        </div>
        <div class="trends-compare-stats">
          <div class="stat-item">
            <span class="stat-label">Previous Window</span>
            <span class="stat-val">${A.totalEventsPrevious} events</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Period Delta</span>
            <span class="stat-val ${A.percentChange >= 0 ? "positive" : "negative"}">${A.percentChange >= 0 ? "+" : ""}${A.percentChange}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Primary Categories</span>
            <span class="stat-val">${A.topCategories.slice(0, 2).join(", ") || "None"}</span>
          </div>
        </div>

        <div class="trends-compare-patterns">
          <h4 style="font-size:0.85rem;margin-bottom:8px;color:var(--color-text-muted);">Key Detected Patterns:</h4>
          ${A.keyPatterns.length > 0 ? A.keyPatterns.map(p => `
            <div class="trends-mini-pattern">
              <span class="mini-type">${p.title}</span>
              <p class="mini-obs">${p.observation}</p>
            </div>
          `).join("") : `<div class="trends-mini-pattern">None detected</div>`}
        </div>
      </div>

      <!-- Competitor B Column -->
      <div class="trends-compare-col">
        <div class="trends-compare-col__header">
          <h3 class="trends-compare-name">${B.name}</h3>
          <span class="trends-compare-count">${B.totalEventsCurrent} events</span>
        </div>
        <div class="trends-compare-stats">
          <div class="stat-item">
            <span class="stat-label">Previous Window</span>
            <span class="stat-val">${B.totalEventsPrevious} events</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Period Delta</span>
            <span class="stat-val ${B.percentChange >= 0 ? "positive" : "negative"}">${B.percentChange >= 0 ? "+" : ""}${B.percentChange}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Primary Categories</span>
            <span class="stat-val">${B.topCategories.slice(0, 2).join(", ") || "None"}</span>
          </div>
        </div>

        <div class="trends-compare-patterns">
          <h4 style="font-size:0.85rem;margin-bottom:8px;color:var(--color-text-muted);">Key Detected Patterns:</h4>
          ${B.keyPatterns.length > 0 ? B.keyPatterns.map(p => `
            <div class="trends-mini-pattern">
              <span class="mini-type">${p.title}</span>
              <p class="mini-obs">${p.observation}</p>
            </div>
          `).join("") : `<div class="trends-mini-pattern">None detected</div>`}
        </div>
      </div>
    </div>
  `;
}

/**
 * Formats a single pattern card with Observation, Pattern, Interpretation, and Evidence.
 */
function renderPatternCard(p) {
  const conf = p.confidence || "medium";
  const confClass = conf === "high" ? "conf-high" : conf === "medium" ? "conf-med" : "conf-low";
  const typeCfg = TYPE_CONFIG[p.type] || { label: p.type, class: "trend-badge--neutral", icon: "📌" };

  return `
    <div class="trends-pattern-card" data-type="${p.type}">
      <div class="trends-pattern-card__header">
        <div class="trends-pattern-title-wrap">
          <span class="trend-icon-box">${typeCfg.icon}</span>
          <div>
            <h4 class="trends-pattern-title">${p.title}</h4>
            <div class="trends-pattern-badges">
              <span class="trend-badge ${typeCfg.class}">${typeCfg.label}</span>
              <span class="trend-conf-pill ${confClass}">Confidence: ${capitalize(conf)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Strict 3-part separation -->
      <div class="trends-distinction-grid">
        <div class="distinction-block distinction-block--observation">
          <div class="distinction-tag">OBSERVATION (DATA FACT)</div>
          <p class="distinction-text">${p.observation}</p>
        </div>

        <div class="distinction-block distinction-block--pattern">
          <div class="distinction-tag">PATTERN (RELATIONSHIP)</div>
          <p class="distinction-text">${p.pattern}</p>
        </div>

        <div class="distinction-block distinction-block--interpretation">
          <div class="distinction-tag">INTERPRETATION (AI HYPOTHESIS)</div>
          <p class="distinction-text">${p.interpretation}</p>
        </div>
      </div>

      <!-- Supporting Evidence Section -->
      ${p.evidence && p.evidence.length > 0 ? `
        <div class="trends-evidence-section">
          <button class="trends-evidence-toggle" data-pat-id="${p.id}">
            <span>Supporting Evidence (${p.evidence.length} events)</span>
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="trends-evidence-drawer" id="drawer-${p.id}">
            ${p.evidence.map(e => `
              <div class="trends-evidence-item">
                <span class="ev-date">${e.date}</span>
                <span class="ev-cat" style="--ev-color:${CATEGORY_COLORS[e.category] || '#6366f1'}">${e.category}</span>
                <span class="ev-title">${e.title}</span>
                <span class="ev-source">${e.source || "Supabase"}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Renders an SVG monthly activity timeline bar chart.
 */
function renderTimelineChart(monthlyData = []) {
  if (monthlyData.length === 0) {
    return `<div style="text-align:center;padding:24px;color:var(--color-text-faint);font-size:0.85rem;">No monthly timeline data in this period.</div>`;
  }

  const maxCount = Math.max(1, ...monthlyData.map(d => d.count));
  const svgWidth = 420;
  const svgHeight = 130;
  const barWidth = Math.min(36, Math.floor((svgWidth - 40) / monthlyData.length) - 8);

  const bars = monthlyData.map((d, i) => {
    const barHeight = Math.max(8, Math.round((d.count / maxCount) * 80));
    const x = 30 + i * ((svgWidth - 40) / monthlyData.length);
    const y = 95 - barHeight;

    return `
      <g class="chart-bar-group">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="url(#timelineGrad)" />
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="var(--color-text-primary)" font-weight="600">${d.count}</text>
        <text x="${x + barWidth / 2}" y="115" text-anchor="middle" font-size="10" fill="var(--color-text-faint)">${d.label}</text>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="overflow:visible;">
      <defs>
        <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>
      </defs>
      <!-- Baseline axis -->
      <line x1="20" y1="95" x2="${svgWidth - 10}" y2="95" stroke="var(--color-border)" stroke-width="1" />
      ${bars}
    </svg>
  `;
}

/**
 * Renders an SVG horizontal comparison chart of categories (Current vs Previous).
 */
function renderCategoryComparisonChart(breakdown = {}) {
  const activeCats = Object.values(breakdown).filter(c => c.current > 0 || c.previous > 0);
  if (activeCats.length === 0) {
    return `<div style="text-align:center;padding:24px;color:var(--color-text-faint);font-size:0.85rem;">No categorical activity in this window.</div>`;
  }

  const maxVal = Math.max(1, ...activeCats.flatMap(c => [c.current, c.previous]));
  const itemHeight = 32;
  const svgHeight = activeCats.length * itemHeight + 20;

  const rows = activeCats.map((cat, idx) => {
    const y = 15 + idx * itemHeight;
    const curW = Math.round((cat.current / maxVal) * 160);
    const prevW = Math.round((cat.previous / maxVal) * 160);

    return `
      <g transform="translate(10, ${y})">
        <text x="0" y="14" font-size="11" font-weight="500" fill="var(--color-text-primary)">${cat.category}</text>
        <!-- Previous bar -->
        <rect x="90" y="3" width="${prevW}" height="7" rx="3" fill="rgba(148, 163, 184, 0.35)" />
        <!-- Current bar -->
        <rect x="90" y="12" width="${curW}" height="7" rx="3" fill="${CATEGORY_COLORS[cat.category] || '#6366f1'}" />
        <!-- Values -->
        <text x="${95 + Math.max(curW, prevW)}" y="16" font-size="10" fill="var(--color-text-muted)">
          ${cat.current} <tspan fill="var(--color-text-faint)">(prev: ${cat.previous})</tspan>
        </text>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 380 ${svgHeight}" width="100%" height="100%">
      ${rows}
    </svg>
  `;
}

function attachPatternInteractivity() {
  // Pattern filter tabs
  document.getElementById("trends-pattern-filters")?.addEventListener("click", e => {
    const chip = e.target.closest(".trends-filter-chip");
    if (!chip) return;
    document.querySelectorAll(".trends-filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;

    document.querySelectorAll(".trends-pattern-card").forEach(card => {
      const type = card.dataset.type;
      let show = false;
      if (filter === "all") show = true;
      else if (filter === "SEQUENTIAL_PATTERN") show = type === "SEQUENTIAL_PATTERN";
      else if (filter === "SURGE_DECLINE") show = type.includes("SURGE") || type.includes("DECLINE");
      else if (filter === "STRATEGIC_SHIFT") show = type === "STRATEGIC_SHIFT" || type === "CROSS_CATEGORY_PATTERN";
      card.style.display = show ? "" : "none";
    });
  });

  // Evidence drawers
  document.getElementById("trends-pattern-list")?.addEventListener("click", e => {
    const btn = e.target.closest(".trends-evidence-toggle");
    if (!btn) return;
    const patId = btn.dataset.patId;
    const drawer = document.getElementById(`drawer-${patId}`);
    if (drawer) {
      const isOpen = drawer.classList.contains("open");
      drawer.classList.toggle("open", !isOpen);
      btn.classList.toggle("open", !isOpen);
    }
  });
}

function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatMarkdownReflection(md = "") {
  // Simple markdown renderer for headers, bold, bullets, and tables
  let html = md
    .replace(/^### (.*$)/gim, '<h4 style="margin:14px 0 6px;color:#a5b4fc;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="margin:16px 0 8px;color:#c7d2fe;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\* (.*$)/gim, '<li style="margin-left:18px;margin-bottom:4px;">$1</li>')
    .replace(/\n\n/g, '<p style="margin-bottom:8px;"></p>');
  return html;
}
