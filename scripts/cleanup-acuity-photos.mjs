import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOcrSignal, closeOcrWorker } from "./lib/photo-candidates.mjs";
import { classifyPhoto, loadOpenAiApiKey } from "./lib/vision-classifier.mjs";

// One-off cleanup: re-classifies every existing acuity-sourced portfolio photo
// through the same vision classifier the backfill pipeline uses, and removes
// any that fail (booking-confirmation banners, "tag us in selfies" graphics,
// botched collage-panel crops, etc.) rather than blanket-deleting the whole
// source, since plenty of acuity photos are genuinely good.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");
const photosDir = path.resolve(__dirname, "../public/portfolio-photos");
const correctionsDataPath = path.resolve(__dirname, "../data/portfolio-photo-corrections.json");
const correctionsPhotosDir = path.resolve(__dirname, "../data/portfolio-photo-corrections-photos");
const MAX_REFERENCE_EXAMPLES = 3;

async function loadReferenceExamples() {
  const store = await fs
    .readFile(correctionsDataPath, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => ({ corrections: [] }));
  const recent = [...(store.corrections || [])].reverse().slice(0, MAX_REFERENCE_EXAMPLES);
  const examples = [];
  for (const correction of recent) {
    try {
      const buffer = await fs.readFile(path.join(correctionsPhotosDir, correction.filename));
      examples.push({ buffer, category: correction.category, reason: correction.reason });
    } catch {
      // file missing; skip it
    }
  }
  return examples;
}

async function main() {
  const apiKey = await loadOpenAiApiKey();
  if (!apiKey) {
    console.log("No OpenAI API key found. Aborting.");
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const referenceExamples = await loadReferenceExamples();

  const onlyIds = process.env.CLEANUP_SALON_IDS
    ? new Set(process.env.CLEANUP_SALON_IDS.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  let checked = 0;
  let removed = 0;
  let kept = 0;
  let errored = 0;

  for (const salon of data.salons) {
    if (onlyIds && !onlyIds.has(salon.id)) continue;
    if (!Array.isArray(salon.portfolioPhotos) || salon.portfolioPhotos.length === 0) continue;
    const acuityPhotos = salon.portfolioPhotos.filter((p) => p.source === "acuity");
    if (acuityPhotos.length === 0) continue;

    const survivors = [];
    for (const photo of salon.portfolioPhotos) {
      if (photo.source !== "acuity") {
        survivors.push(photo);
        continue;
      }

      checked += 1;
      const filename = photo.url?.split("/").pop();
      const filePath = filename ? path.join(photosDir, filename) : null;

      try {
        if (!filePath) throw new Error("no filename in url");
        const buffer = await fs.readFile(filePath);
        const ocr = await getOcrSignal(buffer);
        const result = await classifyPhoto(buffer, { apiKey, ocrText: ocr.transcript, referenceExamples });

        if (result.showInDirectory) {
          survivors.push(photo);
          kept += 1;
          console.log(`KEEP    ${salon.name} / ${filename} — ${result.reason}`);
        } else {
          removed += 1;
          console.log(`REMOVE  ${salon.name} / ${filename} — ${result.reason}`);
          await fs.unlink(filePath).catch(() => {});
        }
      } catch (error) {
        errored += 1;
        // Classify/read error — keep the photo rather than risk losing a good
        // one over a transient failure (e.g. rate limit, missing file).
        survivors.push(photo);
        console.log(`ERROR   ${salon.name} / ${filename ?? photo.url} — ${error.message} (kept)`);
      }
    }

    salon.portfolioPhotos = survivors;
  }

  data.meta.updatedAt = new Date().toISOString().slice(0, 10);
  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);

  // Validate the file we just wrote actually parses.
  const verify = await fs.readFile(dataPath, "utf8");
  JSON.parse(verify);

  console.log(
    `Done. Checked ${checked} acuity photo(s): kept ${kept}, removed ${removed}, errored ${errored}. JSON verified valid.`,
  );

  await closeOcrWorker();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
