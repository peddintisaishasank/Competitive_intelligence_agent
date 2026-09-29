/**
 * js/components/collectModal.js
 * ─────────────────────────────────────────────────────────────────
 * Automated Competitor Intelligence Collection Modal (Phase 9)
 *
 * Responsibilities:
 *  - Prompts user to select or customize the external source URL.
 *  - Displays animated live pipeline steps:
 *      Fetching sources → Analyzing → Saving events → Updating memory → Complete
 *  - Displays detailed collection statistics:
 *      Sources checked, Items analyzed, Relevant items, New events, Duplicates skipped, Memories added
 *  - Shows rich cards for newly discovered events with source links & Hindsight status.
 *  - Connects directly to the Competitive Intelligence Agent for follow-up questions.
 * ─────────────────────────────────────────────────────────────────
 */

import { apiClient } from "../data/apiClient.js";

const MODAL_ID = "ci-collect-modal";

const PRESET_SOURCES = {
  "AgroTech AI": "http://localhost:3000/public-feeds/agrotech-announcements.xml",
  "FarmVision":  "http://localhost:3000/public-feeds/farmvision-announcements.xml",
  "TechCrunch":  "https://techcrunch.com/feed/",
  "BBC Tech":    "https://feeds.bbci.co.uk/news/technology/rss.xml",
  "GitHub Blog": "https://github.blog/feed/",
};

function ensureModal() {
  if (document.getElementById(MODAL_ID)) return;

  const div = document.createElement("div");
  div.id = MODAL_ID;
  div.className = "ci-modal-overlay";
  div.setAttribute("role", "dialog");
  div.setAttribute("aria-modal", "true");
  div.hidden = true;
  div.style.display = "none";
  div.style.pointerEvents = "none";
  div.style.visibility = "hidden";

  div.innerHTML = `
    <div class="ci-modal ci-collect-modal-window">
      <div class="ci-modal__header">
        <div class="ci-collect-modal-title-group">
          <div class="comp-avatar ci-collect-avatar" id="ci-col-avatar" style="--avatar-color:#3b82f6">🏆</div>
          <div>
            <h2 class="ci-modal__title" id="ci-col-title">Collect Competitor Intelligence</h2>
            <p class="ci-modal__subtitle" id="ci-col-subtitle">Fetch and structure external intelligence from public RSS or URLs</p>
          </div>
        </div>
        <button class="ci-modal__close" id="ci-col-close" aria-label="Close dialog">
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="ci-modal__body" id="ci-col-body">
        <!-- Configuration State -->
        <div id="ci-col-config-view">
          <div class="ci-form-group">
            <label class="ci-form-label" for="ci-col-source-input">Public Intelligence Source (RSS Feed or Article URL)</label>
            <input type="url" id="ci-col-source-input" class="ci-form-input"
                   placeholder="https://example.com/feed or https://example.com/news/article" />
            <span class="ci-form-hint">Enter an RSS 2.0 / Atom feed or a public article URL to extract verified activity.</span>
          </div>

          <div class="ci-form-group">
            <label class="ci-form-label">Fast Presets</label>
            <div class="ci-collect-presets" id="ci-col-presets"></div>
          </div>

          <div class="ci-collect-notice">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="flex-shrink:0;color:var(--color-primary)">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            <span>Events are verified, structured by AI, checked for duplicates, saved to Supabase, and retained in Hindsight long-term memory.</span>
          </div>
        </div>

        <!-- Progress State -->
        <div id="ci-col-progress-view" hidden>
          <div class="ci-collect-stepper">
            <div class="ci-stepper-item" id="step-fetch">
              <div class="ci-step-icon">1</div>
              <div class="ci-step-text">Fetching external source</div>
            </div>
            <div class="ci-stepper-item" id="step-analyze">
              <div class="ci-step-icon">2</div>
              <div class="ci-step-text">Analyzing & structuring with AI</div>
            </div>
            <div class="ci-stepper-item" id="step-validate">
              <div class="ci-step-icon">3</div>
              <div class="ci-step-text">Validating & checking duplicates</div>
            </div>
            <div class="ci-stepper-item" id="step-save">
              <div class="ci-step-icon">4</div>
              <div class="ci-step-text">Storing to Supabase & Hindsight memory</div>
            </div>
          </div>
          <div class="ci-collect-loading-msg" id="ci-col-loading-text">Collecting intelligence…</div>
        </div>

        <!-- Result State -->
        <div id="ci-col-result-view" hidden>
          <div class="ci-collect-summary-grid">
            <div class="ci-stat-card">
              <span class="ci-stat-num" id="stat-sources">1</span>
              <span class="ci-stat-lbl">Source Checked</span>
            </div>
            <div class="ci-stat-card">
              <span class="ci-stat-num" id="stat-items">0</span>
              <span class="ci-stat-lbl">Items Analyzed</span>
            </div>
            <div class="ci-stat-card">
              <span class="ci-stat-num text-success" id="stat-new">0</span>
              <span class="ci-stat-lbl">New Events Added</span>
            </div>
            <div class="ci-stat-card">
              <span class="ci-stat-num text-warning" id="stat-dups">0</span>
              <span class="ci-stat-lbl">Duplicates Skipped</span>
            </div>
            <div class="ci-stat-card">
              <span class="ci-stat-num" id="stat-rejected">0</span>
              <span class="ci-stat-lbl">Unrelated / Rejected</span>
            </div>
            <div class="ci-stat-card">
              <span class="ci-stat-num text-primary" id="stat-memories">0</span>
              <span class="ci-stat-lbl">Memories Retained</span>
            </div>
          </div>

          <div class="ci-collect-events-section">
            <h3 class="ci-section-h3" id="ci-col-events-heading">Newly Discovered Intelligence Events</h3>
            <div class="ci-collect-events-list" id="ci-col-events-container"></div>
          </div>
        </div>

        <!-- Error State -->
        <div id="ci-col-error-view" class="ci-form-server-error" style="margin-top:12px" hidden></div>
      </div>

      <div class="ci-modal__footer" id="ci-col-footer">
        <button type="button" class="btn-ghost btn-sm" id="ci-col-cancel-btn">Cancel</button>
        <button type="button" class="btn-primary btn-sm" id="ci-col-start-btn">
          <span>⚡ Start Collection</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(div);

  // Close bindings
  div.addEventListener("click", e => {
    if (e.target.id === MODAL_ID) closeCollectModal();
  });
  div.querySelector("#ci-col-close").addEventListener("click", closeCollectModal);
  div.querySelector("#ci-col-cancel-btn").addEventListener("click", closeCollectModal);
}

export function closeCollectModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove("ci-modal-overlay--visible");
  modal.style.display = "none";
  modal.style.pointerEvents = "none";
  modal.style.visibility = "hidden";

  const startBtn = document.getElementById("ci-col-start-btn");
  const cancelBtn = document.getElementById("ci-col-cancel-btn");
  if (startBtn) startBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = false;
}

/**
 * Opens the intelligence collection modal for a specific competitor.
 *
 * @param {object} competitor  - Selected competitor { id, name, website, industry, logo, logoColor }
 * @param {Function} [onDone]  - Callback when collection finishes with newly discovered events
 */
export function openCollectIntelligenceModal(competitor, onDone) {
  ensureModal();

  const modal = document.getElementById(MODAL_ID);
  const avatar = document.getElementById("ci-col-avatar");
  const title = document.getElementById("ci-col-title");
  const subtitle = document.getElementById("ci-col-subtitle");
  const sourceInput = document.getElementById("ci-col-source-input");
  const presetsContainer = document.getElementById("ci-col-presets");

  const configView = document.getElementById("ci-col-config-view");
  const progressView = document.getElementById("ci-col-progress-view");
  const resultView = document.getElementById("ci-col-result-view");
  const errorView = document.getElementById("ci-col-error-view");

  const startBtn = document.getElementById("ci-col-start-btn");
  const cancelBtn = document.getElementById("ci-col-cancel-btn");

  // Reset Views
  configView.hidden = false;
  progressView.hidden = true;
  resultView.hidden = true;
  errorView.hidden = true;
  startBtn.hidden = false;
  startBtn.disabled = false;
  cancelBtn.textContent = "Cancel";

  // Header
  avatar.textContent = competitor.logo || "🏆";
  avatar.style.setProperty("--avatar-color", competitor.logoColor || "#3b82f6");
  title.textContent = `Collect Intelligence: ${competitor.name}`;
  subtitle.textContent = `Gather external news, releases, and market changes for ${competitor.name}.`;

  // Default Source
  let defaultSource = PRESET_SOURCES[competitor.name] || competitor.rss_url || competitor.news_url || competitor.website || "";
  sourceInput.value = defaultSource;

  // Build Presets
  const presets = [
    { label: "Verified Feed", url: PRESET_SOURCES[competitor.name] || defaultSource },
    { label: "TechCrunch (RSS)", url: PRESET_SOURCES["TechCrunch"] },
    { label: "BBC Tech (RSS)",   url: PRESET_SOURCES["BBC Tech"] },
    { label: "GitHub Blog (RSS)",url: PRESET_SOURCES["GitHub Blog"] },
  ];

  presetsContainer.innerHTML = presets.map(p => `
    <button type="button" class="tag ci-preset-tag" data-url="${p.url}">
      ${p.label}
    </button>
  `).join("");

  presetsContainer.querySelectorAll(".ci-preset-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      sourceInput.value = tag.dataset.url;
      sourceInput.focus();
    });
  });

  // Action
  startBtn.onclick = async () => {
    const sourceUrl = sourceInput.value.trim();
    if (!sourceUrl) {
      errorView.textContent = "Please enter a valid source URL.";
      errorView.hidden = false;
      return;
    }

    // Switch to progress view
    configView.hidden = true;
    progressView.hidden = false;
    errorView.hidden = true;
    startBtn.disabled = true;
    cancelBtn.disabled = true;

    const stepFetch    = document.getElementById("step-fetch");
    const stepAnalyze  = document.getElementById("step-analyze");
    const stepValidate = document.getElementById("step-validate");
    const stepSave     = document.getElementById("step-save");
    const loadingText  = document.getElementById("ci-col-loading-text");

    const setStep = (stepEl, text) => {
      [stepFetch, stepAnalyze, stepValidate, stepSave].forEach(el => el.classList.remove("active", "done"));
      stepEl.classList.add("active");
      loadingText.textContent = text;
    };

    setStep(stepFetch, "Fetching external public source…");

    const timer1 = setTimeout(() => setStep(stepAnalyze, "Analyzing & extracting structured events with AI…"), 1200);
    const timer2 = setTimeout(() => setStep(stepValidate, "Validating and checking duplicate records…"), 2800);
    const timer3 = setTimeout(() => setStep(stepSave, "Storing to Supabase & retaining Hindsight memory…"), 4500);

    try {
      const res = await apiClient.collectIntelligence({
        competitorId: competitor.id,
        sourceUrl,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!res.data || res.error || res.data.ok === false) {
        progressView.hidden = true;
        configView.hidden = false;
        errorView.textContent = res.error || res.data?.message || "Failed to collect intelligence from this source.";
        errorView.hidden = false;
        startBtn.disabled = false;
        cancelBtn.disabled = false;
        return;
      }

      const report = res.data;
      [stepFetch, stepAnalyze, stepValidate, stepSave].forEach(el => el.classList.add("done"));

      // Show Results
      progressView.hidden = true;
      resultView.hidden = false;
      startBtn.hidden = true;
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Done";

      // Populate Stats
      document.getElementById("stat-sources").textContent  = report.summary?.sourcesChecked ?? 1;
      document.getElementById("stat-items").textContent    = report.summary?.itemsFetched ?? 0;
      document.getElementById("stat-new").textContent      = report.summary?.newEvents ?? 0;
      document.getElementById("stat-dups").textContent     = report.summary?.duplicatesSkipped ?? 0;
      document.getElementById("stat-rejected").textContent = report.summary?.rejectedItems ?? 0;
      document.getElementById("stat-memories").textContent = report.summary?.memoriesAdded ?? 0;

      // Populate Created Events
      const eventsContainer = document.getElementById("ci-col-events-container");
      const eventsHeading = document.getElementById("ci-col-events-heading");

      const created = report.createdEvents || [];
      if (created.length > 0) {
        eventsHeading.textContent = `New Intelligence Events (${created.length})`;
        eventsContainer.innerHTML = created.map(ev => `
          <div class="ci-collect-event-card">
            <div class="ci-collect-event-top">
              <span class="badge badge--category">${ev.category}</span>
              <span class="badge ${ev.importance === 'High' ? 'impact-high' : 'impact-medium'}">${ev.importance}</span>
              <span class="ci-collect-event-date">${ev.eventDate}</span>
              <span class="ci-collect-memory-badge" title="Retained in Hindsight long-term memory">🧠 Memory Bank</span>
            </div>
            <h4 class="ci-collect-event-title">${ev.title}</h4>
            <p class="ci-collect-event-desc">${ev.description}</p>
            <div class="ci-collect-event-source">
              <span>Source: <strong>${ev.sourceName || 'External Source'}</strong></span>
              ${ev.sourceUrl ? `
                <a href="${ev.sourceUrl}" target="_blank" rel="noopener noreferrer" class="ci-detail-chip--link">
                  🔗 Inspect Source
                </a>
              ` : ''}
            </div>
          </div>
        `).join("");
      } else {
        eventsHeading.textContent = "No New Events Created";
        const reasonMsg = report.summary?.duplicatesSkipped > 0
          ? `All ${report.summary.duplicatesSkipped} items were already processed and stored previously.`
          : `Items from this source were not relevant to ${competitor.name} (${report.summary?.rejectedItems || 0} rejected).`;

        eventsContainer.innerHTML = `
          <div class="comp-empty-state" style="padding:20px 10px">
            <div class="comp-empty-icon">ℹ️</div>
            <p class="comp-empty-title">Collection Complete</p>
            <p class="comp-empty-sub">${reasonMsg}</p>
          </div>
        `;
      }

      // Add "Ask Agent" button in footer
      const existingAskBtn = document.getElementById("ci-col-ask-agent-btn");
      if (existingAskBtn) existingAskBtn.remove();

      const askAgentBtn = document.createElement("button");
      askAgentBtn.id = "ci-col-ask-agent-btn";
      askAgentBtn.className = "btn-primary btn-sm";
      askAgentBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span>Ask Agent About ${competitor.name}</span>
      `;

      askAgentBtn.onclick = () => {
        closeCollectModal();
        const agentInput = document.getElementById("memory-query-input") || document.getElementById("agent-input");
        const askBtn = document.getElementById("btn-ask-agent") || document.getElementById("btn-agent-ask");
        if (agentInput && askBtn) {
          agentInput.value = `What has ${competitor.name} done recently based on newly collected intelligence?`;
          agentInput.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => askBtn.click(), 300);
        }
      };

      document.getElementById("ci-col-footer").prepend(askAgentBtn);

      if (onDone) onDone(report);

    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      progressView.hidden = true;
      configView.hidden = false;
      errorView.textContent = `Error: ${err.message}`;
      errorView.hidden = false;
      startBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  };

  // Show
  modal.style.display = "flex";
  modal.style.pointerEvents = "auto";
  modal.style.visibility = "visible";
  modal.hidden = false;
  modal.classList.add("ci-modal-overlay--visible");
}
