/**
 * competitor-detail.js
 * ─────────────────────────────────────────────────────────────────
 * Right-side drawer: competitor profile + events list + Add Event form.
 *
 * Exports:
 *  openCompetitorDetail(competitor, allCompetitors, callbacks)
 *  closeCompetitorDetail()
 * ─────────────────────────────────────────────────────────────────
 */

import { getEventsByCompetitor, createEvent } from '../data/db.js';

// ── Constants ─────────────────────────────────────────────────────
const CATEGORIES = ['Product','Pricing','Marketing','Partnership','Hiring','Funding','Expansion','Other'];
const IMPORTANCE  = ['High','Medium','Low'];

const CAT_ICONS = {
  Product:'🚀', Pricing:'🏷️', Marketing:'📢', Partnership:'🤝',
  Hiring:'👥', Funding:'💰', Expansion:'🌍', Other:'📌',
};
const IMP_CLASS = {
  High:'impact-high', Medium:'impact-medium', Low:'impact-low',
};

const DRAWER_ID = 'ci-detail-drawer';

// ── Helpers ───────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function extractHost(url) {
  if (!url) return null;
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

// ── Drawer shell (created once) ───────────────────────────────────

function ensureDrawer() {
  if (document.getElementById(DRAWER_ID)) return;

  const div = document.createElement('div');
  div.id        = DRAWER_ID;
  div.className = 'ci-drawer';
  div.setAttribute('aria-hidden', 'true');
  div.style.pointerEvents = 'none';
  div.style.visibility = 'hidden';
  div.innerHTML = `
    <div class="ci-drawer__backdrop"></div>
    <aside class="ci-drawer__panel" role="complementary" aria-label="Competitor detail">
      <div class="ci-drawer__header" id="ci-drw-header"></div>
      <div class="ci-drawer__scroll" id="ci-drw-scroll">
        <div id="ci-drw-body"></div>
      </div>
    </aside>
  `;
  document.body.appendChild(div);

  // Close on backdrop click
  div.querySelector('.ci-drawer__backdrop')
     .addEventListener('click', closeCompetitorDetail);

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const d = document.getElementById(DRAWER_ID);
      if (d && d.getAttribute('aria-hidden') === 'false') {
        closeCompetitorDetail();
      }
    }
  });
}

export function closeCompetitorDetail() {
  const d = document.getElementById(DRAWER_ID);
  if (!d) return;
  d.classList.remove('ci-drawer--open');
  d.setAttribute('aria-hidden', 'true');
  d.style.pointerEvents = 'none';
  d.style.visibility = 'hidden';

  // Reset event form state if open
  const submitBtn = document.getElementById('evf-submit');
  const spinner = document.getElementById('evf-spin');
  const label = document.getElementById('evf-lbl');
  if (submitBtn) submitBtn.disabled = false;
  if (spinner) spinner.style.display = 'none';
  if (label) label.textContent = 'Save Event';
}

// ── Main export ───────────────────────────────────────────────────

/**
 * openCompetitorDetail()
 * @param {object}   competitor     - normalised competitor object
 * @param {object[]} allCompetitors - full list for the event form dropdown
 * @param {object}   callbacks      - { onEdit(comp), onDelete(comp) }
 */
export async function openCompetitorDetail(competitor, allCompetitors, callbacks = {}) {
  ensureDrawer();

  const drw    = document.getElementById(DRAWER_ID);
  const header = document.getElementById('ci-drw-header');
  const body   = document.getElementById('ci-drw-body');
  const scroll = document.getElementById('ci-drw-scroll');

  const domain = extractHost(competitor.website);

  // ── Header ──────────────────────────────────────────────────────
  header.innerHTML = `
    <button class="ci-drawer__back" id="ci-drw-close" aria-label="Close panel">
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Back
    </button>
    <div style="display:flex;gap:8px">
      <button class="btn-ghost btn-sm" id="ci-drw-edit">
        <svg viewBox="0 0 16 16" fill="none" width="11" height="11">
          <path d="M11.5 2.5a1.5 1.5 0 012.12 2.12L5 13.25 2 14l.75-3L11.5 2.5z"
                stroke="currentColor" stroke-width="1.3"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Edit
      </button>
      <button class="btn-ghost btn-sm ci-drw-del-btn" id="ci-drw-delete">
        <svg viewBox="0 0 16 16" fill="none" width="11" height="11">
          <path d="M2 4h12M6 4V2h4v2M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4"
                stroke="currentColor" stroke-width="1.3"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Delete
      </button>
    </div>
  `;

  // ── Competitor options for the event form dropdown ──────────────
  const compOptions = allCompetitors
    .map(c => `<option value="${c.id}"${c.id === competitor.id ? ' selected' : ''}>${c.name}</option>`)
    .join('');

  // ── Body ─────────────────────────────────────────────────────────
  body.innerHTML = `

    <!-- ── Profile card ─────────────────────────────────────── -->
    <div class="ci-detail-profile">
      <div class="comp-avatar ci-detail-avatar" style="--avatar-color:${competitor.logoColor}">
        ${competitor.logo}
      </div>
      <div class="ci-detail-meta">
        <h2 class="ci-detail-name">${competitor.name}</h2>
        <div class="ci-detail-chips">
          ${domain
            ? `<a href="${competitor.website}" target="_blank" rel="noopener noreferrer"
                  class="ci-detail-chip ci-detail-chip--link">🔗 ${domain}</a>`
            : ''}
          ${competitor.industry ? `<span class="ci-detail-chip">${competitor.industry}</span>` : ''}
        </div>
      </div>
    </div>
    ${competitor.description
      ? `<p class="ci-detail-desc">${competitor.description}</p>`
      : ''}

    <div class="ci-collect-banner">
      <div class="ci-collect-info">
        <span class="ci-collect-title">Automated Intelligence Collection</span>
        <span class="ci-collect-subtitle">Ingest latest news and product updates from external public sources</span>
      </div>
      <button class="btn-primary btn-sm ci-collect-btn" id="ci-drw-collect-btn">
        ⚡ Collect
      </button>
    </div>

    <hr class="ci-detail-hr"/>

    <!-- ── Events list ──────────────────────────────────────── -->
    <div class="ci-detail-section">
      <div class="ci-detail-section-hdr">
        <h3 class="ci-section-h3">Intelligence Events</h3>
        <span class="badge badge--category" id="ci-evcount">…</span>
      </div>
      <div id="ci-evlist"></div>
    </div>

    <hr class="ci-detail-hr"/>

    <!-- ── Add Event form ───────────────────────────────────── -->
    <div class="ci-detail-section">
      <h3 class="ci-section-h3" style="margin-bottom:var(--sp-4)">Add Event</h3>

      <form id="ci-evform" novalidate class="ci-evform">

        <!-- Row 1: Competitor + Importance -->
        <div class="ci-evform-row">
          <div class="ci-form-group">
            <label class="ci-form-label" for="evf-comp">Competitor</label>
            <select id="evf-comp" class="ci-form-input ci-form-select">
              ${compOptions}
            </select>
          </div>
          <div class="ci-form-group">
            <label class="ci-form-label" for="evf-imp">Importance</label>
            <select id="evf-imp" class="ci-form-input ci-form-select">
              ${IMPORTANCE.map(i =>
                `<option value="${i}"${i === 'Medium' ? ' selected' : ''}>${i}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <!-- Row 2: Category + Date -->
        <div class="ci-evform-row">
          <div class="ci-form-group">
            <label class="ci-form-label" for="evf-cat">Category</label>
            <select id="evf-cat" class="ci-form-input ci-form-select">
              ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="ci-form-group">
            <label class="ci-form-label" for="evf-date">Date</label>
            <input id="evf-date" type="date" class="ci-form-input"
                   value="${todayISO()}" required/>
          </div>
        </div>

        <!-- Title -->
        <div class="ci-form-group">
          <label class="ci-form-label" for="evf-title">
            Title <span class="ci-required">*</span>
          </label>
          <input id="evf-title" type="text" class="ci-form-input"
                 placeholder="e.g. New AI Farming Assistant" required/>
          <span class="ci-form-error" id="evf-terr" hidden>Title is required.</span>
        </div>

        <!-- Description -->
        <div class="ci-form-group">
          <label class="ci-form-label" for="evf-desc">Description</label>
          <textarea id="evf-desc" class="ci-form-input ci-form-textarea"
                    rows="3" placeholder="Company launched…"></textarea>
        </div>

        <!-- Source -->
        <div class="ci-form-group">
          <label class="ci-form-label" for="evf-src">Source</label>
          <input id="evf-src" type="text" class="ci-form-input"
                 placeholder="e.g. Company Website, TechCrunch…"/>
        </div>

        <!-- Server error -->
        <div id="evf-serr" class="ci-form-server-error" hidden></div>

        <!-- Submit row -->
        <div class="ci-evform-footer">
          <button type="submit" class="btn-primary" id="evf-submit">
            <svg id="evf-spin" viewBox="0 0 24 24" fill="none" width="14" height="14"
                 style="display:none;animation:spin 1s linear infinite">
              <path d="M21 12a9 9 0 11-18 0" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span id="evf-lbl">Save Event</span>
          </button>
          <span id="evf-ok" class="ci-evf-success" hidden>✅ Event saved!</span>
        </div>

      </form>
    </div>
  `;

  // ── Open drawer ──────────────────────────────────────────────────
  scroll.scrollTop = 0;
  drw.style.pointerEvents = 'auto';
  drw.style.visibility = 'visible';
  drw.setAttribute('aria-hidden', 'false');
  drw.classList.add('ci-drawer--open');

  // ── Load events for this competitor ─────────────────────────────
  await loadEvents(competitor.id);

  // ── Wire header buttons ──────────────────────────────────────────
  document.getElementById('ci-drw-close').onclick = closeCompetitorDetail;

  document.getElementById('ci-drw-edit').onclick = () => {
    if (callbacks.onEdit) callbacks.onEdit(competitor);
  };

  document.getElementById('ci-drw-delete').onclick = () => {
    closeCompetitorDetail();
    if (callbacks.onDelete) callbacks.onDelete(competitor);
  };

  const collectBtn = document.getElementById('ci-drw-collect-btn');
  if (collectBtn) {
    collectBtn.onclick = () => {
      if (callbacks.onCollect) callbacks.onCollect(competitor);
    };
  }

  // ── Wire event form ──────────────────────────────────────────────
  document.getElementById('ci-evform').addEventListener('submit', async e => {
    e.preventDefault();

    const titleInput = document.getElementById('evf-title');
    const titleErr   = document.getElementById('evf-terr');
    const serverErr  = document.getElementById('evf-serr');
    const spinner    = document.getElementById('evf-spin');
    const label      = document.getElementById('evf-lbl');
    const submitBtn  = document.getElementById('evf-submit');
    const successMsg = document.getElementById('evf-ok');

    // Reset error states
    titleErr.hidden   = true;
    serverErr.hidden  = true;
    successMsg.hidden = true;

    // Validate title
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      titleErr.hidden = false;
      titleInput.focus();
      return;
    }

    // Build payload
    const payload = {
      competitor_id: document.getElementById('evf-comp').value,
      category:      document.getElementById('evf-cat').value,
      event_date:    document.getElementById('evf-date').value,
      title:         titleVal,
      description:   document.getElementById('evf-desc').value.trim() || null,
      source_name:   document.getElementById('evf-src').value.trim()  || null,
      importance:    document.getElementById('evf-imp').value,
    };

    // Loading state
    submitBtn.disabled    = true;
    spinner.style.display = 'inline';
    label.textContent     = 'Saving…';

    try {
      const { error } = await createEvent(payload);
      if (error) throw new Error(error.message ?? 'Failed to save event.');

      // Clear transient fields (keep competitor/category/importance/date)
      titleInput.value = '';
      document.getElementById('evf-desc').value = '';
      document.getElementById('evf-src').value  = '';

      successMsg.hidden = false;
      setTimeout(() => { successMsg.hidden = true; }, 3000);

      // Refresh the events list
      await loadEvents(payload.competitor_id);

    } catch (err) {
      serverErr.textContent = err.message;
      serverErr.hidden = false;
      console.error('[detail] createEvent error:', err);
    } finally {
      submitBtn.disabled    = false;
      spinner.style.display = 'none';
      label.textContent     = 'Save Event';
    }
  });
}

// ── Load + render events for a competitor ─────────────────────────

async function loadEvents(competitorId) {
  const listEl  = document.getElementById('ci-evlist');
  const countEl = document.getElementById('ci-evcount');
  if (!listEl) return;

  // Loading state
  listEl.innerHTML = `
    <div class="ci-evlist-state">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"
           style="animation:spin 1s linear infinite;flex-shrink:0">
        <path d="M21 12a9 9 0 11-18 0" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"/>
      </svg>
      Loading events…
    </div>`;

  const { data, error } = await getEventsByCompetitor(competitorId);

  if (error) {
    console.error('[detail] getEventsByCompetitor error:', error);
    listEl.innerHTML = `
      <div class="ci-evlist-state ci-evlist-error">
        ⚠️ Failed to load events: ${error.message}
      </div>`;
    if (countEl) countEl.textContent = 'Error';
    return;
  }

  if (countEl) countEl.textContent = `${data.length} event${data.length !== 1 ? 's' : ''}`;

  if (data.length === 0) {
    listEl.innerHTML = `
      <div class="ci-evlist-empty">
        <div style="font-size:1.6rem;margin-bottom:8px">📭</div>
        <p>No intelligence events recorded yet.</p>
        <p style="margin-top:4px">Add the first one below ↓</p>
      </div>`;
    return;
  }

  listEl.innerHTML = data
    .map(ev => `
      <div class="ci-ev-item">
        <div class="ci-ev-icon">${CAT_ICONS[ev.category] ?? '📌'}</div>
        <div class="ci-ev-body">
          <div class="ci-ev-meta">
            <span class="badge ${IMP_CLASS[ev.importance] ?? 'impact-medium'}">${ev.importance}</span>
            <span class="badge badge--category">${ev.category}</span>
            <span class="ci-ev-date">${fmtDate(ev.event_date)}</span>
          </div>
          <div class="ci-ev-title">${ev.title}</div>
          ${ev.description ? `<div class="ci-ev-desc">${ev.description}</div>` : ''}
          ${ev.source_name ? `<div class="ci-ev-src">📰 ${ev.source_name}</div>` : ''}
        </div>
      </div>`)
    .join('');
}
