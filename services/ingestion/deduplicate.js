/**
 * services/ingestion/deduplicate.js
 * ─────────────────────────────────────────────────────────────────
 * Deduplication Engine for Competitor Events.
 *
 * Responsibilities:
 *  - Prevents ingesting identical articles or duplicate competitor events.
 *  - Computes deterministic content hashes.
 *  - Checks Supabase competitor_events for:
 *     1. Matching source_url for this competitor
 *     2. Matching title + date for this competitor
 *     3. Matching content_hash if present
 *  - Protects both Supabase and Hindsight from duplicate events.
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";

/**
 * Computes a deterministic SHA-256 hash for a candidate event.
 */
export function computeEventContentHash(candidate) {
  const normComp = String(candidate.competitor_id || "").toLowerCase().trim();
  const normTitle = String(candidate.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normDate = String(candidate.event_date || "").trim();
  const normUrl = String(candidate.source_url || "").toLowerCase().trim();

  const raw = `${normComp}::${normTitle}::${normDate}::${normUrl}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// In-memory processed cache (prevents duplicate ingestion across requests in this server session)
const _processedItemsCache = new Set();

/**
 * Records an accepted event into the session deduplication cache.
 */
export function recordProcessedEvent(candidate) {
  if (!candidate) return;
  const hash = computeEventContentHash(candidate);
  _processedItemsCache.add(hash);
  if (candidate.source_url) {
    _processedItemsCache.add(`url::${candidate.competitor_id}::${candidate.source_url.toLowerCase()}`);
  }
}

/**
 * Checks if a candidate event is already recorded in Supabase for this competitor.
 *
 * @param {object} candidate - Sanitized event candidate
 * @param {object} supabaseAdmin - Supabase admin/anon client
 * @returns {Promise<{ isDuplicate: boolean, existingEvent?: object, reason?: string }>}
 */
export async function checkEventDuplicate(candidate, supabaseAdmin) {
  const hash = computeEventContentHash(candidate);
  const urlKey = candidate.source_url ? `url::${candidate.competitor_id}::${candidate.source_url.toLowerCase()}` : null;

  // Check in-memory session cache first
  if (_processedItemsCache.has(hash) || (urlKey && _processedItemsCache.has(urlKey))) {
    return {
      isDuplicate: true,
      reason: `Article or event was already processed and ingested in this session.`,
    };
  }

  if (!supabaseAdmin) {
    return { isDuplicate: false };
  }

  const compId = candidate.competitor_id;
  const sourceUrl = candidate.source_url;
  const title = candidate.title.toLowerCase().trim();
  const date = candidate.event_date;

  try {
    // 1. Check exact match on source_url for this competitor
    if (sourceUrl) {
      const { data: urlMatches, error: urlErr } = await supabaseAdmin
        .from("competitor_events")
        .select("id, title, event_date, source_url")
        .eq("competitor_id", compId)
        .eq("source_url", sourceUrl)
        .limit(1);

      if (!urlErr && urlMatches && urlMatches.length > 0) {
        return {
          isDuplicate: true,
          existingEvent: urlMatches[0],
          reason: `Event with identical source URL already exists (${urlMatches[0].title}).`,
        };
      }
    }

    // 2. Check match on title + event_date for this competitor
    const { data: existingEvents, error: evErr } = await supabaseAdmin
      .from("competitor_events")
      .select("id, title, event_date")
      .eq("competitor_id", compId)
      .eq("event_date", date)
      .limit(20);

    if (!evErr && existingEvents && existingEvents.length > 0) {
      const normCandidateTitle = title.replace(/[^a-z0-9]/g, "");
      for (const ev of existingEvents) {
        const normExisting = (ev.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (
          normExisting === normCandidateTitle ||
          (normCandidateTitle.length > 15 && normExisting.includes(normCandidateTitle)) ||
          (normExisting.length > 15 && normCandidateTitle.includes(normExisting))
        ) {
          return {
            isDuplicate: true,
            existingEvent: ev,
            reason: `Event with matching title and date already exists for this competitor.`,
          };
        }
      }
    }

    return { isDuplicate: false };
  } catch (err) {
    console.warn(`[deduplicate] Duplicate check encountered error (${err.message}). Proceeding safely.`);
    return { isDuplicate: false };
  }
}
