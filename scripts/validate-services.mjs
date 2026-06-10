// Run with: node scripts/validate-services.mjs
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1. Import canonical names and aliases from salon-index.mjs
const { categoryMap, serviceAliases } = await import("../server/salon-index.mjs");

const canonicalServices = new Set(Object.values(categoryMap).flat());
const aliasKeys = new Set(Object.keys(serviceAliases));
// Valid: canonical name OR an alias that resolves to a canonical name
const validServices = new Set([
  ...canonicalServices,
  ...[...aliasKeys].filter((k) => canonicalServices.has(serviceAliases[k])),
]);

// 2. Collect all services used in data
const salons = JSON.parse(readFileSync(path.join(root, "data/manual-salons.json"), "utf8")).salons;
const usedServices = new Set(salons.flatMap((s) => s.services ?? []));

// 3. Find mismatches
const unmapped = [...usedServices].filter((s) => !validServices.has(s));
let errors = 0;

if (unmapped.length) {
  console.error("❌ Services in salon data with no match in server/salon-index.mjs categoryMap:");
  unmapped.forEach((s) => console.error(`   "${s}"`));
  errors++;
} else {
  console.log(`✅ All ${usedServices.size} service types in salon data are valid`);
}

// 4. Warn about broken aliases (alias target not in canonical set)
const brokenAliases = Object.entries(serviceAliases).filter(([, v]) => !canonicalServices.has(v));
if (brokenAliases.length) {
  console.error("⚠️  Aliases pointing to non-canonical targets:");
  brokenAliases.forEach(([k, v]) => console.error(`   "${k}" → "${v}"`));
  errors++;
}

process.exit(errors > 0 ? 1 : 0);
