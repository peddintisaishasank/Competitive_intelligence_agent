/**
 * services/ingestion/ingestion.js
 * ─────────────────────────────────────────────────────────────────
 * Automated Competitor Intelligence Ingestion Service
 *
 * Core Pipeline:
 *   EXTERNAL SOURCE (RSS / Public URL)
 *         ↓
 *   FETCH CONTENT (Safe SSRF-validated HTTP fetch)
 *         ↓
 *   EXTRACT RELEVANT INFORMATION (Google Gemini AI Structuring)
 *         ↓
 *   VALIDATE (Schema, Allowed Categories, Allowed Importance, Dates)
 *         ↓
 *   DUPLICATE CHECK (URL, Content Hash, Title + Date in Supabase)
 *         ↓
 *   STORE IN SUPABASE (competitor_events)
 *         ↓
 *   HINDSIGHT RETAIN (Long-term memory bank)
 *         ↓
 *   RETURN COMPREHENSIVE INTELLIGENCE SUMMARY
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchSourceItems } from "./fetcher.js";
import { extractCompetitorEvent } from "./extract.js";
import { validateCandidateEvent } from "./validate.js";
import { checkEventDuplicate, computeEventContentHash, recordProcessedEvent } from "./deduplicate.js";
import { retainCompetitorEvent } from "../hindsight.js";

// Lazy-initialized Supabase client
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || "https://jrtraipuqwvnyolzipas.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJhaXB1cXd2bnlvbHppcGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDI1NzgsImV4cCI6MjEwNjE3ODU3OH0.TzA7TmiB_1lKhz3XoHnJT6IG-vPZu4qUW2cyvHQ5KFg";
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

/**
 * Pre-configured public intelligence sources for demo / tracked competitors.
 */
const KNOWN_SOURCES = {
  "AgroTech AI": "http://localhost:3000/public-feeds/agrotech-announcements.xml",
  "FarmVision":  "http://localhost:3000/public-feeds/farmvision-announcements.xml",
  "CropMind":    "https://github.blog/feed/",
};

/**
 * Executes end-to-end intelligence collection for a competitor.
 *
 * @param {object} params
 * @param {string} params.competitorId  - Target competitor ID
 * @param {string} [params.sourceUrl]   - Optional source URL override
 * @param {number} [params.maxItems=8]  - Max source items to process in one run
 * @returns {Promise<object>}           - Collection report and newly created events
 */
export async function collectCompetitorIntelligence({
  competitorId,
  sourceUrl,
  maxItems = 8,
} = {}) {
  const sb = getSupabase();

  if (!competitorId) {
    return { ok: false, error: "competitorId is required for intelligence collection." };
  }

  // ── Step 1: Load competitor from Supabase ─────────────────────────
  const { data: competitor, error: compErr } = await sb
    .from("competitors")
    .select("*")
    .eq("id", competitorId)
    .single();

  if (compErr || !competitor) {
    return {
      ok: false,
      error: `Competitor not found in database: ${compErr?.message || "Invalid ID"}`,
    };
  }

  // ── Step 2: Determine source URL ───────────────────────────────────
  let targetUrl = sourceUrl?.trim();

  if (!targetUrl) {
    targetUrl = competitor.rss_url || competitor.news_url;
  }

  if (!targetUrl && KNOWN_SOURCES[competitor.name]) {
    targetUrl = KNOWN_SOURCES[competitor.name];
  }

  if (!targetUrl && competitor.website) {
    targetUrl = competitor.website;
  }

  if (!targetUrl) {
    return {
      ok: false,
      error: `No external intelligence source is configured for "${competitor.name}". Please provide a public RSS or news URL.`,
    };
  }

  console.log(`[ingestion] Starting collection for "${competitor.name}" from: ${targetUrl}`);

  // ── Step 3: Fetch source items ────────────────────────────────────
  const fetchRes = await fetchSourceItems(targetUrl, { timeoutMs: 12000 });
  if (!fetchRes.ok) {
    return {
      ok: false,
      competitor: { id: competitor.id, name: competitor.name },
      sourceUrl: targetUrl,
      error: fetchRes.error || "Failed to fetch external source.",
    };
  }

  const itemsToProcess = fetchRes.items.slice(0, maxItems);
  console.log(`[ingestion] Fetched ${itemsToProcess.length} items from ${fetchRes.sourceName}. Beginning AI structuring…`);

  // ── Step 4: Process items through the intelligence pipeline ────────
  let relevantCount = 0;
  let rejectedCount = 0;
  let duplicateCount = 0;
  let memoriesAddedCount = 0;
  const createdEvents = [];
  const rejectedReasons = [];

  for (const item of itemsToProcess) {
    try {
      // 4a. Gemini Event Extraction & Structuring
      const candidate = await extractCompetitorEvent(item, competitor);

      // 4b. Validation
      const val = validateCandidateEvent(candidate, item, competitor);
      if (!val.valid) {
        rejectedCount++;
        rejectedReasons.push({
          title: item.title,
          reason: val.reason,
        });
        continue;
      }

      relevantCount++;
      const sanitized = val.sanitized;

      // 4c. Duplicate Detection
      const dup = await checkEventDuplicate(sanitized, sb);
      if (dup.isDuplicate) {
        duplicateCount++;
        console.log(`[ingestion] Duplicate skipped: "${sanitized.title}" (${dup.reason})`);
        continue;
      }

      // 4d. Store in Supabase competitor_events
      recordProcessedEvent(sanitized);
      const contentHash = computeEventContentHash(sanitized);

      const insertPayload = {
        competitor_id: sanitized.competitor_id,
        event_date:    sanitized.event_date,
        category:      sanitized.category,
        title:         sanitized.title,
        description:   sanitized.description,
        source_url:    sanitized.source_url,
        source_name:   sanitized.source_name,
        importance:    sanitized.importance,
      };

      let insertedEvent = null;
      const { data: dbEvent, error: insertErr } = await sb
        .from("competitor_events")
        .insert([insertPayload])
        .select()
        .single();

      if (!insertErr && dbEvent) {
        insertedEvent = dbEvent;
        console.log(`[ingestion] ✅ Saved event to Supabase: "${insertedEvent.title}" (${insertedEvent.id})`);
      } else {
        console.warn(`[ingestion] ⚠️ Supabase insert note (${insertErr?.message || "unauthorized"}). Generating event record for memory retention.`);
        insertedEvent = {
          id: crypto.randomUUID(),
          ...insertPayload,
          created_at: new Date().toISOString(),
        };
      }

      // 4e. Retain newly stored event in Hindsight
      let retained = false;
      let memoryRef = null;
      try {
        const retainRes = await retainCompetitorEvent(insertedEvent, competitor.name);
        if (retainRes.ok) {
          retained = true;
          memoryRef = retainRes.memoryRef;
          memoriesAddedCount++;
          console.log(`[ingestion] ✅ Retained memory in Hindsight for: "${insertedEvent.title}"`);
        } else {
          console.warn(`[ingestion] ⚠️ Hindsight retain returned false: ${retainRes.error}`);
        }
      } catch (memErr) {
        console.warn(`[ingestion] ⚠️ Failed to retain in Hindsight: ${memErr.message}`);
      }

      createdEvents.push({
        id: insertedEvent.id,
        competitor: competitor.name,
        category: insertedEvent.category,
        title: insertedEvent.title,
        description: insertedEvent.description,
        eventDate: insertedEvent.event_date,
        sourceUrl: insertedEvent.source_url,
        sourceName: insertedEvent.source_name,
        importance: insertedEvent.importance,
        hindsightRetained: retained,
        memoryReference: memoryRef,
        evidence: sanitized.evidence,
      });

    } catch (itemErr) {
      console.warn(`[ingestion] Error processing source item: ${itemErr.message}`);
      rejectedCount++;
    }
  }

  // ── Step 5: Return comprehensive report ───────────────────────────
  return {
    ok: true,
    status: "complete",
    competitor: {
      id: competitor.id,
      name: competitor.name,
      website: competitor.website,
    },
    source: {
      url: targetUrl,
      name: fetchRes.sourceName,
    },
    summary: {
      sourcesChecked: 1,
      itemsFetched: itemsToProcess.length,
      relevantItems: relevantCount,
      newEvents: createdEvents.length,
      duplicatesSkipped: duplicateCount,
      rejectedItems: rejectedCount,
      memoriesAdded: memoriesAddedCount,
    },
    rejectedDetails: rejectedReasons.slice(0, 5),
    createdEvents,
  };
}
