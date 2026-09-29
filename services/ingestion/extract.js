/**
 * services/ingestion/extract.js
 * ─────────────────────────────────────────────────────────────────
 * AI & Heuristic Event Structuring Engine.
 *
 * Responsibilities:
 *  - Uses Google Gemini API (via services/gemini.js) to extract
 *    structured competitor events from raw source articles/items.
 *  - Distinguishes relevant competitive activity from generic noise.
 *  - Constrains output to allowed categories & importance levels.
 *  - Preserves exact source publication dates (NEVER invents dates).
 *  - Provides a fallback structuring engine when GEMINI_API_KEY is not set.
 * ─────────────────────────────────────────────────────────────────
 */

import { isGeminiAvailable, generateGeminiReasoning } from "../gemini.js";

export const ALLOWED_CATEGORIES = [
  "Product",
  "Pricing",
  "Marketing",
  "Partnership",
  "Hiring",
  "Funding",
  "Expansion",
  "Other",
];

export const ALLOWED_IMPORTANCE = ["Low", "Medium", "High"];

/**
 * Extracts structured competitor event data using Google Gemini.
 */
async function extractWithGemini(item, competitor) {
  const systemPrompt = `You are a Competitive Intelligence Extraction Agent.
Your job is to read an external source item and determine whether it contains verified, meaningful competitive intelligence about the target competitor.

Target Competitor: "${competitor.name}"
Competitor Industry: "${competitor.industry || 'Technology'}"

RULES:
1. Check if this item is actually about or directly impacts "${competitor.name}".
   - If the competitor's official blog or domain is the source, it IS about the competitor.
   - If it is about an unrelated company or generic industry chatter with no mention of "${competitor.name}", set "isRelevant": false.
2. If relevant, classify into EXACTLY ONE allowed category:
   ${ALLOWED_CATEGORIES.join(", ")}
3. Importance must be EXACTLY ONE of:
   ${ALLOWED_IMPORTANCE.join(", ")}
4. NEVER invent dates. Use the published date "${item.publishedAt ? item.publishedAt.split('T')[0] : ''}" if the text does not mention a specific event date.
5. Title must be concise (under 80 chars), factual, and describe the action.
6. Description must summarize what happened in 1-3 sentences.
7. Evidence must be an exact quote or direct statement from the text.
8. Output JSON ONLY with this schema:
{
  "isRelevant": true,
  "category": "Product",
  "title": "Title of event",
  "description": "Factual description of what occurred.",
  "eventDate": "YYYY-MM-DD",
  "importance": "High",
  "evidence": "Direct quote from source."
}
If NOT relevant or not about "${competitor.name}":
{
  "isRelevant": false,
  "reason": "Explain briefly why this item is not relevant."
}`;

  const userPrompt = `SOURCE ITEM TO ANALYZE:
Source Name: ${item.sourceName || "Public Web"}
Source URL: ${item.url}
Published Date: ${item.publishedAt || "Unknown"}
Article Title: ${item.title}
Article Content:
${item.content || item.title}`;

  const res = await generateGeminiReasoning({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    timeoutMs: 15000,
  });

  if (!res.ok || !res.text) {
    throw new Error(res.error || "Gemini did not return extraction text.");
  }

  const cleanJson = res.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleanJson);
  return { ...parsed, extractionEngine: `Gemini (${res.model || "gemini"})` };
}

/**
 * Deterministic fallback structuring engine when GEMINI_API_KEY is not configured.
 */
function extractWithHeuristics(item, competitor) {
  const text = `${item.title} ${item.content}`.toLowerCase();
  const compNameLower = competitor.name.toLowerCase();

  // Check relevance: must either directly mention the competitor or be hosted on competitor's specific domain
  const GENERIC_HOSTS = ["example.com", "localhost", "medium.com", "substack.com", "wordpress.com", "bbc.co.uk", "techcrunch.com", "github.com"];
  const firstName = competitor.name.split(" ")[0].toLowerCase();
  const isDirectMention = text.includes(compNameLower) || (firstName.length >= 4 && text.includes(firstName));

  let isFromCompetitorDomain = false;
  if (competitor.website) {
    try {
      const compHost = new URL(competitor.website).hostname.replace(/^www\./, "");
      const itemHost = new URL(item.url).hostname.replace(/^www\./, "");
      if (!GENERIC_HOSTS.includes(compHost) && (itemHost === compHost || itemHost.endsWith("." + compHost))) {
        isFromCompetitorDomain = true;
      }
    } catch {
      // ignore
    }
  }

  // If not mentioned and not from competitor-specific domain, mark irrelevant
  if (!isDirectMention && !isFromCompetitorDomain) {
    return {
      isRelevant: false,
      reason: `Source item does not mention competitor "${competitor.name}".`,
      extractionEngine: "Heuristic (Fallback)",
    };
  }

  // Category determination
  let category = "Other";
  let importance = "Medium";

  if (/\b(launch|launched|release|released|feature|model|agent|tool|beta|v[0-9]|preview|product|platform)\b/i.test(text)) {
    category = "Product";
    importance = /\b(major|flagship|autonomous|breakthrough|ai|security|core)\b/i.test(text) ? "High" : "Medium";
  } else if (/\b(price|pricing|tier|cost|plan|subscription|discount|free tier|enterprise plan)\b/i.test(text)) {
    category = "Pricing";
    importance = "High";
  } else if (/\b(partner|partnered|partnership|collaborat|alliance|integrat|joined forces)\b/i.test(text)) {
    category = "Partnership";
    importance = "Medium";
  } else if (/\b(hire|hired|appoint|appointed|ceo|cto|vp|executive|headcount|talent)\b/i.test(text)) {
    category = "Hiring";
    importance = /\b(ceo|cto|founder|vp)\b/i.test(text) ? "High" : "Low";
  } else if (/\b(fund|funding|raised|seed|series [a-z]|valuation|investment|capital)\b/i.test(text)) {
    category = "Funding";
    importance = "High";
  } else if (/\b(expand|expansion|new office|entered|region|global|market)\b/i.test(text)) {
    category = "Expansion";
    importance = "Medium";
  } else if (/\b(campaign|brand|rebrand|sponsorship|conference|summit)\b/i.test(text)) {
    category = "Marketing";
    importance = "Low";
  }

  // Event Date: parse published date
  let eventDate = new Date().toISOString().split("T")[0];
  if (item.publishedAt) {
    try {
      eventDate = new Date(item.publishedAt).toISOString().split("T")[0];
    } catch {
      // keep fallback
    }
  }

  // Clean title
  let title = item.title.trim();
  if (title.length > 90) {
    title = title.slice(0, 87) + "…";
  }

  // Description
  const desc = item.content && item.content.length > 20
    ? item.content.slice(0, 300)
    : `${competitor.name} announced: "${title}".`;

  return {
    isRelevant: true,
    category,
    title,
    description: desc,
    eventDate,
    importance,
    evidence: item.content ? item.content.slice(0, 160) : title,
    extractionEngine: "Heuristic (Fallback)",
  };
}

/**
 * Extracts a candidate competitor event from a source item.
 *
 * @param {object} item        - Standardized source item from fetcher.js
 * @param {object} competitor  - Competitor record { id, name, website, industry }
 * @returns {Promise<object>}  - Candidate event structure with isRelevant flag
 */
export async function extractCompetitorEvent(item, competitor) {
  if (isGeminiAvailable()) {
    try {
      console.log(`[ingestion/extract] Structuring item "${item.title.slice(0, 50)}…" with Google Gemini…`);
      const extracted = await extractWithGemini(item, competitor);
      return extracted;
    } catch (err) {
      console.warn(`[ingestion/extract] Gemini extraction error (${err.message}). Falling back to heuristics…`);
      return extractWithHeuristics(item, competitor);
    }
  }

  console.log(`[ingestion/extract] GEMINI_API_KEY not configured. Using heuristic structuring engine…`);
  return extractWithHeuristics(item, competitor);
}
