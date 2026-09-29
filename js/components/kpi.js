/**
 * kpi.js
 * Renders the KPI summary strip at the top of the dashboard.
 * Data contract: expects the `kpiSummary` object from mockData.js
 */

const KPI_ITEMS = [
  {
    key: "totalCompetitors",
    label: "Competitors Tracked",
    icon: `<svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    color: "#6366f1",
  },
  {
    key: "activeAlerts",
    label: "Active Alerts",
    icon: `<svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    color: "#ef4444",
  },
  {
    key: "eventsThisWeek",
    label: "Events This Week",
    icon: `<svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,
    color: "#f59e0b",
  },
  {
    key: "insightsGenerated",
    label: "Insights Generated",
    icon: `<svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M12 2L15 9H22L16.5 13.5L18.5 21L12 17L5.5 21L7.5 13.5L2 9H9L12 2Z"
        stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`,
    color: "#10b981",
  },
];

export function renderKPI(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const lastUpdated = new Date(data.lastRefreshed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  container.innerHTML = `
    <div class="kpi-strip">
      ${KPI_ITEMS.map(item => `
        <div class="kpi-card">
          <div class="kpi-icon" style="--kpi-color:${item.color}">
            ${item.icon}
          </div>
          <div class="kpi-body">
            <div class="kpi-value counter" data-target="${data[item.key]}">${data[item.key]}</div>
            <div class="kpi-label">${item.label}</div>
          </div>
        </div>
      `).join("")}
      <div class="kpi-refresh">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" class="kpi-refresh__icon">
          <path d="M14 8A6 6 0 112 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M14 4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="kpi-refresh__text">
          <div class="kpi-refresh__label">Last synced</div>
          <div class="kpi-refresh__time">${lastUpdated}</div>
        </div>
      </div>
    </div>
  `;
}
