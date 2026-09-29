/**
 * services/hindsight.js
 * ─────────────────────────────────────────────────────────────────
 * Server-side Hindsight memory service.
 *
 * Phase 7 — RETAIN + RECALL only.
 * Reflect is NOT implemented in this phase.
 *
 * All secrets (HINDSIGHT_API_KEY) stay in this module.
 * This file is NEVER imported from the browser/frontend.
 *
 * Architecture:
 *   Supabase competitor_events
 *        ↓
 *   retainCompetitorEvent()   ← called after DB insert
 *        ↓
 *   Hindsight RETAIN  →  Memory Bank: "competitive-intelligence"
 *        ↑
 *   recallCompetitorMemory()  ← called by /api/hindsight/recall
 *        ↑
 *   Hindsight RECALL
 *
 * ─────────────────────────────────────────────────────────────────
 */

import { HindsightClient } from "@vectorize-io/hindsight-client";
import { createClient }     from "@supabase/supabase-js";

// ── Config validation ─────────────────────────────────────────────

function assertEnv(name) {
  const val = process.env[name];
  if (!val || val.trim() === "") {
    throw new Error(
      `[hindsight] Missing environment variable: ${name}. ` +
      `Add it to your .env file.`
    );
  }
  return val.trim();
}

// ── Lazy-init Hindsight client (created once) ─────────────────────
let _hindsightClient = null;
let _bankId          = null;

function getHindsightClient() {
  if (_hindsightClient) return { client: _hindsightClient, bankId: _bankId };

  const apiKey  = assertEnv("HINDSIGHT_API_KEY");
  const baseUrl = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
  _bankId       = process.env.HINDSIGHT_BANK_ID  || "competitive-intelligence";

  _hindsightClient = new HindsightClient({ baseUrl, apiKey });
  return { client: _hindsightClient, bankId: _bankId };
}

// ── Lazy-init Supabase service-role client ────────────────────────
// Used server-side ONLY to read competitors and mark events as synced.
let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL || "https://jrtraipuqwvnyolzipas.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJhaXB1cXd2bnlvbHppcGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDI1NzgsImV4cCI6MjEwNjE3ODU3OH0.TzA7TmiB_1lKhz3XoHnJT6IG-vPZu4qUW2cyvHQ5KFg";
  if (!url || !key) {
    throw new Error(
      "[hindsight] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set."
    );
  }
  _supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseAdmin;
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY BANK SETUP
// ═══════════════════════════════════════════════════════════════════

/**
 * Ensure the competitive-intelligence memory bank exists.
 * Creates or updates it idempotently.
 * Safe to call on every server start.
 */
export async function ensureMemoryBank() {
  const { client, bankId } = getHindsightClient();

  try {
    console.log(`[hindsight] Ensuring memory bank "${bankId}" exists…`);
    const profile = await client.createBank(bankId, {
      name: "Competitive Intelligence",
      reflectMission:
        "This memory bank contains long-term competitive intelligence about companies, " +
        "products, pricing, partnerships, hiring, marketing, funding, expansion, and other " +
        "competitor activities. The goal is to preserve historical context so an AI agent " +
        "can identify changes and patterns over time.",
    });
    console.log(`[hindsight] ✅ Memory bank "${bankId}" ready.`);
    return { ok: true, bankId, profile };
  } catch (err) {
    console.error("[hindsight] ensureMemoryBank error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVERT EVENT → NATURAL LANGUAGE MEMORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert a Supabase competitor_event row into rich natural-language memory content.
 * The memory must contain enough context to be useful when recalled months later.
 *
 * @param {object} event         - competitor_event row
 * @param {string} competitorName - human-readable competitor name
 * @returns {string}             - natural-language memory text
 */
function buildMemoryContent(event, competitorName) {
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "an unspecified date";

  let content = `${competitorName} had a ${event.importance.toLowerCase()}-importance ` +
    `${event.category} event on ${date}: "${event.title}".`;

  if (event.description) {
    content += ` ${event.description}`;
  }

  if (event.source_name) {
    content += ` (Source: ${event.source_name}.)`;
  }

  content += ` [Category: ${event.category} | Importance: ${event.importance} | ` +
    `Competitor: ${competitorName} | Event ID: ${event.id}]`;

  return content;
}

// ═══════════════════════════════════════════════════════════════════
// RETAIN — Store one competitor event into Hindsight memory
// ═══════════════════════════════════════════════════════════════════

/**
 * retainCompetitorEvent()
 *
 * Stores a single Supabase competitor event into the Hindsight memory bank.
 * Idempotent: checks hindsight_retained flag before retaining.
 * Marks the Supabase row as retained after successful retain.
 *
 * @param {object}  event          - Full competitor_events row (must include .id)
 * @param {string}  competitorName - Human-readable competitor name
 * @param {boolean} [force=false]  - Bypass the duplicate check (use only for testing)
 * @returns {{ ok: boolean, skipped?: boolean, memoryRef?: string, error?: string }}
 */
export async function retainCompetitorEvent(event, competitorName, force = false) {
  if (!event?.id) {
    return { ok: false, error: "Event must have an ID." };
  }

  // ── Duplicate prevention ─────────────────────────────────────────
  if (!force && event.hindsight_retained === true) {
    console.log(`[hindsight/retain] Skipping already-retained event: ${event.id}`);
    return { ok: true, skipped: true };
  }

  const { client, bankId } = getHindsightClient();

  // ── Build rich natural-language memory ───────────────────────────
  const content = buildMemoryContent(event, competitorName);

  // ── Use the ACTUAL event date as the memory timestamp ────────────
  // This is critical for temporal queries like "what happened in April 2026?"
  const memoryTimestamp = event.event_date
    ? new Date(event.event_date).toISOString()
    : new Date().toISOString();

  try {
    console.log(`[hindsight/retain] Retaining event "${event.title}" (${event.id})…`);

    await client.retain(bankId, content, {
      timestamp: memoryTimestamp,
      metadata: {
        source:         "competitive-intelligence-agent",
        event_id:       event.id,
        competitor:     competitorName,
        category:       event.category,
        importance:     event.importance,
        event_date:     event.event_date,
      },
    });

    console.log(`[hindsight/retain] ✅ Retained: ${event.id}`);

    // ── Mark as retained in Supabase ─────────────────────────────────
    try {
      const sb = getSupabaseAdmin();
      await sb
        .from("competitor_events")
        .update({
          hindsight_retained:    true,
          hindsight_retained_at: new Date().toISOString(),
          hindsight_memory_ref:  `${bankId}/${event.id}`,
        })
        .eq("id", event.id);
    } catch (dbErr) {
      // Non-fatal: memory was retained in Hindsight, DB mark failed
      console.warn(
        `[hindsight/retain] ⚠️  Memory retained but failed to mark in Supabase: ${dbErr.message}`
      );
    }

    return { ok: true, memoryRef: `${bankId}/${event.id}` };

  } catch (err) {
    console.error(`[hindsight/retain] ❌ Failed for event ${event.id}:`, err.message);
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SYNC — Bulk-retain all unsynced existing events
// ═══════════════════════════════════════════════════════════════════

/**
 * syncExistingEventsToHindsight()
 *
 * Finds all competitor_events where hindsight_retained = false,
 * then retains them one by one with their competitor context.
 *
 * Returns a summary:
 * { processed, successful, failed, skipped, errors[] }
 *
 * Errors are reported but do NOT falsely mark events as synced.
 */
export async function syncExistingEventsToHindsight() {
  const summary = { processed: 0, successful: 0, failed: 0, skipped: 0, errors: [] };

  const sb = getSupabaseAdmin();

  // Fetch all un-synced events with their competitor name
  const { data: events, error } = await sb
    .from("competitor_events")
    .select(`
      id, event_date, category, title, description,
      source_name, source_url, importance, hindsight_retained,
      competitors ( id, name )
    `)
    .eq("hindsight_retained", false)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[hindsight/sync] Failed to fetch events:", error.message);
    return { ...summary, errors: [error.message] };
  }

  if (!events || events.length === 0) {
    console.log("[hindsight/sync] No un-synced events found.");
    return summary;
  }

  console.log(`[hindsight/sync] Syncing ${events.length} un-retained events…`);
  summary.processed = events.length;

  for (const event of events) {
    const competitorName = event.competitors?.name ?? "Unknown Competitor";
    const result = await retainCompetitorEvent(event, competitorName);

    if (result.skipped) {
      summary.skipped++;
    } else if (result.ok) {
      summary.successful++;
    } else {
      summary.failed++;
      summary.errors.push({ eventId: event.id, error: result.error });
    }

    // Small delay to avoid rate-limit bursts
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(
    `[hindsight/sync] ✅ Done. ${summary.successful} synced, ` +
    `${summary.failed} failed, ${summary.skipped} skipped.`
  );
  return summary;
}

// ═══════════════════════════════════════════════════════════════════
// RECALL — Retrieve relevant memories from Hindsight
// ═══════════════════════════════════════════════════════════════════

/**
 * recallCompetitorMemory()
 *
 * Sends a natural-language query to Hindsight Recall and returns
 * relevant historical memories.
 *
 * Hindsight uses its own multi-strategy retrieval (semantic, keyword,
 * entity graph, temporal). We do NOT implement any custom vector search.
 *
 * @param {string} query  - Natural-language question about competitor history
 * @returns {{ ok: boolean, results: MemoryResult[], entities?: any[], error?: string }}
 */
export async function recallCompetitorMemory(query) {
  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return { ok: false, results: [], error: "Query must be at least 3 characters." };
  }

  const { client, bankId } = getHindsightClient();

  try {
    console.log(`[hindsight/recall] Query: "${query}"`);

    const response = await client.recall(bankId, query.trim());

    const results = (response?.results ?? []).map(r => ({
      id:        r.id,
      text:      r.text      ?? r.content ?? "",
      type:      r.type      ?? "memory",
      score:     r.scores?.final ?? r.score ?? r.relevance ?? null,
      timestamp: r.occurred_start ?? r.mentioned_at ?? r.timestamp ?? r.date ?? null,
      metadata:  r.metadata  ?? {},
      entities:  r.entities  ?? [],
    }));

    console.log(`[hindsight/recall] ✅ Returned ${results.length} memories.`);
    return { ok: true, results, entities: response?.entities ?? [] };

  } catch (err) {
    console.error("[hindsight/recall] ❌ Error:", err.message);
    return { ok: false, results: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// REFLECT — Synthesize patterns, trends, and relationships over time
// ═══════════════════════════════════════════════════════════════════

/**
 * reflectCompetitorMemories()
 *
 * Uses official Hindsight Reflect API to reason over accumulated memories,
 * detecting recurring patterns, timeline evolutions, strategic shifts,
 * and high-level relationships across competitor actions.
 *
 * @param {string} query   - Analytical or comparative question
 * @param {object} options - Optional context, budget, etc.
 * @returns {{ ok: boolean, text: string, basedOn?: any, usage?: any, error?: string }}
 */
export async function reflectCompetitorMemories(query, options = {}) {
  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return { ok: false, text: "", error: "Query must be at least 3 characters." };
  }

  const { client, bankId } = getHindsightClient();

  try {
    console.log(`[hindsight/reflect] Query: "${query}"`);
    const response = await client.reflect(bankId, query.trim(), {
      context: options.context,
      budget: options.budget || "mid",
    });

    console.log(`[hindsight/reflect] ✅ Reflection generated successfully.`);
    return {
      ok: true,
      text: response?.text ?? "",
      basedOn: response?.based_on ?? null,
      usage: response?.usage ?? null,
    };
  } catch (err) {
    console.error("[hindsight/reflect] ❌ Error:", err.message);
    return { ok: false, text: "", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// STATUS CHECK
// ═══════════════════════════════════════════════════════════════════

/**
 * hindsightStatus()
 * Returns whether Hindsight is configured and the bank ID being used.
 * NEVER returns the API key.
 */
export function hindsightStatus() {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  const bankId = (process.env.HINDSIGHT_BANK_ID || "competitive-intelligence").trim();
  return {
    configured: Boolean(apiKey && apiKey.length > 10),
    bankId,
    baseUrl: process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io",
  };
}

/**
 * testHindsightConnection(timeoutMs)
 * Actively checks that Hindsight is reachable and the memory bank is accessible.
 * Safe: never returns secrets.
 */
export async function testHindsightConnection(timeoutMs = 6000) {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  const bankId = (process.env.HINDSIGHT_BANK_ID || "competitive-intelligence").trim();

  if (!apiKey || apiKey.trim().length < 10) {
    return {
      ok: false,
      configured: false,
      connected: false,
      bankId,
      error: "HINDSIGHT_API_KEY is not configured in .env",
    };
  }

  try {
    const { client } = getHindsightClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    await client.getBankConfig(bankId, { signal: controller.signal });
    clearTimeout(timer);

    return {
      ok: true,
      configured: true,
      connected: true,
      bankId,
    };
  } catch (err) {
    let msg = err.message || "Failed to reach Hindsight API";
    if (err.name === "AbortError" || msg.toLowerCase().includes("abort")) {
      msg = `Connection timed out after ${timeoutMs / 1000}s`;
    }
    return {
      ok: false,
      configured: true,
      connected: false,
      bankId,
      error: msg,
    };
  }
}

