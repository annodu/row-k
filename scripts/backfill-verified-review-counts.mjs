import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVerifiedReviewPlatform, matchVerifiedReviews } from "../server/verified-reviews.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");

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
      const update = await matchVerifiedReviews(salon);
      results.set(salon.id, update);
      checked += 1;
      if (update.verifiedReviewCount > 0) withReviews += 1;
      console.log(`OK   ${salon.name}: ${update.verifiedReviewCount} reviews`);
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
