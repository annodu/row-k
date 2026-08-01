import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";

// Many as.me / Acuity booking pages put their real content — policies, location
// notes, parking, deposit rules — inside a single tall graphic banner image
// rather than in page text. Playwright's innerText() (used by the existing
// price-check pipeline in server/admin-stylists.mjs) never sees that text,
// because it isn't DOM text at all, it's pixels. This script screenshots each
// content-sized image on a page and runs it through tesseract.js (the same
// local, free OCR engine already used for manual price-list uploads in
// src/AdminApp.tsx) to get real text, then keyword-matches for parking
// mentions with a verbatim quote as evidence.
//
// This intentionally never writes to data/manual-salons.json. It only reports
// what it found (to stdout, and as a JSON report when run in --all mode) so an
// admin can review the OCR'd quote before anything gets applied — only the
// stylist's own stated words should count as confirmation, and OCR can still
// misread, so a human should eyeball the match before it's treated as fact.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");

const browserUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = import("playwright")
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
}

let ocrWorkerPromise = null;
async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng");
  }
  return ocrWorkerPromise;
}

// Skip small logos/icons/avatars — we only want banner-sized graphics that
// could plausibly contain paragraphs of policy text.
const MIN_IMAGE_WIDTH = 280;
const MIN_IMAGE_HEIGHT = 180;
const MAX_IMAGES_PER_PAGE = 8;

async function findContentImages(page) {
  const handles = await page.locator("img").elementHandles();
  const boxed = [];
  for (const handle of handles) {
    const box = await handle.boundingBox().catch(() => null);
    if (box && box.width >= MIN_IMAGE_WIDTH && box.height >= MIN_IMAGE_HEIGHT) {
      boxed.push({ handle, box });
    }
  }
  // Largest area first — the policy banner is usually the biggest image on the page.
  boxed.sort((left, right) => right.box.width * right.box.height - left.box.width * left.box.height);
  return boxed.slice(0, MAX_IMAGES_PER_PAGE).map((entry) => entry.handle);
}

async function screenshotImage(handle) {
  return handle.screenshot({ type: "png" }).catch(() => null);
}

async function ocrImage(buffer) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buffer);
  return (data.text || "").trim();
}

const KEYWORD_PATTERNS = {
  parking: /\bparking\b/i,
  stepFreeAccess: /\b(step[- ]free|wheelchair|accessib\w*)\b/i,
};

function findKeywordQuotes(text, pattern) {
  // Split on sentence-ish boundaries and newlines so the quote stays short
  // and readable, rather than dumping the whole transcript as "evidence".
  const lines = text.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => pattern.test(line));
}

async function extractImageTextFromUrl(url) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: browserUserAgent,
    viewport: { width: 1365, height: 900 },
    deviceScaleFactor: 3,
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    const images = await findContentImages(page);
    const results = [];
    for (const handle of images) {
      const buffer = await screenshotImage(handle);
      if (!buffer) continue;
      try {
        const transcript = await ocrImage(buffer);
        results.push({
          transcript,
          parkingQuotes: findKeywordQuotes(transcript, KEYWORD_PATTERNS.parking),
          stepFreeAccessQuotes: findKeywordQuotes(transcript, KEYWORD_PATTERNS.stepFreeAccess),
        });
      } catch (error) {
        results.push({ error: error.message });
      }
    }
    return results;
  } finally {
    await page.close().catch(() => {});
  }
}

function printReport(url, results) {
  console.log(`\n=== ${url} ===`);
  if (!results.length) {
    console.log("No content-sized images found on the page.");
    return;
  }
  results.forEach((result, index) => {
    console.log(`\n-- image ${index + 1} --`);
    if (result.error) {
      console.log(`FAILED: ${result.error}`);
      return;
    }
    console.log(result.transcript);
    console.log("");
    console.log(
      result.parkingQuotes.length
        ? `parkingMentioned: true — ${result.parkingQuotes.map((quote) => `"${quote}"`).join(" / ")}`
        : "parkingMentioned: false",
    );
    console.log(
      result.stepFreeAccessQuotes.length
        ? `stepFreeAccessMentioned: true — ${result.stepFreeAccessQuotes.map((quote) => `"${quote}"`).join(" / ")}`
        : "stepFreeAccessMentioned: false",
    );
  });
}

async function runSingle(url) {
  const results = await extractImageTextFromUrl(url);
  printReport(url, results);
}

async function runAll({ limit } = {}) {
  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const targets = data.salons
    .filter((salon) => !salon.branches && (salon.bookingUrl || "").includes("as.me"))
    .slice(0, limit ?? Infinity);

  console.log(`Running local OCR on ${targets.length} as.me salon pages (report-only, no data file writes).`);

  const report = [];
  for (const salon of targets) {
    try {
      const results = await extractImageTextFromUrl(salon.bookingUrl);
      printReport(`${salon.name} — ${salon.bookingUrl}`, results);
      report.push({ id: salon.id, name: salon.name, bookingUrl: salon.bookingUrl, images: results });
    } catch (error) {
      console.log(`\n=== ${salon.name} — ${salon.bookingUrl} ===\nFAILED: ${error.message}`);
      report.push({ id: salon.id, name: salon.name, bookingUrl: salon.bookingUrl, error: error.message });
    }
  }

  const reportPath = path.resolve(__dirname, "../data/vision-ocr-report.json");
  await fs.writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2) + "\n", "utf8");
  const parkingHits = report.filter((entry) => entry.images?.some((image) => image.parkingQuotes?.length));
  console.log(
    `\nWrote report to ${reportPath}. ${parkingHits.length} salon(s) had a parking mention. Nothing was applied to manual-salons.json — review and apply manually.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--all") {
    const limitArg = args.find((arg) => arg.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
    await runAll({ limit });
  } else if (args[0]) {
    await runSingle(args[0]);
  } else {
    console.log("Usage: node scripts/extract-image-text.mjs <url>");
    console.log("       node scripts/extract-image-text.mjs --all [--limit=N]");
    process.exitCode = 1;
    return;
  }

  const browser = await browserPromise;
  await browser?.close().catch(() => {});
  const worker = await ocrWorkerPromise;
  await worker?.terminate().catch(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
