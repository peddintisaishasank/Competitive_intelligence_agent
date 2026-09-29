/**
 * db.js
 * ─────────────────────────────────────────────────────────────────
 * Clean data-access layer for the Competitive Intelligence Agent.
 *
 * All functions:
 *  - Try Supabase first (when credentials are configured)
 *  - Fall back to mockData.js automatically if Supabase is not yet set up
 *  - Return a consistent { data, error } shape
 *
 * This file is the ONLY place that talks to Supabase.
 * Components never import supabase directly.
 * ─────────────────────────────────────────────────────────────────
 */

import { supabase, isConfigured, ensureAuthenticatedSession } from "./supabaseClient.js";
import {
  competitors      as mockCompetitors,
  recentActivity   as mockActivity,
  activityCategories as mockCategories,
  aiInsights       as mockInsights,
  kpiSummary       as mockKPI,
} from "./mockData.js";

// ── Helper ────────────────────────────────────────────────────────
const DB_READY = isConfigured();

/** Wrap a value as a success result */
const ok  = (data)  => ({ data, error: null });
/** Wrap an error */
const err = (error) => ({ data: null, error });

// ═══════════════════════════════════════════════════════════════════
// COMPETITORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all competitors, ordered by name.
 * @returns {{ data: Competitor[], error: Error|null }}
 */
export async function getCompetitors() {
  if (!DB_READY) {
    console.info("[db] Supabase not configured — using mock competitors.");
    return ok(mockCompetitors);
  }
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("[db] getCompetitors() Supabase error:", error);
    return err(error);
  }
  console.info(`[db] getCompetitors() → ${data.length} rows from Supabase`);
  return ok(data);
}

/**
 * Get a single competitor by UUID.
 * @param {string} id
 * @returns {{ data: Competitor|null, error: Error|null }}
 */
export async function getCompetitorById(id) {
  if (!DB_READY) {
    const found = mockCompetitors.find(c => c.id === id) ?? null;
    return ok(found);
  }
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", id)
    .single();
  return error ? err(error) : ok(data);
}

/**
 * Create a new competitor.
 * @param {{ name: string, website?: string, industry?: string, description?: string }} payload
 * @returns {{ data: Competitor, error: Error|null }}
 */
export async function createCompetitor(payload) {
  if (!DB_READY) return err(new Error("Supabase not configured"));

  const { data, error } = await supabase
    .from("competitors")
    .insert([payload])
    .select()
    .single();

  if (error && error.code === "42501") {
    console.error("[db] RLS violation on competitors insert:", error);
    return err(new Error(
      "Row Level Security blocked this insert. " +
      "Please execute 'supabase/fix_rls_auth.sql' in the Supabase Dashboard SQL Editor to apply the restricted insert policy."
    ));
  }

  return error ? err(error) : ok(data);
}

/**
 * Update a competitor.
 * @param {string} id
 * @param {Partial<Competitor>} updates
 * @returns {{ data: Competitor, error: Error|null }}
 */
export async function updateCompetitor(id, updates) {
  if (!DB_READY) return err(new Error("Supabase not configured"));

  // Ensure authenticated session
  await ensureAuthenticatedSession();

  const { data, error } = await supabase
    .from("competitors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error && error.code === "42501") {
    return err(new Error(
      "Row Level Security blocked this update. Authenticated user required. " +
      "Please execute 'supabase/fix_rls_auth.sql' in the Supabase Dashboard SQL Editor."
    ));
  }

  return error ? err(error) : ok(data);
}

/**
 * Delete a competitor (cascade deletes its events automatically).
 * @param {string} id
 * @returns {{ data: null, error: Error|null }}
 */
export async function deleteCompetitor(id) {
  if (!DB_READY) return err(new Error("Supabase not configured"));

  // Ensure authenticated session
  await ensureAuthenticatedSession();

  const { data, error } = await supabase
    .from("competitors")
    .delete()
    .eq("id", id)
    .select("id");

  if (error && error.code === "42501") {
    return err(new Error(
      "Row Level Security blocked this deletion. Authenticated user required. " +
      "Please execute 'supabase/fix_rls_auth.sql' in the Supabase Dashboard SQL Editor."
    ));
  }

  if (!error && (!data || data.length === 0)) {
    return err(new Error(
      "Competitor was not deleted. The current Supabase role may not have delete permission."
    ));
  }

  return error ? err(error) : ok(null);
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITOR EVENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all events for a given competitor, ordered by date descending.
 * @param {string} competitorId
 * @returns {{ data: CompetitorEvent[], error: Error|null }}
 */
export async function getEventsByCompetitor(competitorId) {
  if (!DB_READY) {
    const filtered = mockActivity.filter(a => a.competitorId === competitorId);
    return ok(filtered);
  }
  const { data, error } = await supabase
    .from("competitor_events")
    .select("*")
    .eq("competitor_id", competitorId)
    .order("event_date", { ascending: false });
  return error ? err(error) : ok(data);
}

/**
 * Get all events across all competitors, ordered by date descending.
 * Used for the activity feed.
 * @param {number} [limit=50]
 * @returns {{ data: CompetitorEvent[], error: Error|null }}
 */
export async function getAllEvents(limit = 50) {
  if (!DB_READY) {
    console.info("[db] Supabase not configured — using mock activity.");
    return ok(mockActivity);
  }
  const { data, error } = await supabase
    .from("competitor_events")
    .select(`*, competitors(name, website, industry)`)
    .order("event_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[db] getAllEvents() Supabase error:", error);
    return err(error);
  }
  return ok(data);
}

/**
 * Create a new competitor event.
 * @param {{ competitor_id: string, event_date: string, category: string,
 *           title: string, description?: string, source_url?: string,
 *           source_name?: string, importance: string }} payload
 * @returns {{ data: CompetitorEvent, error: Error|null }}
 */
export async function createEvent(payload) {
  if (!DB_READY) return err(new Error("Supabase not configured"));
  await ensureAuthenticatedSession();
  const { data, error } = await supabase
    .from("competitor_events")
    .insert([payload])
    .select()
    .single();
  return error ? err(error) : ok(data);
}

/**
 * Update a competitor event.
 * @param {string} id
 * @param {Partial<CompetitorEvent>} updates
 * @returns {{ data: CompetitorEvent, error: Error|null }}
 */
export async function updateEvent(id, updates) {
  if (!DB_READY) return err(new Error("Supabase not configured"));
  await ensureAuthenticatedSession();
  const { data, error } = await supabase
    .from("competitor_events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return error ? err(error) : ok(data);
}

/**
 * Delete a competitor event.
 * @param {string} id
 * @returns {{ data: null, error: Error|null }}
 */
export async function deleteEvent(id) {
  if (!DB_READY) return err(new Error("Supabase not configured"));
  await ensureAuthenticatedSession();
  const { error } = await supabase
    .from("competitor_events")
    .delete()
    .eq("id", id);
  return error ? err(error) : ok(null);
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD AGGREGATES
// ═══════════════════════════════════════════════════════════════════

/**
 * Get KPI summary numbers for the dashboard header.
 * Queries counts from the database or derives from mock data.
 * @returns {{ data: KPISummary, error: Error|null }}
 */
export async function getKPISummary() {
  if (!DB_READY) {
    return ok(mockKPI);
  }

  // Run two count queries in parallel
  const [compResult, eventsResult] = await Promise.all([
    supabase.from("competitors").select("id", { count: "exact", head: true }),
    supabase.from("competitor_events").select("id", { count: "exact", head: true }),
  ]);

  if (compResult.error) {
    console.error("[db] getKPISummary() competitors count error:", compResult.error);
    return err(compResult.error);
  }
  if (eventsResult.error) {
    console.error("[db] getKPISummary() events count error:", eventsResult.error);
    return err(eventsResult.error);
  }

  // Events this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekStr = oneWeekAgo.toISOString().split("T")[0];

  const { count: weekCount, error: weekError } = await supabase
    .from("competitor_events")
    .select("id", { count: "exact", head: true })
    .gte("event_date", weekStr);

  if (weekError) return err(weekError);

  return ok({
    totalCompetitors: compResult.count ?? 0,
    activeAlerts: 0,        // Populated in Phase 4 (AI)
    eventsThisWeek: weekCount ?? 0,
    insightsGenerated: 0,   // Populated in Phase 4 (AI)
    lastRefreshed: new Date().toISOString(),
  });
}

/**
 * Get event counts grouped by category, for the Categories panel.
 * @returns {{ data: CategorySummary[], error: Error|null }}
 */
export async function getCategoryBreakdown() {
  if (!DB_READY) {
    return ok(mockCategories);
  }

  const { data, error } = await supabase
    .from("competitor_events")
    .select("category");

  if (error) {
    console.error("[db] getCategoryBreakdown() Supabase error:", error);
    return err(error);
  }

  // Count per category
  const counts = {};
  for (const row of data) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }

  const ICONS = {
    Product: "🚀", Pricing: "🏷️", Marketing: "📢",
    Partnership: "🤝", Hiring: "👥", Funding: "💰",
    Expansion: "🌍", Other: "📌",
  };
  const COLORS = {
    Product: "#6366f1", Pricing: "#10b981", Marketing: "#ef4444",
    Partnership: "#8b5cf6", Hiring: "#06b6d4", Funding: "#f59e0b",
    Expansion: "#0ea5e9", Other: "#94a3b8",
  };

  const result = Object.entries(counts).map(([label, count], i) => ({
    id: `cat-db-${i}`,
    label,
    count,
    icon: ICONS[label] ?? "📌",
    color: COLORS[label] ?? "#94a3b8",
    trend: 0, // Trend calculation reserved for Phase 4
  }));

  return ok(result);
}

/**
 * Get the most recent N events across all competitors, with competitor name joined.
 * Shapes output to match the existing activity feed component's data contract.
 * @param {number} [limit=10]
 * @returns {{ data: ActivityItem[], error: Error|null }}
 */
export async function getRecentActivity(limit = 10) {
  if (!DB_READY) {
    console.info("[db] Supabase not configured — using mock activity.");
    return ok(mockActivity.slice(0, limit));
  }

  const { data, error } = await supabase
    .from("competitor_events")
    .select(`
      id,
      event_date,
      category,
      title,
      description,
      source_name,
      source_url,
      importance,
      competitors (
        id,
        name
      )
    `)
    .order("event_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] getRecentActivity() Supabase error:", error);
    return err(error);
  }

  // Map DB rows → activity feed shape expected by activity.js component
  const IMPACT_MAP = { High: "high", Medium: "medium", Low: "low" };
  const CATEGORY_COLORS = {
    Product: "#6366f1", Pricing: "#10b981", Marketing: "#ef4444",
    Partnership: "#8b5cf6", Hiring: "#06b6d4", Funding: "#f59e0b",
    Expansion: "#0ea5e9", Other: "#94a3b8",
  };

  const mapped = (data ?? []).map(row => ({
    id: row.id,
    competitorId: row.competitors?.id ?? "",
    competitorName: row.competitors?.name ?? "Unknown",
    competitorLogo: (row.competitors?.name ?? "?").substring(0, 2).toUpperCase(),
    logoColor: CATEGORY_COLORS[row.category] ?? "#94a3b8",
    type: row.category.toLowerCase(),
    title: row.title,
    summary: row.description ?? "",
    timestamp: row.event_date,
    relativeTime: formatRelativeDate(row.event_date),
    impact: IMPACT_MAP[row.importance] ?? "medium",
    source: row.source_name ?? "Unknown",
    sourceUrl: row.source_url ?? "#",
    tags: [row.category],
  }));

  return ok(mapped);
}

// ── Local helper ──────────────────────────────────────────────────
function formatRelativeDate(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? "s" : ""} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${diffDays >= 60 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 365)} year${diffDays >= 730 ? "s" : ""} ago`;
}

/**
 * connectionTest()
 * Quick sanity check — call from the browser console to verify the connection.
 * Usage: import('./js/data/db.js').then(m => m.connectionTest())
 */
export async function connectionTest() {
  console.group("🔌 Supabase Connection Test");
  console.log("Config ready:", DB_READY);

  if (!DB_READY) {
    console.warn("Credentials not set in js/data/supabase.config.js — using mock data.");
    console.groupEnd();
    return { ok: false, mode: "mock" };
  }

  const { data: competitors, error } = await getCompetitors();
  if (error) {
    console.error("Connection FAILED:", error.message);
    console.groupEnd();
    return { ok: false, error: error.message };
  }

  console.log(`✅ Connected! Found ${competitors.length} competitors.`);
  console.table(competitors.map(c => ({ id: c.id, name: c.name, industry: c.industry })));
  console.groupEnd();
  return { ok: true, competitors };
}
