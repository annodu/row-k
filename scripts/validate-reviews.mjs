// Run with: node scripts/validate-reviews.mjs
//
// Reports on review-data completeness across the directory: salons never
// checked against Google, salons with no Google match or only a low-confidence
// one, and matches that are stale enough to be worth re-running. This is a
// status report, not a correctness gate (a "no-match" is often a legitimate
// outcome, e.g. a mobile/home-based stylist with no public listing) — it
// always exits 0. There's no cron for the backfill scripts, so this is meant
// to be run by hand when you want a fleet-wide status check; see
// docs/sre-runbook.md for the equivalent counts on /api/health.
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { computeReviewHealth } = await import("../server/salon-index.mjs");

const salons = JSON.parse(readFileSync(path.join(root, "data/manual-salons.json"), "utf8")).salons;
const byId = new Map(salons.map((s) => [s.id, s]));
const health = computeReviewHealth(salons);

function printBucket(title, ids, hint) {
  console.log(`\n${title} (${ids.length})${hint ? ` — ${hint}` : ""}`);
  if (ids.length === 0) {
    console.log("  none");
    return;
  }
  for (const id of ids) {
    console.log(`  - ${byId.get(id)?.name ?? id} (${id})`);
  }
}

printBucket("Never checked against Google", health.neverChecked, "run scripts/backfill-google-reviews.mjs");
printBucket("No Google match found", health.noMatch, "search may need a manual re-check, e.g. via the admin approve flow");
printBucket("Low-confidence Google match", health.lowConfidence, "correct if the match is right, or fix the source data if it's wrong");
printBucket("Google match older than 90 days", health.staleCheck, "consider re-running the backfill");

console.log(
  `\n${salons.length} salons total. ${health.neverCheckedCount} never checked, ${health.noMatchCount} no-match, ${health.lowConfidenceCount} low-confidence, ${health.staleCheckCount} stale.`,
);

process.exit(0);
