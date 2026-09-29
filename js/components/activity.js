/**
 * activity.js
 * Renders the Recent Activity feed panel.
 * Data contract: expects an array matching the `recentActivity` shape from mockData.js
 */

const ACTIVITY_TYPE_CONFIG = {
  product_launch: { icon: "🚀", label: "Product Launch", class: "type-product" },
  funding:        { icon: "💰", label: "Funding",        class: "type-funding" },
  pricing:        { icon: "🏷️", label: "Pricing Change", class: "type-pricing" },
  partnership:    { icon: "🤝", label: "Partnership",    class: "type-partner" },
  hiring:         { icon: "👥", label: "Hiring Signal",  class: "type-hiring" },
  content:        { icon: "📢", label: "Content / PR",   class: "type-content" },
};

const IMPACT_CONFIG = {
  high:   { label: "High Impact",   class: "impact-high" },
  medium: { label: "Med Impact",    class: "impact-medium" },
  low:    { label: "Low Impact",    class: "impact-low" },
};

function renderActivityItem(item) {
  const typeConf = ACTIVITY_TYPE_CONFIG[item.type] || { icon: "📌", label: item.type || "Event", class: "" };
  const impConf = IMPACT_CONFIG[item.impact] || { label: item.impact || "Medium", class: "impact-medium" };
  const dateStr = item.relativeTime || item.date || "Recent";

  return `
    <div class="activity-item activity-row" data-type="${item.type}" data-impact="${item.impact}">
      <div class="activity-row__date-col">
        <span class="activity-date-badge">${dateStr}</span>
        <span class="badge badge--category-mini ${typeConf.class}">${typeConf.icon} ${typeConf.label}</span>
      </div>
      <div class="activity-row__main">
        <div class="activity-row__header">
          <span class="activity-company-name">${item.competitorName}</span>
          <span class="activity-row-title">${item.title}</span>
          <span class="badge ${impConf.class} badge--mini">${impConf.label}</span>
        </div>
        ${item.summary ? `<p class="activity-row-desc">${item.summary}</p>` : ''}
        <div class="activity-row__meta">
          <span class="activity-source">📰 Source: ${item.source || 'Intelligence Feed'}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderActivity(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const types = ["all", ...Object.keys(ACTIVITY_TYPE_CONFIG)];

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Recent Activity</h2>
        <p class="section-subtitle">${data.length} events · Last 24 hours</p>
      </div>
      <div class="section-actions">
        <select class="select-input" id="activity-type-filter">
          ${types.map(t => `<option value="${t}">${
            t === "all" ? "All Types" : ACTIVITY_TYPE_CONFIG[t]?.label || t
          }</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="activity-feed" id="activity-list">
      ${data.map(renderActivityItem).join("")}
    </div>
  `;

  document.getElementById("activity-type-filter").addEventListener("change", (e) => {
    const val = e.target.value;
    document.querySelectorAll(".activity-item").forEach(item => {
      item.style.display = val === "all" || item.dataset.type === val ? "" : "none";
    });
  });
}
