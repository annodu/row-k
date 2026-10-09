// Checks the service matcher against everything the health check has learned,
// so a rule change can't quietly undo an earlier fix.
//
//   npm run test:matcher -- --save   before changing rules: save today's results
//   npm run test:matcher             after: compare against the saved results
//   add --all to list every example instead of the first few
//
// It uses three sets of lines:
//   1. Lines you confirmed prove a service ("they have …" on a removal). Must match.
//   2. Lines you declined as evidence for an added service. Should not match; a
//      line that stopped matching and starts again is a regression.
//   3. Every salon's stored booking lines (data/freshness-checks.json). A line
//      that stops matching a service the salon is tagged with is a regression;
//      new matches for services the salon isn't tagged with are listed to review.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, ".cache/matcher-baseline.json");
const save = process.argv.includes("--save");
const showAll = process.argv.includes("--all");

const { matchServiceLines, matchServices, getFeedbackEvidenceItems, loadLearnedExclusions } = await import("../server/admin-stylists.mjs");
const { normalizeServices } = await import("../server/salon-index.mjs");
await loadLearnedExclusions();

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const salons = new Map(readJson("data/manual-salons.json").salons.map((salon) => [salon.id, salon]));
const feedback = readJson("data/health-check-feedback.json").entries || [];
const checks = readJson("data/freshness-checks.json").checks || [];

// 1 + 2: feedback lines, checked on their own.
const confirmed = [];
const declined = [];
for (const entry of feedback) {
  for (const item of getFeedbackEvidenceItems(entry)) {
    if (item.kind === "attribute") continue;
    const matches = matchServices([item.evidenceText]).includes(item.field);
    const testCase = { key: `${item.kind}|${item.field}|${item.evidenceText}`, service: item.field, text: item.evidenceText, salon: entry.salonName || "", matches };
    (item.kind === "remove" ? confirmed : declined).push(testCase);
  }
}

// 3: salon booking lines, matched in context like a real check.
const salonPairs = new Map();
for (const check of checks) {
  const lines = check.serviceCheck?.rawServices || [];
  if (!lines.length) continue;
  for (const { line, services } of matchServiceLines(lines)) {
    for (const service of services) salonPairs.set(`${check.id}|${service}|${line}`, { salonId: check.id, service, line });
  }
}

const current = {
  declinedKeys: declined.map((testCase) => testCase.key),
  declinedMatching: declined.filter((testCase) => testCase.matches).map((testCase) => testCase.key),
  salonPairs: [...salonPairs.keys()],
};

if (save) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(current));
  console.log(`Saved baseline: ${salonPairs.size} salon line matches, ${current.declinedMatching.length} of ${declined.length} declined lines still matching.`);
  process.exit(0);
}

const show = (title, items, format) => {
  if (!items.length) return;
  console.log(`\n${title} (${items.length})`);
  for (const item of showAll ? items : items.slice(0, 8)) console.log(`  - ${format(item)}`);
  if (!showAll && items.length > 8) console.log(`  … ${items.length - 8} more (--all to list)`);
};
const salonName = (id) => salons.get(id)?.name || id;
const isTagged = (id, service) => normalizeServices(salons.get(id)?.services || []).includes(service);

const confirmedFailing = confirmed.filter((testCase) => !testCase.matches);
show("FAIL: confirmed lines not recognised", confirmedFailing, (c) => `${c.service} ← "${c.text}" (${c.salon})`);

const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;
let regressions = confirmedFailing.length;
const stillDeclined = declined.filter((testCase) => testCase.matches);

if (baseline) {
  const wasDeclinedMatching = new Set(baseline.declinedMatching);
  const wasDeclined = new Set(baseline.declinedKeys || []);
  // Only lines that were already in the baseline and fixed count as reverted;
  // newly declined lines that the rules still match are listed, not failed.
  const reverted = stillDeclined.filter((testCase) => wasDeclined.has(testCase.key) && !wasDeclinedMatching.has(testCase.key));
  show("New declines the rules still match (hidden by exact-wording memory)", stillDeclined.filter((testCase) => !wasDeclined.has(testCase.key)), (c) => `${c.service} ← "${c.text}" (${c.salon})`);
  const fixed = declined.filter((testCase) => !testCase.matches && wasDeclinedMatching.has(testCase.key));
  show("FAIL: declined lines matching again", reverted, (c) => `${c.service} ← "${c.text}" (${c.salon})`);
  show("Fixed: declined lines that no longer match", fixed, (c) => `${c.service} ← "${c.text}" (${c.salon})`);
  regressions += reverted.length;

  const before = new Set(baseline.salonPairs);
  const after = new Set(current.salonPairs);
  const parse = (key) => { const [salonId, service, ...rest] = key.split("|"); return { salonId, service, line: rest.join("|") }; };
  const lost = baseline.salonPairs.filter((key) => !after.has(key)).map(parse);
  const gained = current.salonPairs.filter((key) => !before.has(key)).map(parse);
  // A tagged service only becomes a problem when no line supports it any more
  // (the health check would then suggest removing it); losing one of several
  // supporting lines is listed but isn't a failure.
  const stillSupported = new Set(current.salonPairs.map((key) => { const pair = parse(key); return `${pair.salonId}|${pair.service}`; }));
  const lostTagged = lost.filter((pair) => isTagged(pair.salonId, pair.service));
  const unsupported = lostTagged.filter((pair) => !stillSupported.has(`${pair.salonId}|${pair.service}`));
  const gainedUntagged = gained.filter((pair) => !isTagged(pair.salonId, pair.service));
  const format = (pair) => `${salonName(pair.salonId)}: ${pair.service} ← "${pair.line}"`;
  show("FAIL: a tagged service lost all its supporting lines (would be suggested for removal)", unsupported, format);
  show("Lines no longer counted for a tagged service (salon still supported by other lines)", lostTagged.filter((pair) => !unsupported.includes(pair)), format);
  show("Review: new suggestions (salon isn't tagged with these)", gainedUntagged, format);
  show("Fewer false suggestions (salon isn't tagged with these)", lost.filter((pair) => !isTagged(pair.salonId, pair.service)), format);
  show("Newly recognised tagged services", gained.filter((pair) => isTagged(pair.salonId, pair.service)), format);
  regressions += unsupported.length;
} else {
  console.log("\nNo baseline yet — run with --save before changing rules to compare against it.");
}

console.log(`\nConfirmed lines recognised: ${confirmed.length - confirmedFailing.length}/${confirmed.length}`);
console.log(`Declined lines still matched by the rules (needs a rule fix; hidden today only by exact-phrase memory): ${stillDeclined.length}/${declined.length}`);
console.log(regressions ? `\n✗ ${regressions} regression(s)` : "\n✓ No regressions");
process.exit(regressions ? 1 : 0);
