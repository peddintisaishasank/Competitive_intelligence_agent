/**
 * services/agent/agent.js
 * ─────────────────────────────────────────────────────────────────
 * Competitive Intelligence Agent
 *
 * Implements the full Phase 8 agent reasoning pipeline:
 *
 *   USER QUESTION
 *         ↓
 *   UNDERSTAND INTENT & ENTITIES (incorporates conversation history)
 *         ↓
 *   RETRIEVE RELEVANT MEMORY (Hindsight Recall)
 *         ↓
 *   RETRIEVE STRUCTURED EVENTS (Supabase)
 *         ↓
 *   APPLY REFLECTION IF PATTERN / TREND QUERY (Hindsight Reflect)
 *         ↓
 *   REASON OVER EVIDENCE (Gemini / Hindsight Synthesis)
 *         ↓
 *   STRICTLY DISTINGUISH:
 *     - OBSERVED (direct facts)
 *     - INTERPRETATION (inferred patterns)
 *     - UNCERTAINTY (limitations/data gaps)
 *         ↓
 *   GENERATE EVIDENCE & SOURCES
 * ─────────────────────────────────────────────────────────────────
 */

import {
  recallMemory,
  getCompetitorEvents,
  getCompetitor,
  reflectOnMemories,
  analyzeCompetitorTrendsTool,
  compareCompetitorTrendsTool,
} from "./tools.js";
import {
  isGeminiAvailable,
  generateGeminiReasoning,
} from "../gemini.js";

// Known competitors in our system
const KNOWN_COMPETITORS = [
  { name: "AgroTech AI", aliases: ["agrotech", "agrotech ai", "agro tech"] },
  { name: "FarmVision",  aliases: ["farmvision", "farm vision"] },
  { name: "CropMind",    aliases: ["cropmind", "crop mind"] },
];

const CATEGORIES = [
  "product", "pricing", "partnership", "hiring", "funding", "expansion", "award",
];

/**
 * Resolves competitor(s) mentioned in message or carried from conversation history.
 */
function resolveCompetitors(message, competitorId, history = []) {
  const msgLower = (message || "").toLowerCase();
  const matched = [];

  for (const comp of KNOWN_COMPETITORS) {
    if (comp.aliases.some(alias => msgLower.includes(alias))) {
      matched.push(comp.name);
    }
  }

  // If no competitor in the current message, check conversation history (e.g. "What about its pricing?")
  if (matched.length === 0 && history && history.length > 0) {
    const hasPronoun = /\b(it|its|they|their|that company|the competitor|them)\b/i.test(message);
    if (hasPronoun || message.trim().split(" ").length <= 5) {
      for (let i = history.length - 1; i >= 0; i--) {
        const prev = (history[i]?.content || history[i]?.message || "").toLowerCase();
        for (const comp of KNOWN_COMPETITORS) {
          if (comp.aliases.some(alias => prev.includes(alias))) {
            matched.push(comp.name);
            break;
          }
        }
        if (matched.length > 0) break;
      }
    }
  }

  // If no known competitor matched, see if user is asking about an unknown competitor name
  if (matched.length === 0) {
    const entityMatch = message.match(/(?:what has|what about|has|did|for|about|compare|versus|vs)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\s+done|\s+been|\s+had|\s+made|\s+launched|\s+raised|\s+announced|\?|$)/i);
    if (entityMatch && entityMatch[1]) {
      const candidate = entityMatch[1].trim();
      if (!/^(the|any|all|our|my|some|competitor|competitors|market|industry|events|activities|funding|pricing|product)$/i.test(candidate)) {
        matched.push(candidate);
      }
    }
  }

  return Array.from(new Set(matched));
}

/**
 * Detects whether the query asks for pattern recognition, trends, shifts, or comparison.
 */
function isPatternOrComparisonQuery(text = "") {
  const patterns = [
    "pattern", "trend", "shift", "change", "over time", "compare", "comparison",
    "versus", "recurring", "evolution", "increase", "strategy", "grow", "growth",
    "before and after", "what changed", "how has", "are there signs",
  ];
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Detects target category from query keywords.
 */
function detectCategory(text = "") {
  const lower = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (lower.includes(cat)) return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  return null;
}

/**
 * Main Competitive Intelligence Agent Execution.
 *
 * @param {object} params
 * @param {string} params.message             - User question
 * @param {string} [params.competitorId]      - Optional competitor ID
 * @param {object} [params.timeRange]         - Optional { start, end }
 * @param {Array}  [params.conversationHistory]- Prior messages in session
 * @returns {Promise<object>} Clean structured agent response
 */
export async function runCompetitiveIntelligenceAgent({
  message,
  competitorId,
  timeRange,
  conversationHistory = [],
} = {}) {
  const startTime = Date.now();

  if (!message || typeof message !== "string" || message.trim().length < 2) {
    return {
      status: "error",
      message: "Please enter a question for the Competitive Intelligence Agent.",
      answer: "Please ask a question about your competitors.",
      evidence: [],
      memoriesUsed: [],
      eventsUsed: [],
    };
  }

  const query = message.trim();
  console.log(`[agent] Received question: "${query}"`);

  // ── Step 1: Understand Intent & Entities ─────────────────────────
  const targetCompetitors = resolveCompetitors(query, competitorId, conversationHistory);
  const detectedCat = detectCategory(query);
  const needsReflection = isPatternOrComparisonQuery(query);

  console.log(`[agent] Resolved competitors: ${JSON.stringify(targetCompetitors)}, category: ${detectedCat}, reflection needed: ${needsReflection}`);

  // ── Step 2: Retrieve Relevant Memories (Hindsight Recall) ────────
  let recalledMemories = [];
  const primaryCompetitor = targetCompetitors[0] || null;

  try {
    const memoryRes = await recallMemory({
      query,
      competitor: primaryCompetitor,
      timePeriod: timeRange?.start ? `${timeRange.start} to ${timeRange.end || 'now'}` : null,
    });
    recalledMemories = memoryRes.memories || [];

    // If a specific competitor is targeted, filter memories strictly
    if (primaryCompetitor) {
      const compLower = primaryCompetitor.toLowerCase();
      recalledMemories = recalledMemories.filter(m => {
        const matchText = (m.text || "").toLowerCase().includes(compLower);
        const matchMeta = (m.metadata?.competitor || "").toLowerCase().includes(compLower);
        const matchEntity = Array.isArray(m.entities) && m.entities.some(e =>
          String(typeof e === "string" ? e : e?.name || "").toLowerCase().includes(compLower)
        );
        return matchText || matchMeta || matchEntity;
      });
    }

    // If query compares two competitors, recall for the second one as well
    if (targetCompetitors.length > 1) {
      const secondRes = await recallMemory({
        query,
        competitor: targetCompetitors[1],
      });
      if (secondRes.ok && secondRes.memories.length > 0) {
        const comp2Lower = targetCompetitors[1].toLowerCase();
        const secondMemories = secondRes.memories.filter(m =>
          (m.text || "").toLowerCase().includes(comp2Lower) ||
          (m.metadata?.competitor || "").toLowerCase().includes(comp2Lower)
        );
        recalledMemories = [...recalledMemories, ...secondMemories];
      }
    }
  } catch (err) {
    console.warn("[agent] Hindsight recall failed:", err.message);
  }

  // ── Step 3: Retrieve Structured Events (Supabase) ────────────────
  let structuredEvents = [];
  try {
    const eventParams = {
      limit: 25,
      category: detectedCat,
      startDate: timeRange?.start || null,
      endDate: timeRange?.end || null,
    };

    if (targetCompetitors.length === 1) {
      eventParams.competitorName = targetCompetitors[0];
    }

    const eventsRes = await getCompetitorEvents(eventParams);
    if (eventsRes.ok) {
      structuredEvents = eventsRes.events || [];
      // If we have specific target competitors, filter strictly to them
      if (targetCompetitors.length > 0) {
        structuredEvents = structuredEvents.filter(e =>
          targetCompetitors.some(c => e.competitor.toLowerCase().includes(c.toLowerCase()))
        );
      }
    }
  } catch (err) {
    console.warn("[agent] Supabase events retrieval failed:", err.message);
  }

  // ── Step 4: Use Trend & Pattern Intelligence Engine (Phase 10) ────
  let hindsightReflection = "";
  let trendData = null;

  if (needsReflection) {
    try {
      if (targetCompetitors.length > 1) {
        console.log(`[agent] Running Trend Engine competitor comparison: ${targetCompetitors[0]} vs ${targetCompetitors[1]}…`);
        const compRes = await compareCompetitorTrendsTool({
          competitorAName: targetCompetitors[0],
          competitorBName: targetCompetitors[1],
          window: "6m",
        });
        if (compRes.ok) {
          trendData = compRes;
          hindsightReflection = compRes.comparison?.descriptiveAnalysis || "";
        }
      } else if (primaryCompetitor) {
        console.log(`[agent] Running Trend Engine analysis for ${primaryCompetitor}…`);
        const trendRes = await analyzeCompetitorTrendsTool({
          competitorName: primaryCompetitor,
          window: "6m",
        });
        if (trendRes.ok) {
          trendData = trendRes;
          const patternsSummary = (trendRes.patterns || []).map(p =>
            `• [${p.type}] ${p.title}: Observation: ${p.observation} Pattern: ${p.pattern} Interpretation: ${p.interpretation}`
          ).join("\n");

          hindsightReflection = `${trendRes.executiveSummary}\n\nDetected Patterns:\n${patternsSummary}`;
          if (trendRes.hindsightReflection) {
            hindsightReflection += `\n\nHindsight Long-Term Memory Reflection:\n${trendRes.hindsightReflection}`;
          }
        }
      }
    } catch (err) {
      console.warn("[agent] Trend Engine invocation failed, falling back to direct reflect:", err.message);
      if (primaryCompetitor) {
        try {
          const reflectRes = await reflectOnMemories({
            query: `${query} Focus on ${primaryCompetitor}.`,
          });
          if (reflectRes.ok) {
            hindsightReflection = reflectRes.reflection || "";
          }
        } catch (rErr) {
          console.warn("[agent] Fallback reflect failed:", rErr.message);
        }
      }
    }
  }

  // ── Step 5: Check if any competitive intelligence was found ──────
  const hasMemories = recalledMemories.length > 0;
  const hasEvents   = structuredEvents.length > 0;
  const hasTrends   = trendData && (trendData.patterns?.length > 0 || trendData.comparison);

  if (!hasMemories && !hasEvents && !hasTrends) {
    const competitorLabel = targetCompetitors.length > 0 ? targetCompetitors.join(", ") : "the requested competitor";
    return {
      status: "insufficient_data",
      answer: `The available competitive intelligence is insufficient to answer this question about ${competitorLabel}. No relevant historical events or memories are currently stored.`,
      keyFindings: [
        "No matching records found in the long-term memory bank.",
        "No structured events match the specified query criteria.",
      ],
      timeline: [],
      patterns: "Insufficient data to establish historical patterns or strategic trends.",
      uncertainty: "Data is limited to stored competitor records. Additional events should be synced or created.",
      competitors: targetCompetitors,
      evidence: [],
      memoriesUsed: [],
      eventsUsed: [],
      insights: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  // ── Step 6: Reason over Evidence (Gemini or Hindsight Synthesis) ──
  const agentResponse = await synthesizeResponse({
    query,
    targetCompetitors,
    detectedCategory: detectedCat,
    memories: recalledMemories,
    events: structuredEvents,
    reflection: hindsightReflection,
    trendData,
  });

  agentResponse.executionTimeMs = Date.now() - startTime;
  return agentResponse;
}

// ═══════════════════════════════════════════════════════════════════
// SYNTHESIS ENGINE
// ═══════════════════════════════════════════════════════════════════

async function synthesizeResponse({
  query,
  targetCompetitors,
  detectedCategory,
  memories,
  events,
  reflection,
  trendData,
}) {
  const competitorNames = targetCompetitors.length > 0
    ? targetCompetitors.join(" and ")
    : "tracked competitors";

  // Build grounded context for reasoning
  const eventsContext = events.slice(0, 15).map(e =>
    `- [${e.date}] ${e.competitor} | Category: ${e.category} | Title: "${e.title}" | Details: ${e.description || 'None'} | Source: ${e.source || 'Internal'}`
  ).join("\n");

  const memoriesContext = memories.slice(0, 10).map((m, idx) =>
    `- Memory #${idx + 1} (${m.type}): ${m.text} [Date: ${m.timestamp || 'Historical'}]`
  ).join("\n");

  const trendsContext = trendData
    ? (trendData.comparison
        ? `Comparison Analysis: ${trendData.comparison.descriptiveAnalysis}`
        : `Patterns Detected: ${JSON.stringify(trendData.patterns?.map(p => ({
            type: p.type,
            title: p.title,
            observation: p.observation,
            pattern: p.pattern,
            interpretation: p.interpretation,
            confidence: p.confidence,
          })) || [])}`)
    : "None provided.";

  // Check if Gemini API is available for reasoning
  if (isGeminiAvailable()) {
    try {
      console.log("[agent] Reasoning with Google Gemini…");

      const systemPrompt = `You are a Competitive Intelligence Agent analyzing competitor activities for an executive team.
You must adhere strictly to these rules:
1. ONLY make claims supported by the provided competitor events, Hindsight memories, and Hindsight reflections.
2. DISTINGUISH clearly between:
   - OBSERVED: Direct factual statements supported by stored events/memories.
   - INTERPRETATION: Logical patterns inferred from multiple observed events.
   - UNCERTAINTY: Explicit limitations when evidence is incomplete or dates are unavailable.
3. NEVER invent facts, funding amounts, dates, partnerships, or URLs.
4. Structure your response strictly in valid JSON with these exact keys:
{
  "answer": "A concise 2-3 sentence direct answer to the user's question.",
  "keyFindings": ["Finding 1 (with dates)", "Finding 2", "Finding 3"],
  "timeline": [
    {"date": "YYYY-MM-DD", "competitor": "...", "title": "...", "category": "..."}
  ],
  "patterns": "Observed strategic trends across multiple events (if applicable, or null if none).",
  "uncertainty": "Boundaries of what is known vs unknown from available intelligence."
}`;

      const userPrompt = `USER QUESTION: "${query}"
TARGET COMPETITOR(S): ${competitorNames}

GROUNDED COMPETITOR EVENTS (from Supabase):
${eventsContext || "No structured events retrieved."}

LONG-TERM MEMORIES (from Hindsight Recall):
${memoriesContext || "No memories retrieved."}

TREND & PATTERN INTELLIGENCE (Phase 10):
${trendsContext}

HINDSIGHT REFLECTION / PATTERN SYNTHESIS:
${reflection || "None provided."}

Analyze the above evidence and respond ONLY with the specified JSON structure.`;

      const geminiRes = await generateGeminiReasoning({
        systemPrompt,
        userPrompt,
        temperature: 0.15,
      });

      if (geminiRes.ok && geminiRes.text) {
        // Parse Gemini JSON output
        try {
          const cleanJson = geminiRes.text.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleanJson);

          return formatFinalResult({
            query,
            targetCompetitors,
            answer: parsed.answer,
            keyFindings: parsed.keyFindings || [],
            timeline: parsed.timeline || buildTimelineFromEvents(events),
            patterns: parsed.patterns || reflection || null,
            uncertainty: parsed.uncertainty || null,
            memories,
            events,
            engine: `Gemini (${geminiRes.model}) + Hindsight`,
          });
        } catch (parseErr) {
          console.warn("[agent] Failed to parse Gemini JSON output, falling back to direct synthesis:", parseErr.message);
        }
      }
    } catch (geminiErr) {
      console.warn("[agent] Gemini reasoning error:", geminiErr.message);
    }
  }

  // ── Native Hindsight + Rule-based Deterministic Reasoning Fallback ──
  // Used if Gemini is not configured, or if Gemini times out / fails.
  console.log("[agent] Utilizing Hindsight Long-term Memory Synthesis engine…");
  return buildNativeSynthesis({
    query,
    targetCompetitors,
    detectedCategory,
    memories,
    events,
    reflection,
  });
}

/**
 * Builds chronological timeline items from structured events.
 */
function buildTimelineFromEvents(events = []) {
  return events
    .filter(e => e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 8)
    .map(e => ({
      date: e.date,
      competitor: e.competitor,
      title: e.title,
      category: e.category,
      importance: e.importance,
    }));
}

/**
 * Deterministic evidence synthesis engine using Hindsight memory & events.
 */
function buildNativeSynthesis({
  query,
  targetCompetitors,
  detectedCategory,
  memories,
  events,
  reflection,
}) {
  const competitorName = targetCompetitors[0] || (events[0]?.competitor) || "Competitors";
  const timeline = buildTimelineFromEvents(events);

  // Key findings from events & memories
  const keyFindings = [];

  events.slice(0, 4).forEach(e => {
    keyFindings.push(`[${e.date}] ${e.competitor}: ${e.title} (${e.category})`);
  });

  memories.slice(0, 2).forEach(m => {
    if (!keyFindings.some(f => m.text.includes(f))) {
      const snippet = m.text.split(".")[0];
      if (snippet && snippet.length > 20) {
        keyFindings.push(snippet + ".");
      }
    }
  });

  // Direct answer formulation
  let answer = "";
  if (reflection && reflection.length > 50) {
    answer = reflection.split("\n\n")[0].replace(/^#+\s*.*?\n/, "").trim();
  } else if (events.length > 0) {
    const mostRecent = events[0];
    answer = `Based on stored competitive intelligence, ${competitorName} has recorded ${events.length} tracked event(s). Most recently on ${mostRecent.date}, they announced: "${mostRecent.title}" (${mostRecent.category}).`;
  } else if (memories.length > 0) {
    answer = `Based on Hindsight long-term memory, ${memories[0].text}`;
  } else {
    answer = `No definitive activity found matching "${query}".`;
  }

  // Pattern detection
  let patterns = reflection || null;
  if (!patterns && events.length >= 2) {
    const catCounts = {};
    events.forEach(e => {
      catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });
    const topCat = Object.entries(catCounts).sort((a,b) => b[1] - a[1])[0];
    if (topCat && topCat[1] >= 2) {
      patterns = `OBSERVED PATTERN: Heavy activity concentrated in ${topCat[0]} (${topCat[1]} events recorded), signaling a strategic focus in this domain.`;
    }
  }

  const uncertainty = events.length < 3
    ? "Limited historical events are currently recorded. Strategic inferences should be validated against future events."
    : "Intelligence is grounded in stored press releases, product launches, and verified sources.";

  return formatFinalResult({
    query,
    targetCompetitors,
    answer,
    keyFindings,
    timeline,
    patterns,
    uncertainty,
    memories,
    events,
    engine: "Hindsight Memory + Event Synthesis",
  });
}

/**
 * Normalizes and packages the final agent output for the frontend.
 */
function formatFinalResult({
  query,
  targetCompetitors,
  answer,
  keyFindings,
  timeline,
  patterns,
  uncertainty,
  memories,
  events,
  engine,
}) {
  // Build evidence list with explicit source citations
  const evidence = [];

  // Add structured events as evidence
  events.slice(0, 10).forEach(e => {
    evidence.push({
      id: e.id,
      title: e.title,
      date: e.date,
      category: e.category,
      competitor: e.competitor,
      source: e.source || "Supabase Events",
      url: e.url || null,
      importance: e.importance || "Medium",
      sourceType: "event",
    });
  });

  // Add Hindsight memories as evidence
  memories.slice(0, 5).forEach((m, idx) => {
    evidence.push({
      id: m.id || `memory-${idx}`,
      title: m.text.substring(0, 100) + "…",
      text: m.text,
      date: m.timestamp ? new Date(m.timestamp).toISOString().split("T")[0] : null,
      category: m.metadata?.category || "Memory",
      competitor: m.metadata?.competitor || (m.entities?.[0] || "Competitor"),
      source: "Hindsight Long-term Memory Bank",
      url: null,
      importance: "High",
      sourceType: "memory",
      entities: m.entities || [],
      score: m.score,
    });
  });

  const memoriesUsed = memories.slice(0, 6).map(m => ({
    id: m.id,
    text: m.text,
    type: m.type,
    score: m.score,
    timestamp: m.timestamp,
    entities: m.entities,
  }));

  const eventsUsed = events.slice(0, 8).map(e => ({
    id: e.id,
    title: e.title,
    date: e.date,
    category: e.category,
    competitor: e.competitor,
  }));

  return {
    status: "ok",
    query,
    competitors: targetCompetitors,
    answer: answer || "No summary available.",
    keyFindings: keyFindings || [],
    timeline: timeline || [],
    patterns: patterns || null,
    uncertainty: uncertainty || null,
    evidence,
    memoriesUsed,
    eventsUsed,
    engine,
  };
}
