/**
 * app.js
 * ─────────────────────────────────────────────────────────────────
 * Main orchestration module — Phase 6: Backend Edition
 *
 * Data flow:
 *   db.js → Supabase (if configured) or mockData.js (fallback)
 *       ↓
 *   Component renderers
 *       ↓
 *   DOM
 *
 * Every button, filter, and interactive element is wired here.
 * ─────────────────────────────────────────────────────────────────
 */

import {
  getKPISummary,
  getCompetitors,
  getEventsByCompetitor,
  getAllEvents,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  getRecentActivity,
  getCategoryBreakdown,
  connectionTest,
} from "./data/db.js";

import { renderCompetitors, openCompetitorModal } from "./components/competitors.js";
import { openCompetitorDetail, closeCompetitorDetail } from "./components/competitor-detail.js";
import { openCollectIntelligenceModal } from "./components/collectModal.js";
import { renderActivity }   from "./components/activity.js";
import { renderCategories } from "./components/categories.js";
import { renderInsights }   from "./components/insights.js";
import { renderKPI }        from "./components/kpi.js";
import { renderTrends }     from "./components/trends.js";
import { aiInsights }       from "./data/mockData.js";
import { isConfigured }     from "./data/supabaseClient.js";
import { apiClient }        from "./data/apiClient.js";

// ── Module-level state ────────────────────────────────────────────
let _allCompetitors = [];   // Kept in sync after every CRUD op
let _backendOnline  = false;

// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════

function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      display:flex;flex-direction:column;gap:10px;pointer-events:none;
    `;
    document.body.appendChild(container);
  }

  const colors = {
    success: { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.35)", text: "#10b981", icon: "✅" },
    error:   { bg: "rgba(239,68,68,.12)",  border: "rgba(239,68,68,.35)",  text: "#ef4444", icon: "⚠️" },
    info:    { bg: "rgba(99,102,241,.12)", border: "rgba(99,102,241,.35)", text: "#6366f1", icon: "ℹ️" },
    warning: { bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.35)", text: "#f59e0b", icon: "⚡" },
  };
  const c = colors[type] ?? colors.info;

  const toast = document.createElement("div");
  toast.style.cssText = `
    background:${c.bg};border:1px solid ${c.border};color:${c.text};
    padding:12px 18px;border-radius:10px;font-size:0.85rem;font-weight:500;
    pointer-events:auto;cursor:pointer;max-width:320px;
    display:flex;align-items:center;gap:10px;
    animation:slideInRight 0.25s ease;box-shadow:0 4px 24px rgba(0,0,0,0.2);
    backdrop-filter:blur(8px);
  `;
  toast.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
  toast.onclick = () => toast.remove();

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Inject toast animations
(function injectToastStyles() {
  if (document.getElementById("toast-styles")) return;
  const s = document.createElement("style");
  s.id = "toast-styles";
  s.textContent = `
    @keyframes slideInRight { from { transform:translateX(120%); opacity:0; } to { transform:none; opacity:1; } }
    @keyframes fadeOut      { from { opacity:1; } to { opacity:0; transform:translateY(8px); } }
  `;
  document.head.appendChild(s);
})();

// ═══════════════════════════════════════════════════════════════════
// STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════

async function updateStatusIndicator() {
  const dot   = document.getElementById("db-status-dot");
  const label = document.getElementById("db-status-label");
  if (!dot || !label) return;

  if (isConfigured()) {
    dot.className   = "status-dot status-dot--live";
    label.textContent = "Supabase Live";
  } else {
    dot.className   = "status-dot status-dot--mock";
    label.textContent = "Mock Data";
  }

  // Also check backend
  const { data } = await apiClient.health().catch(() => ({ data: null }));
  _backendOnline = data?.status === "ok";
}

// ═══════════════════════════════════════════════════════════════════
// LOADING / ERROR HELPERS
// ═══════════════════════════════════════════════════════════════════

function showLoader(containerId, message = "Loading…") {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:24px;
        color:var(--color-text-muted);font-size:0.85rem;">
        <svg viewBox="0 0 24 24" fill="none" width="18" height="18"
             style="animation:spin 1s linear infinite;flex-shrink:0">
          <path d="M21 12a9 9 0 11-18 0" stroke="currentColor"
                stroke-width="2" stroke-linecap="round"/>
        </svg>
        ${message}
      </div>`;
  }
}

function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div style="padding:16px;border-radius:10px;
        background:rgba(239,68,68,.08);color:#ef4444;
        font-size:0.82rem;border:1px solid rgba(239,68,68,.2);">
        ⚠️ ${message}
      </div>`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════

async function handleExport() {
  const btn = document.getElementById("btn-export");
  if (btn) { btn.disabled = true; btn.textContent = "Exporting…"; }

  try {
    const { data: events } = await getAllEvents(1000);
    const { data: comps  } = await getCompetitors();

    // Build CSV
    const rows = [
      ["Competitor", "Date", "Category", "Title", "Description", "Importance", "Source"],
    ];

    const compMap = {};
    (comps ?? []).forEach(c => { compMap[c.id] = c.name; });

    (events ?? []).forEach(ev => {
      rows.push([
        compMap[ev.competitor_id] ?? ev.competitors?.name ?? "Unknown",
        ev.event_date,
        ev.category,
        `"${(ev.title        ?? "").replace(/"/g, '""')}"`,
        `"${(ev.description  ?? "").replace(/"/g, '""')}"`,
        ev.importance,
        ev.source_name ?? "",
      ]);
    });

    const csv     = rows.map(r => r.join(",")).join("\n");
    const blob    = new Blob([csv], { type: "text/csv" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = `ci-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${(events ?? []).length} events as CSV`, "success");
  } catch (err) {
    console.error("[export] Error:", err);
    showToast("Export failed: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
        <path d="M8 1v8M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Export`; }
  }
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS PANEL
// ═══════════════════════════════════════════════════════════════════

function toggleNotifications() {
  document.getElementById("settings-panel")?.remove();
  let panel = document.getElementById("notif-panel");
  if (panel) { panel.remove(); return; }

  panel = document.createElement("div");
  panel.id = "notif-panel";
  panel.style.cssText = `
    position:fixed;top:56px;right:16px;width:340px;max-height:420px;
    background:var(--color-surface-1,#1a1a2e);border:1px solid var(--color-border,rgba(255,255,255,.1));
    border-radius:12px;z-index:1000;overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,.4);backdrop-filter:blur(16px);
  `;
  panel.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--color-border,rgba(255,255,255,.1));
      display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:0.9rem;color:var(--color-text,#fff)">🔔 Notifications</span>
      <button onclick="document.getElementById('notif-panel')?.remove()"
        style="background:none;border:none;cursor:pointer;color:var(--color-text-muted,#888);font-size:1rem">✕</button>
    </div>
    <div style="padding:12px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:350px;">
      ${[
        { icon:"🚀", title:"NovaTech AI launched NovaMind 3.0", time:"2 hours ago", color:"#6366f1" },
        { icon:"💰", title:"Helios Data raised $31M Series A",  time:"30 min ago",  color:"#f59e0b" },
        { icon:"🏷️", title:"PulseCRM reduced Pro plan by 20%",  time:"5 hours ago", color:"#10b981" },
      ].map(n => `
        <div style="padding:10px 12px;border-radius:8px;background:var(--color-surface-2,rgba(255,255,255,.05));
          display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:1.2rem;flex-shrink:0">${n.icon}</span>
          <div>
            <div style="font-size:0.83rem;color:var(--color-text,#fff);font-weight:500">${n.title}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted,#888);margin-top:2px">${n.time}</div>
          </div>
        </div>`).join("")}
      <div style="text-align:center;padding:8px;font-size:0.78rem;color:var(--color-text-faint,#666)">
        Live alerts will appear here when connected
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== "btn-notifications") {
        panel.remove();
        document.removeEventListener("click", handler);
      }
    });
  }, 10);
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════

function toggleSettings() {
  document.getElementById("notif-panel")?.remove();
  let panel = document.getElementById("settings-panel");
  if (panel) { panel.remove(); return; }

  panel = document.createElement("div");
  panel.id = "settings-panel";
  panel.style.cssText = `
    position:fixed;top:56px;right:16px;width:320px;
    background:var(--color-surface-1,#1a1a2e);border:1px solid var(--color-border,rgba(255,255,255,.1));
    border-radius:12px;z-index:1000;overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,.4);backdrop-filter:blur(16px);
  `;

  const supaOk  = isConfigured();
  const backOk  = _backendOnline;

  panel.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--color-border,rgba(255,255,255,.1));
      display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:0.9rem;color:var(--color-text,#fff)">⚙️ Settings</span>
      <button onclick="document.getElementById('settings-panel')?.remove()"
        style="background:none;border:none;cursor:pointer;color:var(--color-text-muted,#888);font-size:1rem">✕</button>
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">

      <div style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
        color:var(--color-text-faint,#666);margin-bottom:4px;">Connection Status</div>

      ${[
        { label:"Supabase",  ok: supaOk,  note: supaOk  ? "Connected" : "Using mock data" },
        { label:"Backend",   ok: backOk,  note: backOk  ? "Running on :3000" : "Not detected" },
        { label:"Hindsight", ok: false,   note: "Pending — Phase 6 Hindsight" },
      ].map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:8px 12px;border-radius:8px;background:var(--color-surface-2,rgba(255,255,255,.05))">
          <span style="font-size:0.84rem;color:var(--color-text,#fff)">${s.label}</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:0.78rem;
            color:${s.ok ? "#10b981" : "#94a3b8"}">
            <span style="width:7px;height:7px;border-radius:50%;background:${s.ok ? "#10b981" : "#475569"};display:inline-block"></span>
            ${s.note}
          </span>
        </div>`).join("")}

      <div style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
        color:var(--color-text-faint,#666);margin-top:4px;">Actions</div>

      <button onclick="window.__ciTest && window.__ciTest().then(r=>console.log(r))"
        style="width:100%;padding:9px 14px;border-radius:8px;font-size:0.83rem;cursor:pointer;
          background:var(--color-surface-2,rgba(255,255,255,.05));
          border:1px solid var(--color-border,rgba(255,255,255,.1));
          color:var(--color-text,#fff);text-align:left;">
        🔌 Run Connection Test (Console)
      </button>

      <button onclick="document.getElementById('settings-panel')?.remove(); window.location.reload();"
        style="width:100%;padding:9px 14px;border-radius:8px;font-size:0.83rem;cursor:pointer;
          background:var(--color-surface-2,rgba(255,255,255,.05));
          border:1px solid var(--color-border,rgba(255,255,255,.1));
          color:var(--color-text,#fff);text-align:left;">
        🔄 Reload Dashboard
      </button>

      <div style="font-size:0.73rem;color:var(--color-text-faint,#666);text-align:center;padding-top:4px">
        CI Agent v1.0 · Backend Foundation Phase
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== "btn-settings") {
        panel.remove();
        document.removeEventListener("click", handler);
      }
    });
  }, 10);
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════

let _searchInitialized = false;

function initSearch() {
  if (_searchInitialized) return;
  _searchInitialized = true;
  const input = document.getElementById("global-search");
  if (!input) return;

  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = e.target.value.trim().toLowerCase();
      filterDashboard(q);
    }, 200);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { input.value = ""; filterDashboard(""); input.blur(); }
  });
}

function filterDashboard(query) {
  // Filter competitor cards
  document.querySelectorAll(".competitor-card").forEach(card => {
    const name = card.querySelector(".comp-name")?.textContent.toLowerCase() ?? "";
    const domain = card.querySelector(".comp-domain")?.textContent.toLowerCase() ?? "";
    const tags  = card.querySelector(".competitor-card__tags")?.textContent.toLowerCase() ?? "";
    card.style.display = (!query || name.includes(query) || domain.includes(query) || tags.includes(query)) ? "" : "none";
  });

  // Filter activity items
  document.querySelectorAll(".activity-item").forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = (!query || text.includes(query)) ? "" : "none";
  });

  // Filter insight cards
  document.querySelectorAll(".insight-card").forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = (!query || text.includes(query)) ? "" : "none";
  });
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD INIT
// ═══════════════════════════════════════════════════════════════════

async function initDashboard() {
  await updateStatusIndicator();
  initMemoryPanel();

  // Show spinners immediately
  ["kpi-container","competitors-container","activity-container",
   "categories-container","insights-container"].forEach(id =>
    showLoader(id, "Fetching data…")
  );

  // Fetch all data in parallel
  const [kpiResult, competitorsResult, activityResult, categoriesResult] =
    await Promise.all([
      getKPISummary(),
      getCompetitors(),
      getRecentActivity(10),
      getCategoryBreakdown(),
    ]);

  // ── KPI ──────────────────────────────────────────────────────────
  if (kpiResult.error) {
    showError("kpi-container", `KPI load failed: ${kpiResult.error.message}`);
  } else {
    renderKPI("kpi-container", kpiResult.data);
  }

  // ── Competitors ───────────────────────────────────────────────────
  if (competitorsResult.error) {
    showError("competitors-container", `Competitors load failed: ${competitorsResult.error.message}`);
  } else {
    _allCompetitors = await loadCompetitorsWithStats(competitorsResult.data);
    renderCompetitors("competitors-container", _allCompetitors, {
      onAdd:      ()     => openAddModal(),
      onEdit:     (comp) => openEditModal(comp),
      onDelete:   (comp) => handleDelete(comp),
      onCollect:  (comp) => handleQuickCollectIntelligence(comp),
      onCardClick:(comp) => openCompetitorDetail(comp, _allCompetitors, {
        onEdit:   (c) => openEditModal(c),
        onDelete: (c) => handleDelete(c),
        onCollect:(c) => handleCollectIntelligence(c),
      }),
    });
  }

  // ── Activity ──────────────────────────────────────────────────────
  if (activityResult.error) {
    showError("activity-container", `Activity load failed: ${activityResult.error.message}`);
  } else {
    renderActivity("activity-container", activityResult.data);
  }

  // ── Categories ────────────────────────────────────────────────────
  if (categoriesResult.error) {
    showError("categories-container", `Categories load failed: ${categoriesResult.error.message}`);
  } else {
    renderCategories("categories-container", categoriesResult.data);
  }

  // ── AI Insights ───────────────────────────────────────────────────
  renderInsights("insights-container", aiInsights);

  // ── Competitive Trends & Patterns (Phase 10) ──────────────────────
  renderTrends("trends-container", _allCompetitors);

  // ── Wire all UI after render ──────────────────────────────────────
  initNavigation();
  initSearch();
  initQuickActions();
  initInsightActions();
  updatePageSubtitle();
}

function initQuickActions() {
  document.getElementById("qa-add-competitor")?.addEventListener("click", () => {
    openAddModal();
  });
  document.getElementById("qa-sync-memory")?.addEventListener("click", () => {
    document.getElementById("btn-sync-hindsight")?.click();
  });
  document.getElementById("qa-export-csv")?.addEventListener("click", () => {
    document.getElementById("btn-export")?.click();
  });
  document.getElementById("qa-refresh-data")?.addEventListener("click", () => {
    document.getElementById("btn-refresh")?.click();
  });
}

// ── Update page subtitle to reflect data source ───────────────────
function updatePageSubtitle() {
  const sub = document.querySelector(".page-subtitle");
  if (!sub) return;
  if (isConfigured()) {
    sub.textContent = "Real-time monitoring · Supabase connected · Backend ready";
  } else {
    sub.textContent = "Real-time monitoring · Mock data mode · Backend ready";
  }
}

// ═══════════════════════════════════════════════════════════════════
// INSIGHT ACTIONS
// ═══════════════════════════════════════════════════════════════════

function initInsightActions() {
  // "Take Action →" buttons
  document.querySelectorAll(".insight-actions .btn-primary").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card  = e.target.closest(".insight-card");
      const title = card?.querySelector(".insight-title")?.textContent ?? "this insight";
      showToast(`Action noted for: "${title.substring(0,50)}…" — AI workflow coming in next phase`, "info", 4000);
    });
  });

  // "Generate New Insight" button — make it interactive
  const genBtn = document.getElementById("btn-generate-insight");
  if (genBtn) {
    genBtn.disabled = false;
    genBtn.title    = "AI insight generation — coming in next phase";
    genBtn.addEventListener("click", () => {
      genBtn.disabled = true;
      genBtn.textContent = "Analyzing…";
      showToast("🤖 AI insight generation will be enabled when Hindsight is connected", "info", 4000);
      setTimeout(() => {
        genBtn.disabled = false;
        genBtn.innerHTML = `
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          Generate`;
      }, 2000);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITOR NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

function normaliseCompetitor(c) {
  if (c.logo && c.domain && c.metrics) return c;

  const initials = c.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const PALETTE  = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#0ea5e9","#ec4899","#14b8a6"];
  const colorIdx = c.name.charCodeAt(0) % PALETTE.length;
  let domain     = "—";
  try { domain   = c.website ? new URL(c.website).hostname.replace("www.", "") : c.name.toLowerCase().replace(/\s+/g, ".") + ".com"; }
  catch { domain = c.name.toLowerCase().replace(/\s+/g, ".") + ".com"; }

  return {
    ...c,
    logo:        initials,
    logoColor:   PALETTE[colorIdx],
    domain,
    category:    "Direct",
    threatLevel: "medium",
    score:       50,
    change:      0,
    lastActivity:"—",
    founded:     "—",
    employees:   "—",
    funding:     "—",
    tags:        c.industry ? [c.industry] : [],
    metrics:     { marketShare: 0, growthRate: 0, customerRating: 0 },
  };
}

async function loadCompetitorsWithStats(competitors) {
  return Promise.all(competitors.map(async competitor => {
    const normalized = normaliseCompetitor(competitor);
    const { data, error } = await getEventsByCompetitor(normalized.id);
    if (error || !data) return { ...normalized, eventCount: null };

    const latestEvent = data[0];
    return {
      ...normalized,
      eventCount: data.length,
      lastActivity: latestEvent
        ? formatRelativeActivity(latestEvent.event_date || latestEvent.created_at)
        : (normalized.lastActivity || "—"),
    };
  }));
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITOR CRUD
// ═══════════════════════════════════════════════════════════════════

async function reloadCompetitors() {
  showLoader("competitors-container", "Refreshing competitors…");
  const { data, error } = await getCompetitors();
  if (error) {
    showError("competitors-container", `Reload failed: ${error.message}`);
    return;
  }
  _allCompetitors = await loadCompetitorsWithStats(data);
  renderCompetitors("competitors-container", _allCompetitors, {
    onAdd:      ()     => openAddModal(),
    onEdit:     (comp) => openEditModal(comp),
    onDelete:   (comp) => handleDelete(comp),
    onCollect:  (comp) => handleQuickCollectIntelligence(comp),
    onCardClick:(comp) => openCompetitorDetail(comp, _allCompetitors, {
      onEdit:   (c) => openEditModal(c),
      onDelete: (c) => handleDelete(c),
      onCollect:(c) => handleCollectIntelligence(c),
    }),
  });
  renderTrends("trends-container", _allCompetitors);
}

/**
 * Handles "Collect Intelligence" action for a competitor.
 * Opens the Phase 9 Intelligence Collection modal, and refreshes activity/KPI when complete.
 */
function handleCollectIntelligence(comp) {
  openCollectIntelligenceModal(comp, async (report) => {
    const newCount = report.summary?.newEvents ?? 0;
    if (newCount > 0) {
      showToast(`Ingested ${newCount} new intelligence events for ${comp.name}!`, "success");
      // Refresh activity and KPI cards in background
      try {
        const [actRes, kpiRes] = await Promise.all([
          getRecentActivity(10),
          getKPISummary(),
        ]);
        if (!actRes.error && actRes.data) renderActivity("activity-container", actRes.data);
        if (!kpiRes.error && kpiRes.data) renderKPI("kpi-container", kpiRes.data);
      } catch (refreshErr) {
        console.warn("[app] Background refresh error:", refreshErr);
      }
    }
  });
}

async function handleQuickCollectIntelligence(comp) {
  try {
    const result = await apiClient.collectIntelligence({ competitorId: comp.id });
    if (!result.data || result.error || result.data.ok === false) {
      throw new Error(result.error || result.data?.message || "The collection request failed.");
    }

    const newEvents = result.data.summary?.newEvents ?? result.data.createdEvents?.length ?? 0;
    const memoryCount = result.data.summary?.memoriesAdded ?? 0;
    showToast(
      newEvents > 0
        ? `Collected ${newEvents} new intelligence event${newEvents === 1 ? "" : "s"} for ${comp.name}; ${memoryCount} retained in Hindsight.`
        : `Collection completed for ${comp.name}; no new events were found.`,
      "success",
      5000,
    );

    const [eventsResult, activityResult, kpiResult] = await Promise.all([
      getEventsByCompetitor(comp.id),
      getRecentActivity(10),
      getKPISummary(),
    ]);

    if (!eventsResult.error && eventsResult.data) {
      const events = eventsResult.data;
      const latestEvent = events[0];
      const lastActivity = formatRelativeActivity(latestEvent?.event_date || latestEvent?.created_at);
      _allCompetitors = _allCompetitors.map(item => item.id === comp.id
        ? { ...item, eventCount: events.length, lastActivity }
        : item);
      const card = [...document.querySelectorAll(".competitor-card")]
        .find(item => item.dataset.id === comp.id);
      if (card) {
        const count = card.querySelector(".comp-event-count");
        const activity = card.querySelector(".comp-activity-time");
        if (count) count.textContent = `📊 ${events.length} event${events.length === 1 ? "" : "s"}`;
        if (activity) activity.textContent = `🕐 ${lastActivity}`;
      }
    } else if (eventsResult.error) {
      console.warn("[app] Competitor event refresh failed:", eventsResult.error);
    }

    if (!activityResult.error && activityResult.data) {
      renderActivity("activity-container", activityResult.data);
    }
    if (!kpiResult.error && kpiResult.data) {
      renderKPI("kpi-container", kpiResult.data);
    }
  } catch (error) {
    console.error(`[app] Intelligence collection failed for ${comp.name}:`, error);
    showToast(`Intelligence collection failed: ${error.message}`, "error", 6500);
  }
}

function formatRelativeActivity(value) {
  if (!value) return "—";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

function openAddModal() {
  openCompetitorModal(null, async (payload) => {
    const { error } = await createCompetitor(payload);
    if (error) throw new Error(error.message ?? "Failed to create competitor.");
    showToast(`${payload.name} added successfully`, "success");
    await reloadCompetitors();
  });
}

function openEditModal(comp) {
  const dbFields = {
    id:          comp.id,
    name:        comp.name,
    website:     comp.website   ?? "",
    industry:    comp.industry  ?? "",
    description: comp.description ?? "",
  };
  openCompetitorModal(dbFields, async (payload, id) => {
    const { error } = await updateCompetitor(id, payload);
    if (error) throw new Error(error.message ?? "Failed to update competitor.");
    showToast(`${payload.name} updated`, "success");
    await reloadCompetitors();
  });
}

// ─── Auto-retain event in Hindsight after Supabase insert ────────
async function autoRetainEvent(event, competitorName) {
  try {
    const { data } = await apiClient.retain({ event, competitorName });
    if (data?.status === "retained") {
      console.log(`[memory] ✅ Event retained in Hindsight: ${event.id}`);
    } else if (data?.status === "skipped") {
      console.log(`[memory] ⏭ Event already in memory: ${event.id}`);
    } else if (data?.status === "not_configured") {
      console.info("[memory] Hindsight not configured — skipping retain");
    }
  } catch (err) {
    // Non-fatal — Supabase is source of truth, Hindsight is memory layer
    console.warn("[memory] Auto-retain failed (non-fatal):", err.message);
  }
}

async function handleDelete(comp) {
  const confirmed = window.confirm(
    `Delete "${comp.name}"?\n\nThis will also remove all associated events and cannot be undone.`
  );
  if (!confirmed) return;

  const { error } = await deleteCompetitor(comp.id);
  if (error) {
    showToast("Delete failed: " + error.message, "error");
    return;
  }
  closeCompetitorDetail();
  showToast(`${comp.name} deleted`, "warning");
  await reloadCompetitors();
}

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT MEMORY PANEL
// ═══════════════════════════════════════════════════════════════════

let _memoryPanelWired = false;

async function updateMemoryStatus() {
  const dot   = document.getElementById("hindsight-status-dot");
  const label = document.getElementById("hindsight-status-label");
  const sub   = document.getElementById("memory-subtitle");

  try {
    const { data: statusRes, error } = await apiClient.status();

    if (error || !statusRes || !statusRes.connected) {
      if (dot) dot.className = "status-dot status-dot--error";
      const errMsg = error || statusRes?.error || "Could not connect to Hindsight";
      if (label) {
        label.textContent = "Connection Error";
        label.title       = errMsg;
      }
      if (sub) {
        sub.textContent = `Connection Error: ${errMsg}`;
      }
    } else {
      if (dot) dot.className = "status-dot status-dot--live-hindsight";
      if (label) {
        label.textContent = "Connected";
        label.title       = `Connected to memory bank: ${statusRes.bankId}`;
      }
      if (sub) {
        sub.textContent = `Memory bank: ${statusRes.bankId} · Ask about competitor history`;
      }
    }
  } catch (err) {
    if (dot) dot.className = "status-dot status-dot--error";
    const msg = err.message || "Failed to check status";
    if (label) {
      label.textContent = "Connection Error";
      label.title       = msg;
    }
    if (sub) {
      sub.textContent = `Connection Error: ${msg}`;
    }
  }
}

let _conversationHistory = [];

async function initMemoryPanel() {
  // ── Update Hindsight status indicator ────────────────────────────
  await updateMemoryStatus();

  if (_memoryPanelWired) return;
  _memoryPanelWired = true;

  // ── Show initial empty state ──────────────────────────────────────
  renderMemoryEmpty();

  // ── Ask Agent / Recall button ─────────────────────────────────────
  const triggerQuery = () => {
    const q = document.getElementById("memory-query-input")?.value.trim();
    if (q) askCompetitiveIntelligenceAgent(q);
    else showToast("Enter a question for the agent first", "warning");
  };

  document.getElementById("btn-ask-agent")?.addEventListener("click", triggerQuery);
  document.getElementById("btn-recall-memory")?.addEventListener("click", triggerQuery);

  // ── Enter key in input ────────────────────────────────────────────
  document.getElementById("memory-query-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      triggerQuery();
    }
  });

  // ── Quick query chips ─────────────────────────────────────────────
  document.querySelectorAll(".memory-quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      const input = document.getElementById("memory-query-input");
      if (input) input.value = q;
      askCompetitiveIntelligenceAgent(q);
    });
  });

  // ── Sync button ───────────────────────────────────────────────────
  document.getElementById("btn-sync-hindsight")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-sync-hindsight");
    if (btn) { btn.disabled = true; btn.textContent = "Syncing…"; }
    showToast("Syncing events to Hindsight memory…", "info", 3000);

    const { data, error } = await apiClient.sync();
    if (btn) {
      btn.disabled    = false;
      btn.innerHTML   = `<svg viewBox="0 0 16 16" fill="none" width="12" height="12">
        <path d="M14 8A6 6 0 112 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M14 4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg> Sync Events to Memory`;
    }

    if (error || !data) {
      showToast("Sync failed: " + (error ?? "Unknown error"), "error");
      return;
    }

    if (data.status === "not_configured") {
      showToast("Add HINDSIGHT_API_KEY to .env to enable sync", "warning", 5000);
      return;
    }

    showToast(
      `✅ Sync complete: ${data.successful ?? 0} retained, ${data.failed ?? 0} failed`,
      data.failed > 0 ? "warning" : "success",
      5000
    );
  });
}

function renderMemoryEmpty() {
  const results = document.getElementById("memory-results");
  if (!results) return;
  results.innerHTML = `
    <div class="memory-empty">
      <div class="memory-empty-icon">🤖</div>
      <div style="font-weight:600;font-size:0.92rem;color:var(--color-text);">Competitive Intelligence Agent Ready</div>
      <div style="margin-top:6px;font-size:0.8rem;color:var(--color-text-muted);">
        Ask any question above or click a suggestion chip. The agent reasons over Hindsight long-term memories and structured Supabase events.
      </div>
    </div>`;
}

async function askCompetitiveIntelligenceAgent(query) {
  const results = document.getElementById("memory-results");
  const askBtn  = document.getElementById("btn-ask-agent") || document.getElementById("btn-recall-memory");
  if (!results) return;

  results.innerHTML = `
    <div class="memory-query-echo">🔍 "${escapeHtml(query)}"</div>
    <div class="memory-loading">
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"
           style="animation:spin 1s linear infinite;flex-shrink:0">
        <path d="M21 12a9 9 0 11-18 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div>
        <div style="font-weight:600;color:var(--color-text);">Agent is analyzing competitive intelligence…</div>
        <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">
          Searching Hindsight long-term memories & retrieving structured events
        </div>
      </div>
    </div>`;

  if (askBtn) askBtn.disabled = true;

  try {
    const { data, error } = await apiClient.askAgent({
      message: query,
      conversationHistory: _conversationHistory.slice(-8),
    });

    if (error || !data) {
      throw new Error(error || "No response received from agent.");
    }

    if (data.status === "error") {
      throw new Error(data.message || "Agent execution failed.");
    }

    // Save to conversation history for contextual follow-ups (e.g. "What about its pricing?")
    _conversationHistory.push({ role: "user", content: query });
    _conversationHistory.push({ role: "agent", content: data.answer });

    renderAgentResponse(results, query, data);
  } catch (err) {
    results.innerHTML = `
      <div class="memory-query-echo">🔍 "${escapeHtml(query)}"</div>
      <div class="memory-error">
        <strong>❌ Agent Execution Error</strong>
        <div style="margin-top:4px;">${escapeHtml(err.message)}</div>
      </div>`;
  } finally {
    if (askBtn) askBtn.disabled = false;
  }
}

function renderAgentResponse(container, query, data) {
  const engineBadge = data.engine ? `<span class="agent-engine-badge">⚡ ${escapeHtml(data.engine)}</span>` : "";
  const timeBadge = data.executionTimeMs ? `<span style="font-size:0.72rem;color:var(--color-text-faint);">⏱️ ${data.executionTimeMs}ms</span>` : "";

  // 1. Direct Answer
  const answerHtml = `
    <div class="agent-answer-box">
      <div class="agent-answer-title">
        <span>💡</span> Executive Answer
      </div>
      <div class="agent-answer-text">${escapeHtml(data.answer)}</div>
    </div>`;

  // 2. Key Findings
  let findingsHtml = "";
  if (Array.isArray(data.keyFindings) && data.keyFindings.length > 0) {
    findingsHtml = `
      <div class="agent-section">
        <div class="agent-section-label">📌 Key Observed Findings</div>
        <ul class="agent-findings-list">
          ${data.keyFindings.map(f => `<li class="agent-finding-item">${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>`;
  }

  // 3. Observed Timeline
  let timelineHtml = "";
  if (Array.isArray(data.timeline) && data.timeline.length > 0) {
    timelineHtml = `
      <div class="agent-section">
        <div class="agent-section-label">⏱️ Observed Timeline</div>
        <div class="agent-timeline">
          ${data.timeline.map(t => `
            <div class="agent-timeline-node">
              <div class="agent-timeline-date">${escapeHtml(t.date || 'Historical')} · ${escapeHtml(t.competitor || '')}</div>
              <div class="agent-timeline-title">${escapeHtml(t.title)} <span style="font-size:0.7rem;color:var(--color-text-faint);">[${escapeHtml(t.category || '')}]</span></div>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  // 4. Strategic Patterns & Trends
  let patternsHtml = "";
  if (data.patterns) {
    patternsHtml = `
      <div class="agent-pattern-box">
        <div class="agent-pattern-badge">🔍 Observed Patterns & Interpretation</div>
        <div style="font-size:0.86rem;line-height:1.55;">${escapeHtml(data.patterns)}</div>
      </div>`;
  }

  // 5. Evidence & Sources
  let evidenceHtml = "";
  if (Array.isArray(data.evidence) && data.evidence.length > 0) {
    const cards = data.evidence.slice(0, 8).map(ev => {
      const typeLabel = ev.sourceType === "memory" ? "🧠 Hindsight Memory" : "📄 Supabase Event";
      const meta = [
        ev.date ? `📅 ${ev.date}` : null,
        ev.competitor ? `🏢 ${ev.competitor}` : null,
        ev.category ? `🏷️ ${ev.category}` : null,
        ev.source ? `📰 ${ev.source}` : null,
      ].filter(Boolean).join(" · ");

      return `
        <div class="agent-evidence-card">
          <div class="agent-evidence-top">
            <span class="agent-evidence-type">${typeLabel}</span>
            ${ev.importance ? `<span style="font-size:0.68rem;color:var(--color-text-faint);">${escapeHtml(ev.importance)}</span>` : ""}
          </div>
          <div class="agent-evidence-title">${escapeHtml(ev.title || ev.text || '')}</div>
          <div class="agent-evidence-meta">${escapeHtml(meta)}</div>
        </div>`;
    }).join("");

    evidenceHtml = `
      <div class="agent-section">
        <div class="agent-section-label">📚 Underlying Evidence & Citations (${data.evidence.length} sources)</div>
        <div class="agent-evidence-grid">
          ${cards}
        </div>
      </div>`;
  }

  // 6. Uncertainty & Limitations
  let uncertaintyHtml = "";
  if (data.uncertainty) {
    uncertaintyHtml = `
      <div class="agent-uncertainty-box">
        <strong>ℹ️ Data Scope & Uncertainty:</strong> ${escapeHtml(data.uncertainty)}
      </div>`;
  }

  container.innerHTML = `
    <div class="agent-response-wrap">
      <div class="agent-header-row">
        <div><strong>Investigating:</strong> "${escapeHtml(query)}"</div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${engineBadge}
          ${timeBadge}
        </div>
      </div>
      ${answerHtml}
      ${findingsHtml}
      ${timelineHtml}
      ${patternsHtml}
      ${evidenceHtml}
      ${uncertaintyHtml}
    </div>`;
}

// Keep backward-compatible runRecall for direct recall callers
async function runRecall(query) {
  return askCompetitiveIntelligenceAgent(query);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════

let _navigationInitialized = false;

function initNavigation() {
  if (_navigationInitialized) return;
  _navigationInitialized = true;
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar    = document.getElementById("sidebar");

  // Mobile sidebar toggle
  menuToggle?.addEventListener("click", () => sidebar?.classList.toggle("sidebar--open"));

  // Nav link scroll + active state
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (sidebar) sidebar.classList.remove("sidebar--open");
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  document.querySelectorAll(".nav-link[data-section]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(link.dataset.section)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById("btn-refresh");
  refreshBtn?.addEventListener("click", () => {
    refreshBtn.disabled = true;
    showToast("Refreshing data…", "info", 1500);
    initDashboard().finally(() => { refreshBtn.disabled = false; });
  });

  // Export button
  document.getElementById("btn-export")
    ?.addEventListener("click", handleExport);

  // Notifications button
  document.getElementById("btn-notifications")
    ?.addEventListener("click", (e) => { e.stopPropagation(); toggleNotifications(); });

  // Settings button
  document.getElementById("btn-settings")
    ?.addEventListener("click", (e) => { e.stopPropagation(); toggleSettings(); });

  // Sidebar "Add Competitor" shortcut
  document.getElementById("sidebar-add-competitor")
    ?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("sidebar--open");
      document.getElementById("section-competitors")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => openAddModal(), 300);
    });

  // User avatar — show quick profile toast
  document.querySelectorAll(".user-avatar").forEach(el => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      showToast("👤 User profiles will be available in a future phase", "info");
    });
  });

  // ⌘K shortcut — focus search
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("global-search")?.focus();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", initDashboard);

// Expose helpers to browser console
window.__ciTest  = connectionTest;
window.__ciAPI   = apiClient;
window.__toast   = showToast;
