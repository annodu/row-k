import { assertSafeOutboundHttpUrl } from "./security.mjs";

export const verifiedReviewHostnames = ["fresha.com", "treatwell.co.uk", "booksy.com", "vagaro.com", "styleseat.com", "setmore.com"];

const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function getVerifiedReviewPlatform(bookingUrl) {
  const url = (bookingUrl || "").toLowerCase();
  return verifiedReviewHostnames.find((hostname) => url.includes(hostname)) ?? null;
}

function extractReviewCount(html) {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
    for (const node of nodes) {
      const rating = node?.aggregateRating;
      if (rating && typeof rating.reviewCount === "number") {
        return rating.reviewCount;
      }
    }
  }
  return 0;
}

export async function fetchReviewCount(bookingUrl) {
  const safeUrl = await assertSafeOutboundHttpUrl(bookingUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(safeUrl, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    return { ok: true, reviewCount: extractReviewCount(html) };
  } finally {
    clearTimeout(timeout);
  }
}

// Used both by the batch backfill script and by the admin approve-draft flow so
// a newly published stylist on a verified-review platform gets its count filled
// in immediately instead of waiting on the next manual backfill run.
export async function matchVerifiedReviews(salon) {
  if (!getVerifiedReviewPlatform(salon.bookingUrl)) return null;
  const result = await fetchReviewCount(salon.bookingUrl);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { verifiedReviewCount: result.reviewCount, verifiedReviewCheckedAt: today() };
}
