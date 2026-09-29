/**
 * services/intelligence/trendEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Trend & Pattern Intelligence Engine (Phase 10)
 *
 * Full Intelligence Pipeline:
 *   HISTORICAL EVENTS (Supabase)
 *          ↓
 *   QUANTITATIVE METRICS (periodComparison.js)
 *          ↓
 *   PATTERN DETECTION (patternDetection.js)
 *          ↓
 *   HINDSIGHT RECALL + REFLECT (contextual memory & synthesis)
 *          ↓
 *   GEMINI REASONING (evidence-based synthesis & refinement)
 *          ↓
 *   EVIDENCE-BACKED TREND INSIGHTS
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { resolveTimeWindows, calculateEventMetrics } from "./periodComparison.js";
import { detectPatterns } from "./patternDetection.js";
import {
  recallCompetitorMemory,
  reflectCompetitorMemories,
  hindsightStatus,
} from "../hindsight.js";
import { isGeminiAvailable, generateGeminiReasoning } from "../gemini.js";

// Lazy-init Supabase client for reading events
let _supabaseClient = null;

function getDb() {
  if (_supabaseClient) return _supabaseClient;
  const url = process.env.SUPABASE_URL || "https://jrtraipuqwvnyolzipas.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJhaXB1cXd2bnlvbHppcGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDI1NzgsImV4cCI6MjEwNjE3ODU3OH0.TzA7TmiB_1lKhz3XoHnJT6IG-vPZu4qUW2cyvHQ5KFg";
  _supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return _supabaseClient;
}

/**
 * Analyzes competitor trends over a specified time window.
 *
 * @param {object} params
 * @param {string} [params.competitorId] - UUID
 * @param {string} [params.competitorName] - Name
 * @param {string} [params.window="6m"] - '30d' | '90d' | '6m' | '12m' | 'custom'
 * @param {string} [params.customStart] - YYYY-MM-DD
 * @param {string} [params.customEnd] - YYYY-MM-DD
 * @param {boolean} [params.skipAI=false] - For quick quantitative tests
 */
export async function analyzeCompetitorTrends({
  competitorId,
  competitorName,
  window = "6m",
  customStart = null,
  customEnd = null,
  skipAI = false,
} = {}) {
  const sb = getDb();

  // 1. Resolve Competitor
  let comp = null;
  if (competitorId) {
    const { data } = await sb.from("competitors").select("*").eq("id", competitorId).single();
    comp = data;
  } else if (competitorName) {
    const { data } = await sb.from("competitors").select("*").ilike("name", `%${competitorName.trim()}%`).limit(1);
    comp = data?.[0] || null;
  }

  if (!comp) {
    // If not in DB, check fallback list
    const fallbackList = [
      { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567801", name: "AgroTech AI", industry: "AgriTech / AI" },
      { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567802", name: "FarmVision", industry: "AgriTech / Computer Vision" },
      { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567803", name: "CropMind", industry: "Precision Agriculture" },
    ];
    comp = fallbackList.find(c =>
      (competitorId && c.id === competitorId) ||
      (competitorName && c.name.toLowerCase().includes(competitorName.toLowerCase()))
    ) || { id: "unknown", name: competitorName || "Unknown Competitor", industry: "Technology" };
  }

  // 2. Fetch Structured Events from Supabase
  const { data: rawEvents, error: eventsErr } = await sb
    .from("competitor_events")
    .select(`
      id, event_date, category, title, description,
      source_name, source_url, importance
    `)
    .eq("competitor_id", comp.id)
    .order("event_date", { ascending: false });

  const events = rawEvents || [];

  // Determine latest event date for baseline calculation
  const latestEventDate = events.length > 0 && events[0].event_date
    ? new Date(events[0].event_date)
    : new Date();

  // 3. Resolve Time Windows
  const windows = resolveTimeWindows(window, customStart, customEnd, latestEventDate);

  // 4. Calculate Event Metrics (Counts, deltas, timelines)
  const metrics = calculateEventMetrics(events, windows);

  // 5. Detect Algorithmic Patterns (Rule-based, fully verified)
  let patterns = detectPatterns({
    competitorName: comp.name,
    metrics,
    windows,
  });

  // If insufficient data, return early
  if (events.length <= 1) {
    return {
      ok: true,
      competitor: comp,
      windows,
      metrics,
      patterns,
      hindsightReflection: null,
      executiveSummary: `${comp.name} has only ${events.length} recorded event in the database. Not enough historical data exists to establish reliable trends or patterns.`,
      generatedAt: new Date().toISOString(),
    };
  }

  // 6. Contextual Hindsight Recall & Reflect (if configured)
  let hindsightReflection = null;
  const hs = hindsightStatus();

  if (hs.configured && !skipAI) {
    try {
      const reflectQuery = `Analyze the historical activity of ${comp.name} over the past six months. Identify recurring themes, changes in activity, and notable sequences. Distinguish observations from interpretations.`;
      const reflectRes = await reflectCompetitorMemories(reflectQuery, { budget: "low" });
      if (reflectRes.ok && reflectRes.text) {
        hindsightReflection = reflectRes.text;
      }
    } catch (e) {
      console.warn("[trendEngine] Hindsight reflect non-fatal warning:", e.message);
    }
  }

  // 7. Gemini Reasoning & Synthesis
  let executiveSummary = `During ${windows.windowLabel}, ${comp.name} recorded ${metrics.totalCurrent} events compared to ${metrics.totalPrevious} in the preceding period (${metrics.totalPercentChange > 0 ? "+" : ""}${metrics.totalPercentChange}%).`;

  if (isGeminiAvailable() && !skipAI) {
    try {
      const geminiResult = await synthesizeWithGemini({
        competitor: comp,
        windows,
        metrics,
        patterns,
        hindsightReflection,
        events: metrics.currentEvents.concat(metrics.previousEvents.slice(0, 5)),
      });

      if (geminiResult.ok) {
        if (geminiResult.executiveSummary) {
          executiveSummary = geminiResult.executiveSummary;
        }
        if (Array.isArray(geminiResult.refinedPatterns) && geminiResult.refinedPatterns.length > 0) {
          // Merge Gemini-enhanced patterns while retaining validated evidenceEventIds
          patterns = mergePatterns(patterns, geminiResult.refinedPatterns, events);
        }
      }
    } catch (geminiErr) {
      console.warn("[trendEngine] Gemini synthesis non-fatal fallback:", geminiErr.message);
    }
  }

  return {
    ok: true,
    competitor: comp,
    windows,
    metrics: {
      totalEventsAllTime: metrics.totalEventsAllTime,
      totalCurrent: metrics.totalCurrent,
      totalPrevious: metrics.totalPrevious,
      totalChange: metrics.totalChange,
      totalPercentChange: metrics.totalPercentChange,
      categoryBreakdown: metrics.categoryBreakdown,
      monthlyTimeline: metrics.monthlyTimeline,
      importanceCurrent: metrics.importanceCurrent,
    },
    patterns,
    hindsightReflection,
    executiveSummary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compares trends between two competitors over the same time window.
 * Strictly descriptive and evidence-based (NO ranking, NO 'winning' or 'better' labels).
 */
export async function compareCompetitorTrends({
  competitorAId,
  competitorAName,
  competitorBId,
  competitorBName,
  window = "6m",
  customStart = null,
  customEnd = null,
} = {}) {
  const [compAData, compBData] = await Promise.all([
    analyzeCompetitorTrends({
      competitorId: competitorAId,
      competitorName: competitorAName,
      window,
      customStart,
      customEnd,
    }),
    analyzeCompetitorTrends({
      competitorId: competitorBId,
      competitorName: competitorBName,
      window,
      customStart,
      customEnd,
    }),
  ]);

  const nameA = compAData.competitor.name;
  const nameB = compBData.competitor.name;

  // Build neutral, factual comparison breakdown
  const comparison = {
    window: compAData.windows.windowLabel,
    period: compAData.windows.current.label,
    competitorA: {
      id: compAData.competitor.id,
      name: nameA,
      totalEventsCurrent: compAData.metrics.totalCurrent,
      totalEventsPrevious: compAData.metrics.totalPrevious,
      percentChange: compAData.metrics.totalPercentChange,
      topCategories: getTopCategories(compAData.metrics.categoryBreakdown),
      keyPatterns: compAData.patterns.map(p => ({
        type: p.type,
        title: p.title,
        observation: p.observation,
        confidence: p.confidence,
      })),
    },
    competitorB: {
      id: compBData.competitor.id,
      name: nameB,
      totalEventsCurrent: compBData.metrics.totalCurrent,
      totalEventsPrevious: compBData.metrics.totalPrevious,
      percentChange: compBData.metrics.totalPercentChange,
      topCategories: getTopCategories(compBData.metrics.categoryBreakdown),
      keyPatterns: compBData.patterns.map(p => ({
        type: p.type,
        title: p.title,
        observation: p.observation,
        confidence: p.confidence,
      })),
    },
    descriptiveAnalysis: generateNeutralComparisonText(compAData, compBData),
  };

  return {
    ok: true,
    comparison,
    compAData,
    compBData,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Invokes Gemini to produce concise, evidence-grounded pattern refinements.
 */
async function synthesizeWithGemini({
  competitor,
  windows,
  metrics,
  patterns,
  hindsightReflection,
  events,
}) {
  const systemPrompt = `You are the Competitive Intelligence Trend Reasoning Engine.
Analyze the provided competitor data strictly adhering to these rules:
1. STRICT DISTINCTION:
   - "observation": What the data directly shows (counts, dates, actual milestones).
   - "pattern": The relationship or repeated behavior across events.
   - "interpretation": AI hypothesis of what this might indicate (always use cautious phrasing like "may indicate", "suggests").
2. NEVER assume causation for event sequences; state them as chronological observations.
3. NEVER invent events, evidence IDs, or statistics. Only reference the supplied events.
4. Confidence must be "high", "medium", "low", or "insufficient".
5. Return JSON matching the schema below.`;

  const userPrompt = JSON.stringify({
    competitor: { name: competitor.name, industry: competitor.industry },
    window: windows.windowLabel,
    currentPeriod: windows.current.label,
    previousPeriod: windows.previous.label,
    quantitativeMetrics: {
      totalCurrent: metrics.totalCurrent,
      totalPrevious: metrics.totalPrevious,
      percentChange: metrics.totalPercentChange,
      categoryCounts: Object.fromEntries(
        Object.entries(metrics.categoryBreakdown)
          .filter(([, v]) => v.current > 0 || v.previous > 0)
          .map(([k, v]) => [k, { current: v.current, previous: v.previous, delta: v.change }])
      ),
    },
    algorithmicPatterns: patterns.map(p => ({
      type: p.type,
      title: p.title,
      observation: p.observation,
      pattern: p.pattern,
      interpretation: p.interpretation,
      evidenceEventIds: p.evidenceEventIds,
    })),
    hindsightReflection: hindsightReflection || "No reflection available",
    availableEvents: events.map(e => ({
      id: e.id,
      date: e.event_date,
      category: e.category,
      title: e.title,
      importance: e.importance,
    })),
    outputFormat: {
      executiveSummary: "Concise 2-3 sentence overview of activity shifts and strategic focus",
      refinedPatterns: [
        {
          type: "TREND_TYPE",
          title: "Clear descriptive title",
          observation: "Factual observation with specific counts",
          pattern: "Identified relationship across events",
          interpretation: "Hypothetical strategic meaning",
          confidence: "high | medium | low",
          evidenceEventIds: ["must be exact IDs from availableEvents"],
        }
      ]
    }
  });

  const res = await generateGeminiReasoning({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    timeoutMs: 14000,
  });

  if (!res.ok || !res.text) {
    return { ok: false };
  }

  try {
    const parsed = JSON.parse(res.text);
    return {
      ok: true,
      executiveSummary: parsed.executiveSummary,
      refinedPatterns: parsed.refinedPatterns,
    };
  } catch (err) {
    return { ok: false };
  }
}

/**
 * Merges Gemini patterns with algorithmic patterns, strictly validating evidenceEventIds.
 */
function mergePatterns(algorithmicPatterns, geminiPatterns, allEvents) {
  const validIds = new Set(allEvents.map(e => e.id));
  const eventMap = new Map(allEvents.map(e => [e.id, {
    id: e.id,
    date: e.event_date,
    category: e.category,
    title: e.title,
    importance: e.importance,
    source: e.source_name || "Supabase",
  }]));

  const validGeminiPatterns = [];

  for (const gp of geminiPatterns) {
    // Only accept patterns where evidenceEventIds actually exist in our DB
    const verifiedIds = (gp.evidenceEventIds || []).filter(id => validIds.has(id));
    if (verifiedIds.length > 0 && gp.observation && gp.pattern) {
      validGeminiPatterns.push({
        id: `gemini-pat-${Math.random().toString(36).substring(2, 9)}`,
        type: gp.type || "ACTIVITY_INCREASE",
        title: gp.title || "Identified Pattern",
        observation: gp.observation,
        pattern: gp.pattern,
        interpretation: gp.interpretation || gp.pattern,
        confidence: ["high", "medium", "low"].includes(gp.confidence?.toLowerCase())
          ? gp.confidence.toLowerCase()
          : "medium",
        evidenceEventIds: verifiedIds,
        evidence: verifiedIds.map(id => eventMap.get(id)).filter(Boolean),
      });
    }
  }

  if (validGeminiPatterns.length > 0) {
    // Return refined patterns combined with any sequential patterns from algorithm
    const sequential = algorithmicPatterns.filter(p => p.type === "SEQUENTIAL_PATTERN");
    return [...validGeminiPatterns, ...sequential];
  }

  return algorithmicPatterns;
}

function getTopCategories(categoryBreakdown) {
  return Object.values(categoryBreakdown)
    .filter(c => c.current > 0)
    .sort((a, b) => b.current - a.current)
    .map(c => `${c.category} (${c.current})`);
}

function generateNeutralComparisonText(dataA, dataB) {
  const nameA = dataA.competitor.name;
  const nameB = dataB.competitor.name;
  const countA = dataA.metrics.totalCurrent;
  const countB = dataB.metrics.totalCurrent;
  const catsA = getTopCategories(dataA.metrics.categoryBreakdown).slice(0, 2).join(", ") || "None";
  const catsB = getTopCategories(dataB.metrics.categoryBreakdown).slice(0, 2).join(", ") || "None";

  return `During the analyzed period (${dataA.windows.windowLabel}), ${nameA} recorded ${countA} public events primarily focused in ${catsA}. In comparison, ${nameB} registered ${countB} public events with emphasis in ${catsB}. Neither profile demonstrates superior performance; each reflects distinct operational focuses and strategic pacing based on recorded milestones.`;
}
