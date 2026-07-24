import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeOutboundHttpUrl } from "../server/security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");

const verifiedReviewHostnames = ["fresha.com", "treatwell.co.uk", "booksy.com", "vagaro.com", "styleseat.com", "setmore.com"];
const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function getVerifiedReviewPlatform(bookingUrl) {
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

async function fetchReviewCount(bookingUrl) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const raw = await fs.readFile(dataPath, "utf8");
  const initial = JSON.parse(raw);
  const targets = initial.salons.filter((salon) => getVerifiedReviewPlatform(salon.bookingUrl));
  console.log(`Found ${targets.length} salons on verified-review platforms.`);

  const results = new Map();
  let checked = 0;
  let withReviews = 0;
  let failed = 0;

  for (const salon of targets) {
    try {
      const result = await fetchReviewCount(salon.bookingUrl);
      results.set(salon.id, { verifiedReviewCount: result.reviewCount, verifiedReviewCheckedAt: new Date().toISOString() });
      checked += 1;
      if (result.reviewCount > 0) withReviews += 1;
      console.log(`OK   ${salon.name}: ${result.reviewCount} reviews`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${salon.name}: ${error.message}`);
    }
    await sleep(500 + Math.random() * 400);
  }

  // Re-read fresh right before writing so we only touch the fields we own,
  // in case the admin tool wrote other changes to this file while we were fetching.
  const current = JSON.parse(await fs.readFile(dataPath, "utf8"));
  let applied = 0;
  for (const salon of current.salons) {
    const update = results.get(salon.id);
    if (update) {
      salon.verifiedReviewCount = update.verifiedReviewCount;
      salon.verifiedReviewCheckedAt = update.verifiedReviewCheckedAt;
      applied += 1;
    }
  }
  await fs.writeFile(dataPath, JSON.stringify(current, null, 2) + "\n", "utf8");

  console.log(`Done. Checked ${checked}, with reviews ${withReviews}, failed ${failed}, applied to file ${applied}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
