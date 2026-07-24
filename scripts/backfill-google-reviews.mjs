import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGooglePlacesApiKey, matchSalonToGoogle } from "../server/google-match.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = await loadGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set in .env or the environment.");
  }

  const raw = await fs.readFile(dataPath, "utf8");
  const initial = JSON.parse(raw);
  // Check every salon against Google too (Google reviews take priority over a booking
  // platform's when both exist), skipping any already checked to avoid re-billing on re-runs.
  let targets = initial.salons.filter((salon) => !salon.googleCheckedAt);
  const limit = Number(process.env.BACKFILL_LIMIT);
  if (limit > 0) targets = targets.slice(0, limit);
  console.log(`Checking Google for ${targets.length} salons without a confirmed booking-platform review.`);

  const results = new Map();
  let checked = 0;
  let highConfidenceWithReviews = 0;
  let lowConfidence = 0;
  let failed = 0;

  for (const salon of targets) {
    try {
      const update = await matchSalonToGoogle(salon, { apiKey });
      checked += 1;

      if (update.googleMatchConfidence === "no-match") {
        console.log(`NO MATCH  ${salon.name}`);
      } else {
        if (update.googleMatchConfidence === "high") {
          highConfidenceWithReviews += update.googleReviewCount > 0 ? 1 : 0;
        } else {
          lowConfidence += 1;
        }
        console.log(
          `${update.googleMatchConfidence === "high" ? "OK  " : "LOW "} ${salon.name} -> "${update.googleDisplayName}" (${update.googleFormattedAddress}) : ${update.googleReviewCount} reviews, nameScore=${update.nameScore.toFixed(2)}`,
        );
      }
      delete update.nameScore;
      results.set(salon.id, update);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${salon.name}: ${error.message}`);
    }
    await sleep(400 + Math.random() * 300);
  }

  const current = JSON.parse(await fs.readFile(dataPath, "utf8"));
  let applied = 0;
  for (const salon of current.salons) {
    const update = results.get(salon.id);
    if (update) {
      Object.assign(salon, update);
      applied += 1;
    }
  }
  await fs.writeFile(dataPath, JSON.stringify(current, null, 2) + "\n", "utf8");

  console.log(`Done. Checked ${checked}, high-confidence with reviews ${highConfidenceWithReviews}, low-confidence ${lowConfidence}, failed ${failed}, applied ${applied}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
