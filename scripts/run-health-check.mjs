// Runs the admin health check locally without the admin UI, batch by batch,
// and saves every check (clean ones included) to data/freshness-checks.json.
// Usage: npm run health-check [-- --ids=id1,id2]
import { runStylistCheckBatch } from "../server/admin-stylists.mjs";

const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const ids = idsArg ? idsArg.slice("--ids=".length) : "";

let offset = 0;
let flagged = 0;
while (offset !== null) {
  const result = await runStylistCheckBatch({ offset, limit: 50, ids });
  flagged += result.checks.length;
  console.log(`Checked ${result.checkedCount} of ${result.total} (${flagged} flagged)${result.persisted ? "" : " — not saved"}`);
  offset = result.nextOffset;
}
process.exit(0);
