/**
 * categories.js
 * Renders the Activity Categories breakdown panel.
 * Data contract: expects an array matching the `activityCategories` shape from mockData.js
 */

const PERIOD_LABELS = {
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
};

function renderCategoryRow(cat, maxCount) {
  const pct = Math.min((cat.count / maxCount) * 100, 100);
  const trendSign = cat.trend > 0 ? "+" : "";
  const trendClass = cat.trend > 0 ? "positive" : cat.trend < 0 ? "negative" : "neutral";

  return `
    <div class="category-row" style="--bar-color:${cat.color}">
      <div class="category-row__info">
        <span class="category-icon">${cat.icon}</span>
        <span class="category-label">${cat.label}</span>
      </div>
      <div class="category-row__bar">
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%; background:${cat.color}"></div>
        </div>
        <span class="cat-count">${cat.count}</span>
      </div>
      <div class="category-row__trend ${trendClass}">
        <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
          ${cat.trend >= 0
            ? '<path d="M5 2L9 8H1L5 2Z" fill="currentColor"/>'
            : '<path d="M5 8L9 2H1L5 8Z" fill="currentColor"/>'}
        </svg>
        <span>${trendSign}${cat.trend}%</span>
      </div>
    </div>
  `;
}

function renderDonutChart(categories) {
  const total = categories.reduce((s, c) => s + c.count, 0);
  let cumulative = 0;
  const segments = categories.map(cat => {
    const pct = (cat.count / total) * 100;
    const segment = { ...cat, pct, start: cumulative };
    cumulative += pct;
    return segment;
  });

  const circumference = 2 * Math.PI * 36;
  const paths = segments.map(seg => {
    const dashArray = (seg.pct / 100) * circumference;
    const offset = circumference - (seg.start / 100) * circumference;
    return `<circle
      class="donut-segment"
      cx="44" cy="44" r="36"
      fill="none"
      stroke="${seg.color}"
      stroke-width="14"
      stroke-dasharray="${dashArray} ${circumference - dashArray}"
      stroke-dashoffset="${offset}"
      transform="rotate(-90 44 44)"
    >
      <title>${seg.label}: ${seg.count}</title>
    </circle>`;
  }).join("");

  return `
    <div class="donut-wrapper">
      <svg viewBox="0 0 88 88" width="140" height="140" class="donut-chart">
        <circle cx="44" cy="44" r="36" fill="none" stroke="var(--color-surface-2)" stroke-width="14"/>
        ${paths}
        <text x="44" y="40" text-anchor="middle" class="donut-total">${total}</text>
        <text x="44" y="54" text-anchor="middle" class="donut-label">events</text>
      </svg>
      <div class="donut-legend">
        ${categories.map(c => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${c.color}"></span>
            <span class="legend-text">${c.label}</span>
            <span class="legend-pct">${Math.round((c.count / total) * 100)}%</span>
          </div>`).join("")}
      </div>
    </div>
  `;
}

export function renderCategories(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const maxCount = Math.max(...data.map(c => c.count));

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Activity Breakdown</h2>
        <p class="section-subtitle">By category · ${PERIOD_LABELS.month}</p>
      </div>
      <div class="section-actions">
        <div class="toggle-group" id="cat-view-toggle">
          <button class="toggle-btn active" data-view="bars">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor"/>
              <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/>
              <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <button class="toggle-btn" data-view="donut">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <div id="cat-view-bars" class="category-rows">
      ${data.map(cat => renderCategoryRow(cat, maxCount)).join("")}
    </div>
    <div id="cat-view-donut" class="category-donut" style="display:none">
      ${renderDonutChart(data)}
    </div>
  `;

  document.getElementById("cat-view-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    const view = btn.dataset.view;
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("cat-view-bars").style.display = view === "bars" ? "" : "none";
    document.getElementById("cat-view-donut").style.display = view === "donut" ? "" : "none";
  });

  // Animate bars on first render
  requestAnimationFrame(() => {
    document.querySelectorAll(".cat-bar-fill").forEach(el => {
      el.style.transition = "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
    });
  });
}
