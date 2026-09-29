/**
 * server.js
 * ─────────────────────────────────────────────────────────────────
 * Competitive Intelligence Agent — Backend Server
 * Phase 7: Hindsight Memory Integration (RETAIN + RECALL)
 *
 * Responsibilities:
 *  - Serve the static frontend (index.html, css/, js/)
 *  - Provide a secure server-side API layer
 *  - Keep HINDSIGHT_API_KEY and SUPABASE_SERVICE_ROLE_KEY
 *    in .env — never exposed to the browser
 *
 * API Routes:
 *  GET  /api/health               → Status of backend + services
 *  POST /api/hindsight/retain     → Retain a competitor event in Hindsight
 *  POST /api/hindsight/recall     → Recall memories with a natural-language query
 *  POST /api/hindsight/sync       → Bulk-sync existing Supabase events to Hindsight
 *  POST /api/hindsight/reflect    → STUB — Phase 8
 *
 * ─────────────────────────────────────────────────────────────────
 */

import express              from "express";
import cors                 from "cors";
import path                 from "path";
import { fileURLToPath }    from "url";
import { config as dotenv } from "dotenv";

dotenv();

// ── Import Hindsight service (server-side ONLY) ───────────────────
import {
  ensureMemoryBank,
  retainCompetitorEvent,
  syncExistingEventsToHindsight,
  recallCompetitorMemory,
  reflectCompetitorMemories,
  hindsightStatus,
  testHindsightConnection,
} from "./services/hindsight.js";

// ── Import Competitive Intelligence Agent ─────────────────────────
import { runCompetitiveIntelligenceAgent } from "./services/agent/agent.js";

// ── Import Ingestion Service (Phase 9) ────────────────────────────
import { collectCompetitorIntelligence } from "./services/ingestion/ingestion.js";

// ── Import Trend & Pattern Intelligence Engine (Phase 10) ─────────
import {
  analyzeCompetitorTrends,
  compareCompetitorTrends,
} from "./services/intelligence/trendEngine.js";

// ── ESM __dirname shim ────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── App setup ─────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Serve static frontend ─────────────────────────────────────────
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════

app.get("/api/health", (req, res) => {
  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
  const hs = hindsightStatus();

  res.json({
    status:    "ok",
    backend:   "connected",
    timestamp: new Date().toISOString(),
    services: {
      supabase:  supabaseConfigured ? "configured" : "not_configured",
      hindsight: hs.configured
        ? `configured — bank: ${hs.bankId}`
        : "not_configured — add HINDSIGHT_API_KEY to .env",
    },
    phase: "Phase 7 — Hindsight RETAIN + RECALL active",
  });
});

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT STATUS CHECK
// ═══════════════════════════════════════════════════════════════════

app.get("/api/hindsight/status", async (req, res) => {
  try {
    const status = await testHindsightConnection(6000);
    if (!status.ok) {
      return res.status(status.configured ? 503 : 400).json({
        status:     "error",
        connected:  false,
        configured: status.configured,
        bankId:     status.bankId,
        error:      status.error,
        message:    status.error,
      });
    }
    return res.json({
      status:     "connected",
      connected:  true,
      configured: true,
      bankId:     status.bankId,
    });
  } catch (err) {
    return res.status(500).json({
      status:    "error",
      connected: false,
      error:     err.message,
      message:   err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT — RETAIN
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/hindsight/retain
 *
 * Request body:
 * {
 *   "event": { id, event_date, category, title, description,
 *              source_name, importance, hindsight_retained },
 *   "competitorName": "AgroTech AI"
 * }
 *
 * This endpoint is called automatically after a new competitor event
 * is created in Supabase (via the competitor-detail.js form → backend).
 */
app.post("/api/hindsight/retain", async (req, res) => {
  const { event, competitorName } = req.body ?? {};

  if (!event || !event.id) {
    return res.status(400).json({
      status: "error",
      message: "Request body must include an 'event' object with an 'id' field.",
    });
  }

  if (!competitorName) {
    return res.status(400).json({
      status: "error",
      message: "Request body must include 'competitorName'.",
    });
  }

  const hs = hindsightStatus();
  if (!hs.configured) {
    return res.status(503).json({
      status:  "backend_ready",
      message: "HINDSIGHT_API_KEY is not configured. Add it to .env to enable memory.",
    });
  }

  const result = await retainCompetitorEvent(event, competitorName);

  if (result.skipped) {
    return res.json({
      status:  "skipped",
      message: "Event was already retained in Hindsight (duplicate prevention).",
      eventId: event.id,
    });
  }

  if (!result.ok) {
    return res.status(500).json({
      status:  "error",
      message: `Hindsight retain failed: ${result.error}`,
      eventId: event.id,
    });
  }

  return res.json({
    status:    "retained",
    message:   "Event successfully retained in Hindsight memory.",
    eventId:   event.id,
    memoryRef: result.memoryRef,
  });
});

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT — RECALL
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/hindsight/recall
 *
 * Request body:
 * { "query": "What has AgroTech AI done recently?" }
 *
 * Returns relevant memories from the Hindsight memory bank.
 * Hindsight performs its own multi-strategy retrieval (semantic,
 * keyword, entity graph, temporal). We do NOT implement custom search.
 */
app.post("/api/hindsight/recall", async (req, res) => {
  const { query } = req.body ?? {};

  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return res.status(400).json({
      status: "error",
      message: "Request body must include a 'query' string of at least 3 characters.",
    });
  }

  const hs = hindsightStatus();
  if (!hs.configured) {
    return res.status(503).json({
      status:   "not_configured",
      message:  "HINDSIGHT_API_KEY is not set. Add it to .env to enable memory recall.",
      query,
      results:  [],
    });
  }

  const result = await recallCompetitorMemory(query.trim());

  if (!result.ok) {
    return res.status(500).json({
      status:  "error",
      message: `Hindsight recall failed: ${result.error}`,
      query,
      results: [],
    });
  }

  return res.json({
    status:   "ok",
    query,
    results:  result.results,
    entities: result.entities ?? [],
    count:    result.results.length,
  });
});

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT — SYNC (bulk retain all un-synced events)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/hindsight/sync
 *
 * Finds all Supabase competitor_events where hindsight_retained = false
 * and retains them in Hindsight, then marks them as synced.
 *
 * Call this once after initial deployment, or whenever you want
 * to catch up un-synced events.
 */
app.post("/api/hindsight/sync", async (req, res) => {
  const hs = hindsightStatus();
  if (!hs.configured) {
    return res.status(503).json({
      status:  "not_configured",
      message: "HINDSIGHT_API_KEY is not set. Add it to .env to enable sync.",
    });
  }

  const supabaseReady = Boolean(
    process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
  if (!supabaseReady) {
    return res.status(503).json({
      status:  "error",
      message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set for sync.",
    });
  }

  try {
    const summary = await syncExistingEventsToHindsight();
    return res.json({
      status: "ok",
      ...summary,
    });
  } catch (err) {
    console.error("[sync] Unexpected error:", err.message);
    return res.status(500).json({
      status:  "error",
      message: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// COMPETITIVE INTELLIGENCE AGENT API (Phase 8)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/agent/competitive-intelligence
 *
 * Request body:
 * {
 *   "message": "What has AgroTech AI been doing over the past six months?",
 *   "competitorId": "...",          // optional
 *   "timeRange": { "start": "..." }, // optional
 *   "conversationHistory": [...]     // optional session messages
 * }
 */
app.post("/api/agent/competitive-intelligence", async (req, res) => {
  try {
    const { message, competitorId, timeRange, conversationHistory } = req.body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        status:   "error",
        message:  "Request body must include a 'message' string.",
        answer:   "Please ask a valid question about your competitors.",
        evidence: [],
      });
    }

    const response = await runCompetitiveIntelligenceAgent({
      message,
      competitorId,
      timeRange,
      conversationHistory,
    });

    return res.json(response);
  } catch (err) {
    console.error("[agent/api] Error:", err.message);
    return res.status(500).json({
      status:       "error",
      message:      `Agent failed to process request: ${err.message}`,
      answer:       "The Competitive Intelligence Agent encountered an error while processing your request. Please try again.",
      evidence:     [],
      memoriesUsed: [],
      eventsUsed:   [],
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HINDSIGHT — REFLECT (Phase 8 Real Implementation)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/hindsight/reflect", async (req, res) => {
  const { query, context } = req.body ?? {};

  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return res.status(400).json({
      status:  "error",
      message: "Request body must include a 'query' string of at least 3 characters.",
    });
  }

  const hs = hindsightStatus();
  if (!hs.configured) {
    return res.status(503).json({
      status:   "not_configured",
      message:  "HINDSIGHT_API_KEY is not set. Add it to .env to enable reflection.",
      insight:  null,
    });
  }

  const result = await reflectCompetitorMemories(query.trim(), { context });
  if (!result.ok) {
    return res.status(500).json({
      status:  "error",
      message: `Hindsight reflect failed: ${result.error}`,
      insight: null,
    });
  }

  return res.json({
    status:  "ok",
    query,
    insight: result.text,
    basedOn: result.basedOn,
  });
});

// ═══════════════════════════════════════════════════════════════════
// INTELLIGENCE INGESTION — PHASE 9
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/intelligence/collect
 * Collects external competitive intelligence from public RSS or URLs,
 * structures it using Gemini, stores verified events in Supabase,
 * and retains them in the Hindsight memory bank.
 *
 * Request body:
 * {
 *   "competitorId": "...",
 *   "sourceUrl": "..." // optional override
 * }
 */
app.post("/api/intelligence/collect", async (req, res) => {
  try {
    const { competitorId, sourceUrl, maxItems } = req.body ?? {};

    if (!competitorId) {
      return res.status(400).json({
        status:  "error",
        message: "Request body must include 'competitorId'.",
      });
    }

    const result = await collectCompetitorIntelligence({
      competitorId,
      sourceUrl,
      maxItems: Number(maxItems) || 8,
    });

    if (!result.ok) {
      return res.status(400).json({
        status:     "error",
        message:    result.error,
        competitor: result.competitor,
        source:     result.sourceUrl,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("[intelligence/collect] Ingestion error:", err.message);
    return res.status(500).json({
      status:  "error",
      message: `Failed to collect intelligence: ${err.message}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// TREND & PATTERN INTELLIGENCE ENGINE — PHASE 10
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/intelligence/trends
 * Analyzes competitor historical trends, category shifts, and sequential patterns.
 *
 * Request body:
 * {
 *   "competitorId": "...",
 *   "competitorName": "...",
 *   "window": "30d" | "90d" | "6m" | "12m" | "custom",
 *   "customStart": "YYYY-MM-DD",
 *   "customEnd": "YYYY-MM-DD"
 * }
 */
app.post("/api/intelligence/trends", async (req, res) => {
  try {
    const { competitorId, competitorName, window, customStart, customEnd } = req.body ?? {};

    if (!competitorId && !competitorName) {
      return res.status(400).json({
        status: "error",
        message: "Request body must include either 'competitorId' or 'competitorName'.",
      });
    }

    const result = await analyzeCompetitorTrends({
      competitorId,
      competitorName,
      window: window || "6m",
      customStart,
      customEnd,
    });

    return res.json(result);
  } catch (err) {
    console.error("[intelligence/trends] Trend analysis error:", err.message);
    return res.status(500).json({
      status: "error",
      message: `Failed to analyze trends: ${err.message}`,
    });
  }
});

/**
 * POST /api/intelligence/compare-trends
 * Compares two competitors over the same time window.
 * Strictly descriptive and evidence-based (NO ranking, NO claims of who is 'better').
 *
 * Request body:
 * {
 *   "competitorAId": "...",
 *   "competitorAName": "...",
 *   "competitorBId": "...",
 *   "competitorBName": "...",
 *   "window": "6m"
 * }
 */
app.post("/api/intelligence/compare-trends", async (req, res) => {
  try {
    const {
      competitorAId,
      competitorAName,
      competitorBId,
      competitorBName,
      window,
      customStart,
      customEnd,
    } = req.body ?? {};

    if ((!competitorAId && !competitorAName) || (!competitorBId && !competitorBName)) {
      return res.status(400).json({
        status: "error",
        message: "Must specify both competitor A and competitor B identifiers.",
      });
    }

    const result = await compareCompetitorTrends({
      competitorAId,
      competitorAName,
      competitorBId,
      competitorBName,
      window: window || "6m",
      customStart,
      customEnd,
    });

    return res.json(result);
  } catch (err) {
    console.error("[intelligence/compare-trends] Comparison error:", err.message);
    return res.status(500).json({
      status: "error",
      message: `Failed to compare trends: ${err.message}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// CATCH-ALL
// ═══════════════════════════════════════════════════════════════════

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ status: "error", message: "API route not found." });
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

// ═══════════════════════════════════════════════════════════════════
// START SERVER + INIT HINDSIGHT BANK
// ═══════════════════════════════════════════════════════════════════

app.listen(PORT, async () => {
  console.log(`\n🚀  CI Agent backend running at http://localhost:${PORT}`);
  console.log(`   Frontend:      http://localhost:${PORT}/`);
  console.log(`   Health check:  http://localhost:${PORT}/api/health`);

  const hs = hindsightStatus();
  if (hs.configured) {
    console.log(`   Hindsight:     ✅ API key configured — bank: "${hs.bankId}"`);
    // Ensure the memory bank exists (non-blocking — runs in background)
    ensureMemoryBank()
      .then(r => {
        if (r.ok) console.log(`   Memory bank:   ✅ "${r.bankId}" ready`);
        else      console.warn(`   Memory bank:   ⚠️  ${r.error}`);
      })
      .catch(e => console.warn(`   Memory bank:   ⚠️  ${e.message}`));
  } else {
    console.log(`   Hindsight:     ⚠️  HINDSIGHT_API_KEY not set — add it to .env`);
  }
  console.log();
});
