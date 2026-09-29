/**
 * services/ingestion/validate.js
 * ─────────────────────────────────────────────────────────────────
 * Strict Validation Engine for Candidate Competitor Events.
 *
 * Responsibilities:
 *  - Enforces schema and data integrity before database insertion.
 *  - Ensures category and importance match database CHECK constraints.
 *  - Validates date formats and chronological sanity.
 *  - Rejects irrelevant or fabricated results safely.
 * ─────────────────────────────────────────────────────────────────
 */

import { ALLOWED_CATEGORIES, ALLOWED_IMPORTANCE } from "./extract.js";

/**
 * Validates a candidate event extracted from an external source.
 *
 * @param {object} candidate   - Extracted event from extract.js
 * @param {object} sourceItem  - Original source item
 * @param {object} competitor  - Target competitor { id, name }
 * @returns {{ valid: boolean, sanitized?: object, reason?: string }}
 */
export function validateCandidateEvent(candidate, sourceItem, competitor) {
  if (!competitor || !competitor.id) {
    return { valid: false, reason: "Competitor record is missing or invalid." };
  }

  if (!candidate || typeof candidate !== "object") {
    return { valid: false, reason: "Candidate event payload is not an object." };
  }

  if (candidate.isRelevant !== true) {
    return {
      valid: false,
      reason: candidate.reason || `Event deemed not relevant to ${competitor.name}.`,
    };
  }

  // Title validation
  const title = (candidate.title || sourceItem.title || "").trim();
  if (title.length < 5) {
    return { valid: false, reason: "Event title must be at least 5 characters." };
  }
  const cleanTitle = title.slice(0, 150);

  // Description validation
  const description = (candidate.description || sourceItem.content || "").trim();
  if (description.length < 10) {
    return { valid: false, reason: "Event description must be at least 10 characters." };
  }
  const cleanDescription = description.slice(0, 1500);

  // Category validation (case-sensitive check against DB constraint)
  let category = candidate.category;
  if (!ALLOWED_CATEGORIES.includes(category)) {
    const matched = ALLOWED_CATEGORIES.find(c => c.toLowerCase() === (category || "").toLowerCase());
    if (matched) {
      category = matched;
    } else {
      category = "Other";
    }
  }

  // Importance validation
  let importance = candidate.importance;
  if (!ALLOWED_IMPORTANCE.includes(importance)) {
    const matched = ALLOWED_IMPORTANCE.find(i => i.toLowerCase() === (importance || "").toLowerCase());
    importance = matched || "Medium";
  }

  // Date validation
  let eventDate = candidate.eventDate;
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    if (sourceItem.publishedAt) {
      try {
        eventDate = new Date(sourceItem.publishedAt).toISOString().split("T")[0];
      } catch {
        eventDate = new Date().toISOString().split("T")[0];
      }
    } else {
      eventDate = new Date().toISOString().split("T")[0];
    }
  }

  // Sanity check on date: must be between 2000-01-01 and 7 days into the future
  const now = Date.now();
  const maxFuture = now + 7 * 24 * 60 * 60 * 1000;
  const dTime = new Date(eventDate).getTime();
  if (isNaN(dTime) || dTime < new Date("2000-01-01").getTime() || dTime > maxFuture) {
    eventDate = new Date().toISOString().split("T")[0];
  }

  // Source URL validation
  const sourceUrl = (sourceItem.url || "").trim();
  if (!sourceUrl || (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://"))) {
    return { valid: false, reason: "Valid HTTP/HTTPS source URL is required for traceability." };
  }

  // Source name validation
  const sourceName = (sourceItem.sourceName || candidate.sourceName || new URL(sourceUrl).hostname).trim();

  return {
    valid: true,
    sanitized: {
      competitor_id: competitor.id,
      event_date: eventDate,
      category,
      title: cleanTitle,
      description: cleanDescription,
      source_url: sourceUrl,
      source_name: sourceName,
      importance,
      source_item_id: sourceItem.itemId || null,
      evidence: candidate.evidence || null,
    },
  };
}
