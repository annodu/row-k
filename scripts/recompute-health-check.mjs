// Re-applies the current service rules to every stored health check
// (data/freshness-checks.json) without fetching anything — for after a
// taxonomy / matcher change, instead of re-running the whole health check.
// Usage: npm run recompute-health-check [-- --dry-run] [-- --ids=a,b]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recomputeStoredServiceSuggestions } from "../server/admin-stylists.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const ids = new Set((process.argv.find((a) => a.startsWith("--ids="))?.slice(6) || "").split(",").filter(Boolean));
const storePath = path.join(root, "data/freshness-checks.json");
const text = fs.readFileSync(storePath, "utf8");
const store = JSON.parse(text);
const salons = new Map(JSON.parse(fs.readFileSync(path.join(root, "data/manual-salons.json"), "utf8")).salons.map((s) => [s.id, s]));

const before = { added: 0, removed: 0 };
const after = { added: 0, removed: 0 };
let changed = 0;
const checks = [];
for (const check of store.checks || []) {
  if (ids.size && !ids.has(check.id)) { checks.push(check); continue; }
  const next = await recomputeStoredServiceSuggestions(check, salons.get(check.id), store.dismissedRecommendations?.[check.id] || {});
  before.added += (check.addedServices || []).length; before.removed += (check.removedServices || []).length;
  after.added += (next.addedServices || []).length; after.removed += (next.removedServices || []).length;
  if (JSON.stringify([check.addedServices, check.removedServices]) !== JSON.stringify([next.addedServices, next.removedServices])) changed += 1;
  checks.push(next);
}
console.log(`Suggestions to add: ${before.added} → ${after.added}; to remove: ${before.removed} → ${after.removed}; ${changed} checks changed.`);
if (!dryRun) {
  fs.writeFileSync(storePath, JSON.stringify({ ...store, checks }, null, 2) + (text.endsWith("\n") ? "\n" : ""));
  console.log("Saved.");
}
process.exit(0);
