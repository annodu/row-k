import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeOutboundHttpUrl } from "./security.mjs";

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

// 502/503/504 are the gateway/upstream-overload statuses — seen live as a
// one-off blip on an otherwise-working account (a multi-page search makes
// several of these back to back, so the odds of hitting one climb with page
// count). Worth one retry before surfacing it as a real failure; 402/429
// aren't retried since those are "stop asking" signals, not blips.
const TRANSIENT_ANYAPI_STATUSES = new Set([502, 503, 504]);
const ANYAPI_RETRY_DELAY_MS = 800;

async function anyApiPost(path, body, apiKey, attempt = 1) {
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
  if (TRANSIENT_ANYAPI_STATUSES.has(response.status) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, ANYAPI_RETRY_DELAY_MS));
    return anyApiPost(path, body, apiKey, attempt + 1);
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
// Returns { results, nextCursor } rather than just an array — `nextCursor`
// is what "request more posts" (a fresh call with `cursor: nextCursor`)
// resumes from, so a second request doesn't re-walk pages already seen.
// `nextCursor: null` means the account's post history is actually
// exhausted, not just that this call stopped early to save cost.
export async function searchSalonImages(salon, { num = 40, includeReels = false, cursor: startCursor } = {}) {
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
  // entire post history, one paid request per page. Raised alongside `num`
  // (was 6/24) — the one-per-post dedup means reaching a higher `num` now
  // needs more pages than it used to, not just a higher ceiling on its own.
  const MAX_PAGES = 10;

  const results = [];
  // AnyAPI's cursor pagination has been observed (confirmed live) returning
  // the *same* page of posts again instead of advancing — each post keeps
  // its id but gets a freshly-signed CDN url, so without this it looks like
  // legitimate new results and the same photo gets approved-grid-worthy
  // duplicated once per page, all the way out to MAX_PAGES.
  const seenPostIds = new Set();
  let cursor = startCursor;
  let page = 0;
  let exhausted = false;
  // A single empty page used to stop the whole search — but a real account
  // (confirmed live) can post several Reels in a row and still have photos
  // a page or two later, so one quiet page isn't proof the rest is the
  // same. Two *consecutive* empty pages is: MAX_PAGES already bounds the
  // worst case (a fully-video account) at 6 requests either way, and
  // "request more posts" is the deliberate override for an admin who wants
  // to push past this heuristic on a specific account.
  let consecutiveEmptyPages = 0;
  while (results.length < num && page < MAX_PAGES) {
    let payload;
    try {
      payload = await anyApiPost("/v1/run/instagram.user_posts", { handle, cursor }, apiKey);
    } catch (error) {
      // The first page failing means there's nothing to salvage — surface
      // it. A later page failing (already-retried once in anyApiPost, so
      // this is a second miss) means earlier pages already found real
      // photos; returning those beats losing them all to one bad page.
      if (page === 0) throw error;
      break;
    }
    const data = payload.output?.data ?? payload;
    const posts = Array.isArray(data) ? data : data.posts || [];
    page += 1;
    if (posts.length === 0) {
      exhausted = true;
      break;
    }
    if (posts.every((post) => seenPostIds.has(post.id))) {
      // The cursor came back with nothing but posts already processed —
      // that's the stuck-pagination case above, not a real next page.
      // Nothing further to find by continuing to spend pages on it.
      exhausted = true;
      break;
    }

    const resultsBeforePage = results.length;
    for (const post of posts) {
      if (seenPostIds.has(post.id)) continue;
      seenPostIds.add(post.id);
      // Only the first usable slide of each post, not every slide in a
      // carousel — a single 10-photo carousel post used to fill most of the
      // grid with one outfit/session, crowding out the rest of the account.
      // One result per post keeps the grid spread across many different
      // posts instead.
      const media = (post.media ?? []).find((item) => includeReels || item.type !== "video");
      if (!media) continue;
      results.push(toResult(post, media));
      if (results.length >= num) break;
    }
    if (results.length === resultsBeforePage) {
      consecutiveEmptyPages += 1;
      if (consecutiveEmptyPages >= 2) break;
    } else {
      consecutiveEmptyPages = 0;
    }

    cursor = data.nextCursor;
    if (!cursor) {
      exhausted = true;
      break;
    }
  }

  return { results: results.slice(0, num), nextCursor: exhausted ? null : cursor };
}

// For stylists with no booking link at all (DM/WhatsApp/call to book) — the
// only remaining signal for what they actually do is their own post
// captions/hashtags. Kept deliberately small (num defaults low, one page
// cap) since this is a paid AnyAPI call with no free path, unlike the
// profile fetch this pipeline tries first everywhere else.
export async function fetchInstagramRecentCaptions(instagramUrl, { num = 15 } = {}) {
  const apiKey = await loadAnyApiKey();
  if (!apiKey) {
    throw new Error("AnyAPI is not configured (ANYAPI_KEY).");
  }

  const handle = extractInstagramHandle(instagramUrl);
  if (!handle) {
    throw new Error("No Instagram handle to fetch posts for.");
  }

  const MAX_PAGES = 2;
  const results = [];
  const seenPostIds = new Set();
  let cursor;
  let page = 0;
  while (results.length < num && page < MAX_PAGES) {
    let payload;
    try {
      payload = await anyApiPost("/v1/run/instagram.user_posts", { handle, cursor }, apiKey);
    } catch (error) {
      if (page === 0) throw error;
      break;
    }
    const data = payload.output?.data ?? payload;
    const posts = Array.isArray(data) ? data : data.posts || [];
    page += 1;
    if (posts.length === 0) break;

    for (const post of posts) {
      if (seenPostIds.has(post.id)) continue;
      seenPostIds.add(post.id);
      const caption = String(post.caption || "").trim();
      if (!caption) continue;
      results.push({ caption, url: post.url || "" });
      if (results.length >= num) break;
    }

    cursor = data.nextCursor;
    if (!cursor) break;
  }

  return results;
}

// A profile page's og:image is its avatar (confirmed live), same trick as
// the post fallback above — used both as the primary path when AnyAPI isn't
// configured at all, and as a fallback if instagram.profile fails or comes
// back without an avatarUrl.
export async function fetchInstagramProfilePicture(instagramUrl) {
  const handle = extractInstagramHandle(instagramUrl);
  if (!handle) {
    throw new Error("No Instagram handle to fetch a profile picture for.");
  }

  const apiKey = await loadAnyApiKey();
  if (apiKey) {
    try {
      const payload = await anyApiPost("/v1/run/instagram.profile", { handle }, apiKey);
      const output = payload.output ?? payload;
      const avatarUrl = output.data?.avatarUrl;
      if (output.found && avatarUrl) {
        return { imageUrl: avatarUrl, thumbnailUrl: avatarUrl, contextUrl: instagramUrl, isReel: false };
      }
    } catch {
      // Fall through to the free public-page fallback below rather than
      // failing outright — a rate limit or a transient AnyAPI error
      // shouldn't block the free path from still working.
    }
  }

  return fetchOgImage(instagramUrl);
}

// Paid fallback for the stylist-intake pipeline's free direct profile fetch
// (Instagram's own unofficial web_profile_info endpoint) — used only when
// that fails for a reason that isn't "this account doesn't exist". Confirmed
// live: AnyAPI's instagram.profile reaches accounts that direct fetch can't,
// e.g. ones tripping a live Instagram-side schema bug on certain business
// accounts (seen as a 400 "ig_business_category_subvertical" error).
export async function fetchInstagramProfileViaAnyApi(handle) {
  if (!handle) {
    return { found: false };
  }

  const apiKey = await loadAnyApiKey();
  if (!apiKey) {
    return { found: false };
  }

  try {
    const payload = await anyApiPost("/v1/run/instagram.profile", { handle }, apiKey);
    const output = payload.output ?? payload;
    const data = output?.data;
    if (!output?.found || !data) {
      return { found: false };
    }

    const bioLinks = (Array.isArray(data.bioLinks) ? data.bioLinks : [])
      .map((link) => ({ title: String(link?.title || "").trim(), url: String(link?.url || "").trim() }))
      .filter((link) => link.url);

    return {
      found: true,
      username: String(data.handle || handle).trim(),
      fullName: String(data.displayName || "").trim(),
      bio: String(data.bio || "").trim(),
      externalUrl: String(data.externalUrl || "").trim(),
      bioLinks,
      avatarUrl: String(data.avatarUrl || "").trim(),
      isPrivate: data.private === true,
    };
  } catch (error) {
    return { found: false, reason: error.message };
  }
}

async function fetchOgImage(pageUrl) {
  const safeUrl = await assertSafeOutboundHttpUrl(pageUrl);
  const response = await fetch(safeUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  });
  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!match) return null;

  const imageUrl = decodeHtmlEntities(match[1]);
  return { imageUrl, thumbnailUrl: imageUrl, contextUrl: pageUrl, isReel: false };
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
