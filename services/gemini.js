/**
 * services/gemini.js
 * ─────────────────────────────────────────────────────────────────
 * Server-side Google Gemini reasoning integration.
 *
 * Responsibilities:
 *  - Calls Google Gemini API securely from the backend.
 *  - Enforces temperature and reasoning constraints.
 *  - Keeps GEMINI_API_KEY strictly on the server (never to browser).
 *  - Handles timeouts, errors, and availability checks gracefully.
 * ─────────────────────────────────────────────────────────────────
 */

const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
];

/**
 * Returns whether GEMINI_API_KEY is defined in the environment.
 */
export function isGeminiAvailable() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 10);
}

/**
 * Executes a reasoning request with Google Gemini.
 *
 * @param {object} params
 * @param {string} params.systemPrompt - High-level system instructions
 * @param {string} params.userPrompt   - The prompt containing question and evidence
 * @param {number} [params.timeoutMs=25000] - Request timeout
 * @param {number} [params.temperature=0.2] - Low temperature for strict factual accuracy
 * @returns {Promise<{ ok: boolean, text: string, model?: string, error?: string }>}
 */
export async function generateGeminiReasoning({
  systemPrompt,
  userPrompt,
  timeoutMs = 25000,
  temperature = 0.2,
} = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length < 10) {
    return {
      ok: false,
      text: "",
      error: "GEMINI_API_KEY is not configured in .env",
    };
  }

  // Try the primary model, fall back to secondary if needed
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        console.warn(`[gemini] Model ${model} returned error:`, errMsg);
        lastError = errMsg;
        continue; // Try next model
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || "";

      if (text.trim().length > 0) {
        return {
          ok: true,
          text: text.trim(),
          model,
        };
      }
    } catch (err) {
      const isTimeout = err.name === "AbortError" || err.message?.includes("abort");
      const msg = isTimeout ? `Request timed out after ${timeoutMs / 1000}s` : err.message;
      console.warn(`[gemini] Model ${model} failed:`, msg);
      lastError = msg;
    }
  }

  return {
    ok: false,
    text: "",
    error: lastError || "All Gemini models failed to respond.",
  };
}
