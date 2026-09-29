/**
 * competitors.js
 * Renders the Competitors panel.
 * Data contract: expects an array matching the `competitors` shape from mockData.js
 *
 * Exports:
 *  - renderCompetitors(containerId, data, { onAdd, onEdit, onDelete })
 *  - openCompetitorModal(competitor|null, onSave)
 */

const THREAT_CONFIG = {
  high:   { label: "High Threat",   class: "threat-high" },
  medium: { label: "Med Threat",    class: "threat-medium" },
  low:    { label: "Low Threat",    class: "threat-low" },
};

function renderSparkBar(value, max = 100) {
  const pct = Math.min((value / max) * 100, 100);
  return `<div class="spark-track"><div class="spark-fill" style="width:${pct}%"></div></div>`;
}

function renderCompetitorCard(c) {
  const threat = THREAT_CONFIG[c.threatLevel] ?? THREAT_CONFIG.medium;
  const eventCountText = c.eventCount !== undefined && c.eventCount !== null
    ? `${c.eventCount} event${c.eventCount === 1 ? '' : 's'}`
    : "Tracked";

  return `
    <div class="competitor-card competitor-card--compact" data-id="${c.id}" tabindex="0" role="button" aria-label="View details for ${c.name}">
      <div class="competitor-card__row-main">
        <div class="comp-avatar comp-avatar--sm" style="--avatar-color:${c.logoColor}">${c.logo}</div>
        <div class="comp-meta">
          <div class="comp-name-row">
            <span class="comp-name" title="${c.name}">${c.name}</span>
            <span class="badge badge--category-mini">${c.industry || c.category || 'Direct'}</span>
          </div>
          <div class="comp-domain-row">
            <span class="comp-domain">${c.domain}</span>
            <span class="comp-dot-sep">·</span>
            <span class="comp-event-count">📊 ${eventCountText}</span>
            <span class="comp-dot-sep">·</span>
            <span class="comp-activity-time">🕐 ${c.lastActivity || 'Recent'}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="card-actions card-actions--compact" aria-label="Competitor actions">
            <button class="card-action-btn card-action-btn--collect"
              data-id="${c.id}" title="Gather Intelligence" aria-label="Gather intelligence for ${c.name}">
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M8 1.5v9M4.5 7l3.5 3.5L11.5 7M2 13.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="card-action-btn card-action-btn--edit"
                  data-id="${c.id}" title="Edit competitor" aria-label="Edit ${c.name}">
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M11.5 2.5a1.5 1.5 0 012.12 2.12L5 13.25 2 14l.75-3L11.5 2.5z"
                    stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="card-action-btn card-action-btn--delete"
                  data-id="${c.id}" title="Delete competitor" aria-label="Delete ${c.name}">
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M2 4h12M6 4V2h4v2M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4"
                    stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * renderCompetitors()
 * @param {string}   containerId
 * @param {object[]} data          - normalised competitor array
 * @param {object}   callbacks     - { onAdd, onEdit, onDelete, onCardClick }
 */
export function renderCompetitors(containerId, data, callbacks = {}) {
  const { onAdd, onEdit, onDelete, onCardClick, onCollect } = callbacks;
  const container = document.getElementById(containerId);
  if (!container) return;
  const collectingCompetitorIds = new Set();

  container.innerHTML = `
    <div class="section-header competitors-section-header">
      <div>
        <h2 class="section-title">Competitors</h2>
        <p class="section-subtitle">${data.length} tracked · Updated just now</p>
      </div>
      <div class="section-actions">
        <button class="btn-primary btn-sm" id="btn-add-competitor" aria-label="Add new competitor">
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Add
        </button>
      </div>
    </div>
    <div class="competitors-toolbar">
      <div class="filter-tabs" id="comp-filters">
        <button class="filter-tab active" data-filter="all">All</button>
        <button class="filter-tab" data-filter="Direct">Direct</button>
        <button class="filter-tab" data-filter="Indirect">Indirect</button>
        <button class="filter-tab" data-filter="Adjacent">Adjacent</button>
      </div>
    </div>
    <div class="competitors-grid" id="competitors-list">
      ${data.length > 0
        ? data.map(renderCompetitorCard).join("")
        : `<div class="comp-empty-state">
             <div class="comp-empty-icon">🏆</div>
             <p class="comp-empty-title">No competitors yet</p>
             <p class="comp-empty-sub">Click <strong>Add</strong> to track your first competitor.</p>
           </div>`
      }
    </div>
  `;

  // ── Add button ───────────────────────────────────────────────
  document.getElementById("btn-add-competitor")?.addEventListener("click", () => {
    if (onAdd) onAdd();
  });

  // ── Edit / Delete / Card-click via event delegation ─────────
  document.getElementById("competitors-list")?.addEventListener("click", async e => {
    const collectBtn = e.target.closest(".card-action-btn--collect");
    const editBtn    = e.target.closest(".card-action-btn--edit");
    const deleteBtn  = e.target.closest(".card-action-btn--delete");
    const card       = e.target.closest(".competitor-card");

    if (collectBtn) {
      e.stopPropagation();
      const comp = data.find(c => c.id === collectBtn.dataset.id);
      if (!comp || !onCollect || collectingCompetitorIds.has(comp.id)) return;
      collectingCompetitorIds.add(comp.id);
      collectBtn.disabled = true;
      collectBtn.setAttribute("aria-busy", "true");
      collectBtn.title = `Gathering intelligence for ${comp.name}`;
      collectBtn.classList.add("is-collecting");
      try {
        await onCollect(comp);
      } finally {
        collectingCompetitorIds.delete(comp.id);
        if (collectBtn.isConnected) {
          collectBtn.disabled = false;
          collectBtn.removeAttribute("aria-busy");
          collectBtn.title = "Gather Intelligence";
          collectBtn.classList.remove("is-collecting");
        }
      }
    } else if (editBtn) {
      e.stopPropagation();
      const comp = data.find(c => c.id === editBtn.dataset.id);
      if (comp && onEdit) onEdit(comp);
    } else if (deleteBtn) {
      e.stopPropagation();
      const comp = data.find(c => c.id === deleteBtn.dataset.id);
      if (comp && onDelete) onDelete(comp);
    } else if (card && onCardClick) {
      const comp = data.find(c => c.id === card.dataset.id);
      if (comp) onCardClick(comp);
    }
  });

  // ── Filter logic ──────────────────────────────────────────────
  document.getElementById("comp-filters")?.addEventListener("click", e => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    const filter = tab.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".competitor-card").forEach(card => {
      const comp = data.find(c => c.id === card.dataset.id);
      card.style.display = (filter === "all" || comp?.category === filter) ? "" : "none";
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — Add / Edit Competitor
// ═══════════════════════════════════════════════════════════════════

const MODAL_ID = "competitor-modal";

function ensureModal() {
  if (document.getElementById(MODAL_ID)) return;

  const el = document.createElement("div");
  el.innerHTML = `
    <div id="${MODAL_ID}" class="ci-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ci-modal-title" hidden style="display:none;pointer-events:none;visibility:hidden;">
      <div class="ci-modal">
        <div class="ci-modal__header">
          <h2 class="ci-modal__title" id="ci-modal-title">Add Competitor</h2>
          <button class="ci-modal__close" id="ci-modal-close" aria-label="Close dialog">
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <form id="ci-competitor-form" class="ci-modal__body" novalidate>
          <div class="ci-form-group">
            <label class="ci-form-label" for="ci-field-name">Company Name <span class="ci-required">*</span></label>
            <input id="ci-field-name" name="name" type="text" class="ci-form-input"
                   placeholder="e.g. Acme Corp" required autocomplete="organization" />
            <span class="ci-form-error" id="ci-error-name" hidden>Name is required.</span>
          </div>
          <div class="ci-form-group">
            <label class="ci-form-label" for="ci-field-website">Website</label>
            <input id="ci-field-website" name="website" type="url" class="ci-form-input"
                   placeholder="https://example.com" autocomplete="url" />
            <span class="ci-form-error" id="ci-error-website" hidden>Enter a valid URL (https://…).</span>
          </div>
          <div class="ci-form-group">
            <label class="ci-form-label" for="ci-field-industry">Industry</label>
            <input id="ci-field-industry" name="industry" type="text" class="ci-form-input"
                   placeholder="e.g. SaaS, FinTech, Agriculture…" />
          </div>
          <div class="ci-form-group">
            <label class="ci-form-label" for="ci-field-description">Description</label>
            <textarea id="ci-field-description" name="description" class="ci-form-input ci-form-textarea"
                      rows="3" placeholder="Brief description of this competitor…"></textarea>
          </div>
          <div id="ci-form-server-error" class="ci-form-server-error" hidden></div>
        </form>
        <div class="ci-modal__footer">
          <button type="button" class="btn-ghost btn-sm" id="ci-modal-cancel">Cancel</button>
          <button type="submit" form="ci-competitor-form" class="btn-primary btn-sm" id="ci-modal-save">
            <span id="ci-modal-save-label">Save Competitor</span>
            <svg id="ci-modal-spinner" viewBox="0 0 24 24" fill="none" width="14" height="14"
                 style="display:none;animation:spin 1s linear infinite">
              <path d="M21 12a9 9 0 11-18 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el.firstElementChild);

  // Close on overlay click or Escape
  document.getElementById(MODAL_ID).addEventListener("click", e => {
    if (e.target.id === MODAL_ID) closeCompetitorModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !document.getElementById(MODAL_ID).hidden) {
      closeCompetitorModal();
    }
  });
  document.getElementById("ci-modal-close").addEventListener("click",  closeCompetitorModal);
  document.getElementById("ci-modal-cancel").addEventListener("click", closeCompetitorModal);
}

export function closeCompetitorModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove("ci-modal-overlay--visible");
  modal.style.display = "none";
  modal.style.pointerEvents = "none";
  modal.style.visibility = "hidden";

  // Reset button loading states
  const saveBtn = document.getElementById("ci-modal-save");
  const spinner = document.getElementById("ci-modal-spinner");
  if (saveBtn) saveBtn.disabled = false;
  if (spinner) spinner.style.display = "none";
}

/**
 * openCompetitorModal()
 * @param {object|null} competitor  - null for Add, existing object for Edit
 * @param {Function}    onSave      - async (payload, id?) => void
 */
export function openCompetitorModal(competitor, onSave) {
  ensureModal();

  const modal       = document.getElementById(MODAL_ID);
  const form        = document.getElementById("ci-competitor-form");
  const title       = document.getElementById("ci-modal-title");
  const saveLabel   = document.getElementById("ci-modal-save-label");
  const spinner     = document.getElementById("ci-modal-spinner");
  const saveBtn     = document.getElementById("ci-modal-save");
  const serverErr   = document.getElementById("ci-form-server-error");
  const nameErr     = document.getElementById("ci-error-name");
  const websiteErr  = document.getElementById("ci-error-website");

  const isEdit = Boolean(competitor);

  // Populate
  title.textContent     = isEdit ? "Edit Competitor" : "Add Competitor";
  saveLabel.textContent = isEdit ? "Save Changes"   : "Save Competitor";
  form["name"].value        = competitor?.name        ?? "";
  form["website"].value     = competitor?.website     ?? "";
  form["industry"].value    = competitor?.industry    ?? "";
  form["description"].value = competitor?.description ?? "";
  serverErr.hidden = true;
  nameErr.hidden   = true;
  websiteErr.hidden = true;

  // Show
  modal.style.display = "flex";
  modal.style.pointerEvents = "auto";
  modal.style.visibility = "visible";
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("ci-modal-overlay--visible"));
  form["name"].focus();

  // Remove any prior submit listener by replacing the form
  const newForm = form.cloneNode(true);
  form.replaceWith(newForm);

  // Re-query after replace
  const liveForm      = document.getElementById("ci-competitor-form");
  const liveServerErr = document.getElementById("ci-form-server-error");
  const liveNameErr   = document.getElementById("ci-error-name");
  const liveWebErr    = document.getElementById("ci-error-website");

  liveForm.addEventListener("submit", async e => {
    e.preventDefault();
    liveServerErr.hidden = true;
    liveNameErr.hidden   = true;
    liveWebErr.hidden    = true;

    // Validate
    const name    = liveForm["name"].value.trim();
    const website = liveForm["website"].value.trim();
    let valid = true;

    if (!name) {
      liveNameErr.hidden = false;
      liveForm["name"].focus();
      valid = false;
    }
    if (website && !website.startsWith("http")) {
      liveWebErr.hidden = false;
      if (valid) liveForm["website"].focus();
      valid = false;
    }
    if (!valid) return;

    const payload = {
      name,
      website:     website || null,
      industry:    liveForm["industry"].value.trim()    || null,
      description: liveForm["description"].value.trim() || null,
    };

    // Loading state
    saveBtn.disabled    = true;
    spinner.style.display = "inline";

    try {
      await onSave(payload, competitor?.id ?? null);
      closeCompetitorModal();
    } catch (err) {
      liveServerErr.textContent = err.message ?? "Failed to save. Please try again.";
      liveServerErr.hidden = false;
    } finally {
      saveBtn.disabled    = false;
      spinner.style.display = "none";
    }
  });
}
