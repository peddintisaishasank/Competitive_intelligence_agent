/**
 * insights.js
 * Renders the AI-Generated Insights panel.
 * Data contract: expects an array matching the `aiInsights` shape from mockData.js
 * NOTE: The "Generate New Insight" button is a placeholder for future AI integration.
 */

const INSIGHT_TYPE_CONFIG = {
  threat:      { icon: "⚠️", label: "Threat Alert",  class: "insight-threat" },
  opportunity: { icon: "✨", label: "Opportunity",   class: "insight-opportunity" },
  watch:       { icon: "👁️", label: "Watch Signal",  class: "insight-watch" },
};

const PRIORITY_CONFIG = {
  critical: { label: "Critical", class: "priority-critical" },
  high:     { label: "High",     class: "priority-high" },
  medium:   { label: "Medium",   class: "priority-medium" },
};

function renderInsightCard(insight) {
  const conf = insight.confidence ?? 85;
  const confLevel = conf >= 80 ? "High" : conf >= 60 ? "Medium" : "Low";
  const confClass = conf >= 80 ? "impact-high" : conf >= 60 ? "impact-medium" : "impact-low";

  return `
    <div class="ai-insight-card" data-id="${insight.id}">
      <div class="ai-insight-card__top">
        <div class="ai-insight-tag-group">
          <span class="ai-badge-inline" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">INSIGHT</span>
          <span class="badge ${confClass}">Confidence: ${confLevel} (${conf}%)</span>
        </div>
        <span class="ai-insight-date">${insight.relativeTime || 'Recent'}</span>
      </div>

      <h4 class="ai-insight-title">${insight.title}</h4>

      <div class="ai-insight-distinction-grid">
        <div class="ai-dist-row">
          <span class="ai-dist-label">Observation:</span>
          <span class="ai-dist-val">${insight.observation || insight.summary}</span>
        </div>
        <div class="ai-dist-row">
          <span class="ai-dist-label">Pattern:</span>
          <span class="ai-dist-val">${insight.pattern || (insight.recommendations && insight.recommendations[0]) || 'Sustained momentum in core category.'}</span>
        </div>
        <div class="ai-dist-row">
          <span class="ai-dist-label">Interpretation:</span>
          <span class="ai-dist-val">${insight.interpretation || (insight.recommendations && insight.recommendations[1]) || 'Signals proactive resource allocation and market push.'}</span>
        </div>
        <div class="ai-dist-row">
          <span class="ai-dist-label">Evidence:</span>
          <span class="ai-dist-val ai-dist-val--evidence">${insight.evidence || 'Verified competitor event logs & external citations'}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderInsights(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="section-header section-header--compact">
      <div>
        <h2 class="section-title">
          <span class="ai-badge-inline">AI</span>
          AI Insights
        </h2>
        <p class="section-subtitle">${data.length} active insights · Observation & patterns</p>
      </div>
    </div>
    <div class="insights-list-compact">
      ${data.map(renderInsightCard).join("")}
    </div>
  `;
}
