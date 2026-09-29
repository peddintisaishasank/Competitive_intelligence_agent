/**
 * apiClient.js
 * ─────────────────────────────────────────────────────────────────
 * Thin HTTP client for the CI Agent backend API.
 *
 * All calls go to the Express backend running at localhost:3000.
 * The backend holds all secret API keys (Hindsight, service-role).
 * The browser never sees them.
 *
 * Usage:
 *   import { apiClient } from "./apiClient.js";
 *   const health = await apiClient.health();
 *   const result = await apiClient.recall("What did AgroTech AI launch?");
 *
 * ─────────────────────────────────────────────────────────────────
 */

// ── Detect backend base URL ───────────────────────────────────────
// When served via the Express backend (npm start), the frontend is
// at the same origin, so /api/* works directly.
// When opened as a raw file (file:// or Live Server on port 5500),
// we point explicitly at the backend port.
function detectBaseURL() {
  const origin = window.location.origin;
  // Running from the Express server itself
  if (origin.includes(":3000") || origin.startsWith("http://localhost:3000")) {
    return "";           // Same-origin — relative paths work
  }
  // Running from Live Server or opened as a file
  return "http://localhost:3000";
}

const BASE_URL = detectBaseURL();

// ── Core fetch helper with timeout ────────────────────────────────
async function apiFetch(method, path, body = null, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
  };
  if (body !== null) opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${BASE_URL}${path}`, opts);
    clearTimeout(timer);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: json, error: json.message || json.error || `HTTP ${res.status}` };
    }
    return { data: json, error: null };
  } catch (err) {
    clearTimeout(timer);
    const msg = err.name === "AbortError"
      ? `Request timed out after ${timeoutMs / 1000}s`
      : (err.message || "Network request failed");
    console.error(`[apiClient] ${method} ${path} failed:`, msg);
    return { data: null, error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════
export const apiClient = {

  /**
   * GET /api/health
   * Returns backend status and service configuration.
   */
  health: () => apiFetch("GET", "/api/health"),

  /**
   * GET /api/hindsight/status
   * Actively verifies Hindsight connectivity and memory bank reachability.
   */
  status: () => apiFetch("GET", "/api/hindsight/status"),

  /**
   * POST /api/hindsight/retain
   * Stores a competitor event in Hindsight memory.
   * @param {{ event: object, competitorName: string }} payload
   */
  retain: (payload) => apiFetch("POST", "/api/hindsight/retain", payload),

  /**
   * POST /api/hindsight/recall
   * Retrieves relevant memories from Hindsight using a query.
   * @param {string} query  Natural-language question about competitor history
   */
  recall: (query) => apiFetch("POST", "/api/hindsight/recall", { query }),

  /**
   * POST /api/hindsight/reflect
   * Generates an AI-powered strategic insight from Hindsight memories.
   * @param {string} query
   */
  reflect: (query) => apiFetch("POST", "/api/hindsight/reflect", { query }),

  /**
   * POST /api/hindsight/sync
   * Syncs existing Supabase events to Hindsight (one-time bulk import).
   */
  sync: () => apiFetch("POST", "/api/hindsight/sync", {}),

  /**
   * POST /api/agent/competitive-intelligence
   * Competitive Intelligence Agent reasoning over Hindsight memory, Supabase events, and reflections.
   * @param {{ message: string, competitorId?: string, timeRange?: object, conversationHistory?: Array }} payload
   */
  askAgent: (payload) => apiFetch("POST", "/api/agent/competitive-intelligence", payload, 25000),

  /**
   * POST /api/intelligence/collect
   * Collects external public intelligence, extracts events with Gemini, and retains in Hindsight.
   * @param {{ competitorId: string, sourceUrl?: string, maxItems?: number }} payload
   */
  collectIntelligence: (payload) => apiFetch("POST", "/api/intelligence/collect", payload, 35000),

  /**
   * POST /api/intelligence/trends (Phase 10)
   * Analyzes competitor historical trends, category shifts, and sequential patterns.
   * @param {{ competitorId?: string, competitorName?: string, window?: string, customStart?: string, customEnd?: string }} payload
   */
  trends: (payload) => apiFetch("POST", "/api/intelligence/trends", payload, 25000),

  /**
   * POST /api/intelligence/compare-trends (Phase 10)
   * Compares two competitors over the same time window.
   * @param {{ competitorAId?: string, competitorAName?: string, competitorBId?: string, competitorBName?: string, window?: string }} payload
   */
  compareTrends: (payload) => apiFetch("POST", "/api/intelligence/compare-trends", payload, 30000),
};

// ── Expose for console testing ────────────────────────────────────
// Open DevTools and run:  window.__ciAPI.health()
window.__ciAPI = apiClient;
