import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");
const freshnessChecksPath = path.resolve(__dirname, "../data/freshness-checks.json");
const envPath = path.resolve(__dirname, "../.env");

async function loadEnvFile() {
  if (process.env.GOOGLE_PLACES_API_KEY) return;
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

// Google's parkingOptions doesn't distinguish dedicated customer parking from
// nearby paid street parking — any true sub-field just means "some parking
// option exists near this place," so we treat this as "parking nearby" rather
// than a guarantee of on-site or free parking.
async function getParkingAvailable(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "parkingOptions",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  const options = data.parkingOptions || {};
  return Object.values(options).some((value) => value === true);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await loadEnvFile();
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set in .env or the environment.");
  }

  const raw = await fs.readFile(dataPath, "utf8");
  const initial = JSON.parse(raw);

  let dismissedRecommendations = {};
  try {
    const freshnessRaw = await fs.readFile(freshnessChecksPath, "utf8");
    dismissedRecommendations = JSON.parse(freshnessRaw).dismissedRecommendations || {};
  } catch {
    // no freshness-checks file yet; nothing has been manually reviewed
  }

  // Only check salons we've already confidently matched to a Google place, and
  // only where we don't already have this marked — we only ever add this signal,
  // never remove or contradict an existing admin-entered value. A salon whose
  // parkingAvailable was manually reviewed and rejected is recorded in
  // freshness-checks.json's dismissedRecommendations and must never be
  // re-derived from Google here.
  const targets = initial.salons.filter(
    (salon) =>
      !salon.branches &&
      salon.googleMatchConfidence === "high" &&
      salon.googlePlaceId &&
      salon.parkingAvailable !== true &&
      dismissedRecommendations[salon.id]?.parkingAvailable !== true,
  );
  console.log(`Checking parking nearby for ${targets.length} high-confidence Google matches.`);

  const results = new Map();
  let checked = 0;
  let hasParking = 0;
  let failed = 0;

  for (const salon of targets) {
    try {
      const parkingNearby = await getParkingAvailable(salon.googlePlaceId);
      checked += 1;
      if (parkingNearby) {
        results.set(salon.id, true);
        hasParking += 1;
        console.log(`PARKING  ${salon.name}`);
      }
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${salon.name}: ${error.message}`);
    }
    await sleep(300 + Math.random() * 200);
  }

  const current = JSON.parse(await fs.readFile(dataPath, "utf8"));
  let applied = 0;
  for (const salon of current.salons) {
    if (results.get(salon.id)) {
      salon.parkingAvailable = true;
      applied += 1;
    }
  }
  await fs.writeFile(dataPath, JSON.stringify(current, null, 2) + "\n", "utf8");

  console.log(`Done. Checked ${checked}, parking nearby ${hasParking}, failed ${failed}, applied ${applied}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
