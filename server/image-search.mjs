import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

export async function loadSerpApiKey() {
  if (!process.env.SERPAPI_API_KEY) {
    try {
      const raw = await fs.readFile(envPath, "utf8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim();
        }
      }
    } catch {
      // no .env file; rely on already-exported env vars
    }
  }
  return process.env.SERPAPI_API_KEY || "";
}

function extractInstagramHandle(instagramUrl) {
  if (!instagramUrl) return "";
  try {
    const { pathname } = new URL(instagramUrl);
    const [handle] = pathname.split("/").filter(Boolean);
    return handle || "";
  } catch {
    return "";
  }
}

export function buildSalonImageSearchQuery(salon) {
  // A generic "name + location" query can just as easily match a
  // similarly-named salon elsewhere — when we already have a confirmed
  // Instagram handle for this exact salon, search that account directly
  // instead of hoping a keyword match lands on the right business.
  const handle = extractInstagramHandle(salon.instagramUrl);
  if (handle) {
    return `site:instagram.com/${handle}`;
  }
  const location = salon.googleFormattedAddress
    || [salon.neighbourhood, salon.postcode, "London"].filter(Boolean).join(", ");
  return `${salon.name} hair salon ${location}`.trim();
}

// Salons mostly post their actual work to social platforms, not their
// (often photo-free) own website — bias results toward those sources rather
// than treating every hit as equally likely to be relevant.
const PRIORITY_HOSTS = ["instagram.com", "facebook.com", "tiktok.com"];

function sourcePriority(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const index = PRIORITY_HOSTS.findIndex((host) => hostname === host || hostname.endsWith(`.${host}`));
    return index === -1 ? PRIORITY_HOSTS.length : index;
  } catch {
    return PRIORITY_HOSTS.length;
  }
}

export async function searchSalonImages(salon, { num = 20 } = {}) {
  const apiKey = await loadSerpApiKey();
  if (!apiKey) {
    throw new Error("SerpAPI is not configured (SERPAPI_API_KEY).");
  }

  const query = buildSalonImageSearchQuery(salon);
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(Math.min(Math.max(num, 1), 20)));

  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error("SerpAPI rate limit exceeded.");
  }
  if (!response.ok) {
    throw new Error(`SerpAPI error: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error);
  }

  const items = Array.isArray(payload.images_results) ? payload.images_results : [];
  const results = items.slice(0, num).map((item) => ({
    imageUrl: item.original,
    thumbnailUrl: item.thumbnail || item.original,
    contextUrl: item.link,
    width: item.original_width,
    height: item.original_height,
    title: item.title,
  }));

  return results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => sourcePriority(a.result.contextUrl) - sourcePriority(b.result.contextUrl) || a.index - b.index)
    .map(({ result }) => result);
}
