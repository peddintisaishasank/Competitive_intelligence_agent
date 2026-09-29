/**
 * services/agent/tools.js
 * ─────────────────────────────────────────────────────────────────
 * Competitive Intelligence Agent Tools
 *
 * Provides the 4 core tools the agent uses to investigate questions:
 *   1. recallMemory       - Hindsight persistent memory retrieval
 *   2. getCompetitorEvents- Supabase structured competitor events
 *   3. getCompetitor      - Supabase competitor profile data
 *   4. reflectOnMemories  - Hindsight multi-event pattern reflection
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import {
  recallCompetitorMemory,
  reflectCompetitorMemories,
} from "../hindsight.js";

// ── Shared Supabase Client ────────────────────────────────────────
let _supabaseClient = null;

function getDbClient() {
  if (_supabaseClient) return _supabaseClient;
  const url = process.env.SUPABASE_URL || "https://jrtraipuqwvnyolzipas.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJhaXB1cXd2bnlvbHppcGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDI1NzgsImV4cCI6MjEwNjE3ODU3OH0.TzA7TmiB_1lKhz3XoHnJT6IG-vPZu4qUW2cyvHQ5KFg";
  _supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseClient;
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 1 — recallMemory
// ═══════════════════════════════════════════════════════════════════
/**
 * Searches Hindsight long-term memory for relevant competitor intelligence.
 *
 * @param {object} params
 * @param {string} params.query          - Natural-language search query
 * @param {string} [params.competitor]   - Optional competitor name
 * @param {string} [params.timePeriod]   - Optional time period hint
 * @returns {Promise<{ ok: boolean, memories: Array, count: number, error?: string }>}
 */
export async function recallMemory({ query, competitor, timePeriod } = {}) {
  let searchPrompt = query || "";
  if (competitor && !searchPrompt.toLowerCase().includes(competitor.toLowerCase())) {
    searchPrompt = `${competitor} ${searchPrompt}`;
  }
  if (timePeriod && !searchPrompt.toLowerCase().includes(timePeriod.toLowerCase())) {
    searchPrompt = `${searchPrompt} during ${timePeriod}`;
  }

  const res = await recallCompetitorMemory(searchPrompt.trim());
  if (!res.ok) {
    return { ok: false, memories: [], count: 0, error: res.error };
  }

  // Filter or prioritize memories matching the target competitor if specified
  let memories = res.results || [];
  if (competitor) {
    const compLower = competitor.toLowerCase();
    memories = memories.filter(m => {
      const matchText = (m.text || "").toLowerCase().includes(compLower);
      const matchMeta = (m.metadata?.competitor || "").toLowerCase().includes(compLower);
      const matchEntity = Array.isArray(m.entities) && m.entities.some(e =>
        String(typeof e === "string" ? e : e?.name || "").toLowerCase().includes(compLower)
      );
      return matchText || matchMeta || matchEntity;
    });
    // If filtering was too strict and left 0 results, fall back to general recall results
    if (memories.length === 0 && res.results.length > 0) {
      memories = res.results.slice(0, 10);
    }
  }

  return {
    ok: true,
    memories,
    count: memories.length,
    entities: res.entities || [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 2 — getCompetitorEvents
// ═══════════════════════════════════════════════════════════════════
/**
 * Retrieves structured competitor events from Supabase.
 *
 * @param {object} params
 * @param {string} [params.competitorName] - Name of competitor (or partial match)
 * @param {string} [params.competitorId]   - Exact UUID of competitor
 * @param {string} [params.category]       - Event category (Product, Pricing, Partnership, etc.)
 * @param {string} [params.startDate]      - ISO or YYYY-MM-DD start date
 * @param {string} [params.endDate]        - ISO or YYYY-MM-DD end date
 * @param {number} [params.limit=15]       - Max events to retrieve
 * @returns {Promise<{ ok: boolean, events: Array, count: number, error?: string }>}
 */
export async function getCompetitorEvents({
  competitorName,
  competitorId,
  category,
  startDate,
  endDate,
  limit = 20,
} = {}) {
  const sb = getDbClient();

  try {
    let q = sb
      .from("competitor_events")
      .select(`
        id, event_date, category, title, description,
        source_name, source_url, importance,
        competitors ( id, name, industry )
      `)
      .order("event_date", { ascending: false })
      .limit(limit);

    if (competitorId) {
      q = q.eq("competitor_id", competitorId);
    }

    if (category) {
      q = q.ilike("category", `%${category}%`);
    }

    if (startDate) {
      q = q.gte("event_date", startDate);
    }

    if (endDate) {
      q = q.lte("event_date", endDate);
    }

    const { data, error } = await q;

    if (error) {
      return { ok: false, events: [], count: 0, error: error.message };
    }

    let events = (data || []).map(row => ({
      id:          row.id,
      date:        row.event_date,
      category:    row.category,
      title:       row.title,
      description: row.description,
      source:      row.source_name,
      url:         row.source_url,
      importance:  row.importance,
      competitor:  row.competitors?.name || "Unknown Competitor",
      competitorId:row.competitors?.id || null,
    }));

    if (competitorName) {
      const nameLower = competitorName.toLowerCase();
      events = events.filter(e => e.competitor.toLowerCase().includes(nameLower));
    }

    return {
      ok: true,
      events,
      count: events.length,
    };
  } catch (err) {
    return { ok: false, events: [], count: 0, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 3 — getCompetitor
// ═══════════════════════════════════════════════════════════════════
/**
 * Retrieves competitor profile information from Supabase.
 *
 * @param {object} params
 * @param {string} [params.name]         - Name or partial name
 * @param {string} [params.competitorId] - UUID
 * @returns {Promise<{ ok: boolean, competitor: object | null, allCompetitors: Array, error?: string }>}
 */
export async function getCompetitor({ name, competitorId } = {}) {
  const sb = getDbClient();

  try {
    const { data: all, error: allErr } = await sb
      .from("competitors")
      .select("id, name, website, industry, description");

    if (allErr) {
      return { ok: false, competitor: null, allCompetitors: [], error: allErr.message };
    }

    let match = null;
    if (competitorId) {
      match = (all || []).find(c => c.id === competitorId);
    } else if (name) {
      const nameLower = name.toLowerCase().trim();
      match = (all || []).find(c => c.name.toLowerCase().includes(nameLower));
    }

    return {
      ok: true,
      competitor: match || null,
      allCompetitors: all || [],
    };
  } catch (err) {
    return { ok: false, competitor: null, allCompetitors: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 4 — reflectOnMemories
// ═══════════════════════════════════════════════════════════════════
/**
 * Uses Hindsight Reflect to identify high-level strategic shifts,
 * recurring patterns, or trends over time across competitor actions.
 *
 * @param {object} params
 * @param {string} params.query          - Synthesis question
 * @param {string} [params.context]      - Additional background context
 * @returns {Promise<{ ok: boolean, reflection: string, basedOn?: any, error?: string }>}
 */
export async function reflectOnMemories({ query, context } = {}) {
  const res = await reflectCompetitorMemories(query, { context, budget: "mid" });
  if (!res.ok) {
    return { ok: false, reflection: "", error: res.error };
  }

  return {
    ok: true,
    reflection: res.text,
    basedOn: res.basedOn,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 5 — analyzeCompetitorTrendsTool (Phase 10)
// ═══════════════════════════════════════════════════════════════════
/**
 * Uses the Trend & Pattern Intelligence Engine to evaluate historical patterns,
 * category shifts, sequential moves, and activity velocity over time.
 */
export async function analyzeCompetitorTrendsTool({ competitorId, competitorName, window = "6m", customStart, customEnd } = {}) {
  const { analyzeCompetitorTrends } = await import("../intelligence/trendEngine.js");
  return analyzeCompetitorTrends({ competitorId, competitorName, window, customStart, customEnd });
}

// ═══════════════════════════════════════════════════════════════════
// TOOL 6 — compareCompetitorTrendsTool (Phase 10)
// ═══════════════════════════════════════════════════════════════════
/**
 * Compares two competitors over the same time window using evidence-based metrics.
 */
export async function compareCompetitorTrendsTool({ competitorAId, competitorAName, competitorBId, competitorBName, window = "6m" } = {}) {
  const { compareCompetitorTrends } = await import("../intelligence/trendEngine.js");
  return compareCompetitorTrends({ competitorAId, competitorAName, competitorBId, competitorBName, window });
}

