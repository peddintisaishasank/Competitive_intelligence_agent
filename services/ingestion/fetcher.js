/**
 * services/ingestion/fetcher.js
 * ─────────────────────────────────────────────────────────────────
 * Safe external source fetcher & parser for Competitive Intelligence.
 *
 * Responsibilities:
 *  - Validates URLs to prevent SSRF (no localhost / private IPs).
 *  - Enforces request timeouts with AbortController.
 *  - Parses RSS 2.0 and Atom XML feeds.
 *  - Parses standalone public HTML articles / press releases.
 *  - Returns standardized source items for AI structuring.
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";

const DEFAULT_TIMEOUT_MS = 12000;
const USER_AGENT = "CompetitiveIntelligenceBot/1.0 (+https://competitive-intelligence.local)";

/**
 * Validates that a URL is safe to fetch (HTTP/HTTPS, non-internal).
 */
export function validateSourceUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return { ok: false, error: "Source URL is required." };
  }

  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Only HTTP and HTTPS URLs are permitted." };
    }

    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const serverPort = String(process.env.PORT || 3000);
    const isLocalTestHost = (host === "localhost" || host === "127.0.0.1") && (port === serverPort);

    // Prevent SSRF: disallow localhost, 127.0.0.1, 0.0.0.0, 10.*, 192.168.*, 172.16-31.*, 169.254.*
    if (
      !isLocalTestHost &&
      (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("169.254.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      )
    ) {
      return { ok: false, error: "Fetching local or internal IP addresses is prohibited for security." };
    }

    return { ok: true, url: parsed.toString() };
  } catch (err) {
    return { ok: false, error: `Invalid URL: ${err.message}` };
  }
}

/**
 * Strips HTML tags and unescapes common entities.
 */
function cleanText(raw = "") {
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a tag's content from an XML snippet (supporting CDATA).
 */
function extractXmlTag(xmlBlock, tagName) {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "i");
  const cdataMatch = xmlBlock.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const standardRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xmlBlock.match(standardRegex);
  return match ? match[1].trim() : "";
}

/**
 * Parses RSS 2.0 feed string.
 */
function parseRssFeed(xml, sourceUrl) {
  const channelTitle = extractXmlTag(xml, "title") || new URL(sourceUrl).hostname;
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return itemMatches.slice(0, 15).map((block, idx) => {
    const rawTitle = extractXmlTag(block, "title");
    const link = extractXmlTag(block, "link") || extractXmlTag(block, "guid") || sourceUrl;
    const pubDate = extractXmlTag(block, "pubDate");
    const rawDesc = extractXmlTag(block, "description") || extractXmlTag(block, "content:encoded");
    const guid = extractXmlTag(block, "guid") || link || `item-${idx}`;

    return {
      itemId: guid,
      title: cleanText(rawTitle),
      url: link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      rawDateText: pubDate,
      content: cleanText(rawDesc).slice(0, 2500),
      sourceName: cleanText(channelTitle) || new URL(sourceUrl).hostname,
      sourceType: "rss",
    };
  }).filter(item => item.title.length > 0);
}

/**
 * Parses Atom feed string.
 */
function parseAtomFeed(xml, sourceUrl) {
  const feedTitle = extractXmlTag(xml, "title") || new URL(sourceUrl).hostname;
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  return entryMatches.slice(0, 15).map((block, idx) => {
    const rawTitle = extractXmlTag(block, "title");
    const linkHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = linkHrefMatch ? linkHrefMatch[1] : (extractXmlTag(block, "link") || sourceUrl);
    const published = extractXmlTag(block, "published") || extractXmlTag(block, "updated");
    const summary = extractXmlTag(block, "summary") || extractXmlTag(block, "content");
    const id = extractXmlTag(block, "id") || link || `atom-${idx}`;

    return {
      itemId: id,
      title: cleanText(rawTitle),
      url: link,
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      rawDateText: published,
      content: cleanText(summary).slice(0, 2500),
      sourceName: cleanText(feedTitle) || new URL(sourceUrl).hostname,
      sourceType: "atom",
    };
  }).filter(item => item.title.length > 0);
}

/**
 * Parses a standalone HTML web page or press release.
 */
function parseHtmlPage(html, sourceUrl) {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");

  // Title extraction: og:title -> <title> -> <h1>
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const rawTitle = ogTitleMatch ? ogTitleMatch[1] : (titleTagMatch ? titleTagMatch[1] : (h1Match ? h1Match[1] : "Announcement"));
  const title = cleanText(rawTitle).split(" | ")[0].split(" - ")[0];

  // Site name
  const ogSiteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const sourceName = ogSiteMatch ? cleanText(ogSiteMatch[1]) : host;

  // Published date
  const ogTimeMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  const publishedAt = ogTimeMatch ? new Date(ogTimeMatch[1]).toISOString() : new Date().toISOString();

  // Content extraction: <article> -> <main> -> paragraph text
  let bodyContent = "";
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);

  if (articleMatch) {
    bodyContent = articleMatch[0];
  } else if (mainMatch) {
    bodyContent = mainMatch[0];
  } else {
    const pMatches = html.match(/<p[\s\S]*?<\/p>/gi) || [];
    bodyContent = pMatches.slice(0, 10).join(" ");
  }

  const cleanedContent = cleanText(bodyContent).slice(0, 3000);

  return [
    {
      itemId: crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16),
      title: title || `Update from ${sourceName}`,
      url: sourceUrl,
      publishedAt,
      rawDateText: ogTimeMatch ? ogTimeMatch[1] : null,
      content: cleanedContent,
      sourceName,
      sourceType: "webpage",
    },
  ];
}

/**
 * Fetches content from an external public source and extracts structured items.
 *
 * @param {string} sourceUrl
 * @param {object} [options]
 * @param {number} [options.timeoutMs=12000]
 * @returns {Promise<{ ok: boolean, items: Array, sourceName: string, error?: string }>}
 */
export async function fetchSourceItems(sourceUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const valRes = validateSourceUrl(sourceUrl);
  if (!valRes.ok) {
    return { ok: false, items: [], sourceName: "", error: valRes.error };
  }

  const cleanUrl = valRes.url;
  const host = new URL(cleanUrl).hostname;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(cleanUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        sourceName: host,
        error: `HTTP ${res.status}: Failed to fetch source from ${cleanUrl}`,
      };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const rawBody = await res.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return { ok: false, items: [], sourceName: host, error: "Source returned empty content." };
    }

    let items = [];
    const isXml = contentType.includes("xml") || rawBody.trim().startsWith("<?xml") || rawBody.includes("<rss") || rawBody.includes("<feed");

    if (isXml) {
      if (rawBody.includes("<rss") || rawBody.includes("<channel")) {
        items = parseRssFeed(rawBody, cleanUrl);
      } else if (rawBody.includes("<feed")) {
        items = parseAtomFeed(rawBody, cleanUrl);
      } else {
        // Try RSS first then Atom
        items = parseRssFeed(rawBody, cleanUrl);
        if (items.length === 0) items = parseAtomFeed(rawBody, cleanUrl);
      }
    } else {
      items = parseHtmlPage(rawBody, cleanUrl);
    }

    if (items.length === 0) {
      return {
        ok: false,
        items: [],
        sourceName: host,
        error: "No readable articles or feed items could be extracted from this source.",
      };
    }

    return {
      ok: true,
      items,
      sourceName: items[0]?.sourceName || host,
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError" || err.message?.includes("abort");
    const msg = isTimeout
      ? `Request timed out after ${timeoutMs / 1000}s while fetching ${cleanUrl}`
      : `Network error fetching source: ${err.message}`;

    return { ok: false, items: [], sourceName: host, error: msg };
  }
}
