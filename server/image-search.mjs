import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

export async function loadAnyApiKey() {
  if (!process.env.ANYAPI_KEY) {
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
  return process.env.ANYAPI_KEY || "";
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

// Circuit breaker against any future pagination/loop bug burning through
// the wallet unattended — resets on process restart, not meant as precise
// accounting, just a hard ceiling so a bug can cost at most a few dollars
// before every further search starts failing loudly instead of paying on.
const MAX_ANYAPI_REQUESTS_PER_PROCESS = 2000;
let anyApiRequestCount = 0;

async function anyApiPost(path, body, apiKey) {
  if (anyApiRequestCount >= MAX_ANYAPI_REQUESTS_PER_PROCESS) {
    throw new Error(`AnyAPI request budget (${MAX_ANYAPI_REQUESTS_PER_PROCESS}) exhausted for this server run — restart to reset.`);
  }
  anyApiRequestCount += 1;

  const response = await fetch(`https://api.getanyapi.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status === 402) {
    throw new Error("AnyAPI account is out of funds.");
  }
  if (response.status === 429) {
    throw new Error("AnyAPI rate limit exceeded.");
  }
  if (!response.ok) {
    throw new Error(`AnyAPI error: HTTP ${response.status}`);
  }
  return response.json();
}

function toResult(post, media) {
  return {
    imageUrl: media.url,
    thumbnailUrl: media.url,
    contextUrl: post.url,
    width: media.width,
    height: media.height,
    title: post.caption ? post.caption.slice(0, 200) : post.username,
    // A video/Reel's `media.url` is its static cover-frame image (not the
    // video file — that's the separate `videoUrl`), so it's just as usable
    // a portfolio photo as a real photo post. Tagged so callers can source
    // it differently and so a low-quality batch can be found again later.
    isReel: media.type === "video",
  };
}

// A search API can't be pointed at a specific business's account — it can
// only guess from a name/location query, which risks matching a
// similarly-named salon elsewhere. Fetching the salon's own confirmed
// Instagram account directly guarantees every photo is actually theirs.
export async function searchSalonImages(salon, { num = 24, includeReels = false } = {}) {
  const apiKey = await loadAnyApiKey();
  if (!apiKey) {
    throw new Error("AnyAPI is not configured (ANYAPI_KEY).");
  }

  const handle = extractInstagramHandle(salon.instagramUrl);
  if (!handle) {
    throw new Error("Salon has no Instagram URL to search.");
  }

  // A video/Reels-heavy account can have many pages with zero usable photos
  // (all filtered out below) — without a page cap, chasing `num` photos on
  // an account that mostly doesn't have any would paginate through its
  // entire post history, one paid request per page.
  const MAX_PAGES = 6;

  const results = [];
  let cursor;
  let page = 0;
  while (results.length < num && page < MAX_PAGES) {
    const payload = await anyApiPost("/v1/run/instagram.user_posts", { handle, cursor }, apiKey);
    const data = payload.output?.data ?? payload;
    const posts = Array.isArray(data) ? data : data.posts || [];
    page += 1;
    if (posts.length === 0) break;

    const resultsBeforePage = results.length;
    for (const post of posts) {
      for (const media of post.media ?? []) {
        if (media.type === "video" && !includeReels) continue;
        results.push(toResult(post, media));
        if (results.length >= num) break;
      }
      if (results.length >= num) break;
    }
    // A page with zero usable photos (all video/Reels) means the rest of
    // this account is likely the same — stop instead of paying for more
    // pages chasing a target that isn't there.
    if (results.length === resultsBeforePage) break;

    cursor = data.nextCursor;
    if (!cursor) break;
  }

  return results.slice(0, num);
}
