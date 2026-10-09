// Scans stylists' recent Instagram post captions (AnyAPI instagram.user_posts,
// a paid call — about one per stylist) for services they aren't tagged with
// yet, and writes a review file. Nothing is tagged automatically: a caption is
// looser evidence than a booking menu, so every suggestion keeps the caption
// quote and post link for a person to check.
// Usage: node scripts/scan-instagram-captions.mjs [--limit=50] [--offset=0] [--every=N] [--ids=a,b] [--services=all|new]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHashtagsForMatching, loadLearnedExclusions, matchServiceLines } from "../server/admin-stylists.mjs";
import { normalizeServices } from "../server/salon-index.mjs";
import { fetchInstagramRecentCaptions } from "../server/image-search.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const limit = Number(arg("limit", 50));
const offset = Number(arg("offset", 0));
const every = Number(arg("every", 1));
const ids = arg("ids", "").split(",").filter(Boolean);
const servicesMode = arg("services", "new");

// The services added in the 2026-10-09 filter changes.
const NEW_SERVICES = new Set([
  "Wig reinstall / re-glue", "Frontal / closure replacement", "Natural twists / plaits", "Braided ponytail",
  "Hot oil treatment", "Loc wash / detox", "Loc styling", "Flip-over Fulani / diva braids",
  "Alicia Keys braids", "Pop smoke braids", "Jayda Wayda braided sew-in", "Cassie braided sew-in", "Coi Leray braids", "Tyla braids", "Zoe Kravitz braids",
]);

await loadLearnedExclusions();
const salons = JSON.parse(fs.readFileSync(path.join(root, "data/manual-salons.json"), "utf8")).salons.filter((s) => s.instagramUrl);
const queue = ids.length ? salons.filter((s) => ids.includes(s.id)) : salons.filter((_, i) => i % every === 0).slice(offset, offset + limit);

const results = [];
let calls = 0;
let failed = 0;
for (const salon of queue) {
  let posts = [];
  try {
    calls += 1;
    posts = await fetchInstagramRecentCaptions(salon.instagramUrl, { num: 12 });
  } catch (error) {
    failed += 1;
    console.warn(`${salon.name}: ${error.message}`);
    if (/out of funds|budget|rate limit/i.test(error.message)) break;
    continue;
  }
  const tagged = new Set(normalizeServices(salon.services || []));
  const found = new Map();
  for (const post of posts) {
    // "@tyla" / "@cassie" tags the person (often a celebrity client), not the style.
    const caption = post.caption.replace(/@[\w.]+/g, " ");
    for (const { line, services } of matchServiceLines([caption, ...expandHashtagsForMatching(caption)])) {
      for (const service of services) {
        if (tagged.has(service) || (servicesMode === "new" && !NEW_SERVICES.has(service))) continue;
        if (!found.has(service)) found.set(service, []);
        if (found.get(service).length < 2) found.get(service).push({ line: line.slice(0, 140), url: post.url });
      }
    }
  }
  results.push({ id: salon.id, name: salon.name, posts: posts.length, suggestions: [...found].map(([service, evidence]) => ({ service, evidence })) });
  process.stdout.write(`\r${results.length}/${queue.length} scanned`);
}
console.log(`\n${calls} AnyAPI calls, ${failed} failed.`);

const outJson = path.join(root, ".cache/instagram-caption-scan.json");
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
const byService = {};
for (const r of results) for (const s of r.suggestions) (byService[s.service] ||= []).push(`- **${r.name}** — ${s.evidence.map((e) => `“${e.line}”${e.url ? ` ([post](${e.url}))` : ""}`).join("; ")}`);
let md = `# Instagram caption scan\n\n${results.length} stylists scanned (${calls} AnyAPI calls, ${failed} failed); ${results.filter((r) => r.posts).length} had captions. Suggestions only — nothing has been tagged. Only services the stylist isn't already tagged with are listed.\n\n`;
for (const [service, rows] of Object.entries(byService).sort((a, b) => b[1].length - a[1].length)) md += `## ${service} (${rows.length})\n\n${rows.join("\n")}\n\n`;
fs.writeFileSync(path.join(root, "instagram-caption-scan.md"), md);
console.log(Object.entries(byService).map(([k, v]) => `${v.length}\t${k}`).sort((a, b) => parseInt(b) - parseInt(a)).join("\n") || "no suggestions");
process.exit(0);
