import { createWorker } from "tesseract.js";
import sharp from "sharp";

// Shared candidate-gathering + filtering for the portfolio-photos pipeline.
// Reuses the same "content-sized images, rendered browser, local OCR" approach
// as extract-image-text.mjs, but downloads the actual image bytes (for hosting
// and for the vision classifier) rather than screenshotting DOM elements.

const browserUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MIN_IMAGE_WIDTH = 240;
const MIN_IMAGE_HEIGHT = 180;
const MAX_CANDIDATES_PER_PAGE = 6;

// Fresha listing pages embed a "similar businesses nearby" carousel further
// down the page, showing real photos from OTHER, unrelated salons — a genuine
// misattribution risk (a stranger's photo could get saved under the wrong
// business) that none of the other booking platforms have. Every Fresha image
// URL embeds a numeric location id in its path; the salon's own photos always
// appear first in page order sharing one id, before the nearby-businesses
// widget's images (each with a different id). Scoping to the first id seen
// reliably keeps only this salon's own photos.
const FRESHA_IMAGE_ID_PATTERN = /fresha\.com\/(?:locations\/location-profile-images|partner-portfolios\/providers)\/(\d+)\//;

function isFreshaHost(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "") === "fresha.com";
  } catch {
    return false;
  }
}

function restrictToOwnFreshaSalon(candidates) {
  let ownId = null;
  for (const candidate of candidates) {
    const match = candidate.url.match(FRESHA_IMAGE_ID_PATTERN);
    if (match) {
      ownId = match[1];
      break;
    }
  }
  if (!ownId) return candidates;
  return candidates.filter((candidate) => {
    const match = candidate.url.match(FRESHA_IMAGE_ID_PATTERN);
    return !match || match[1] === ownId;
  });
}

let browserPromise = null;
export async function getBrowser() {
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

export async function closeBrowser() {
  const browser = await browserPromise;
  await browser?.close().catch(() => {});
}

let ocrWorkerPromise = null;
async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng");
  }
  return ocrWorkerPromise;
}

export async function closeOcrWorker() {
  const worker = await ocrWorkerPromise;
  await worker?.terminate().catch(() => {});
}

// Some sites (Treatwell's gallery included) lay a full-resolution photo out in
// a small CSS grid tile — the rendered bounding box is a thumbnail, but the
// actual image file behind it is much bigger. Judging candidates by rendered
// size alone throws those away; naturalWidth/naturalHeight reflects the real
// downloaded image, which is what actually matters for portfolio quality.
const FRAME_IMG_EVAL = ({ minWidth, minHeight }) => {
  const seen = new Set();
  const results = [];
  for (const img of document.querySelectorAll("img")) {
    const rect = img.getBoundingClientRect();
    const width = Math.max(rect.width, img.naturalWidth || 0);
    const height = Math.max(rect.height, img.naturalHeight || 0);
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src)) continue;
    if (width < minWidth || height < minHeight) continue;
    seen.add(src);
    results.push({ url: src, area: width * height });
  }
  return results;
};

async function collectFrameImages(frames, minWidth, minHeight) {
  const seen = new Set();
  const candidates = [];
  for (const frame of frames) {
    try {
      const frameCandidates = await frame.evaluate(FRAME_IMG_EVAL, { minWidth, minHeight });
      for (const candidate of frameCandidates) {
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        candidates.push(candidate);
      }
    } catch {
      // frame navigated away, cross-origin restricted, or not yet loaded; skip it
    }
  }
  return candidates;
}

async function scrollToActivateEmbeds(page) {
  for (let i = 0; i < 10; i += 1) {
    await page.evaluate(() => window.scrollBy(0, 700)).catch(() => {});
    await page.waitForTimeout(250);
  }
}

// Acuity's category list (e.g. "Knotless Braids") is plain text — the real
// per-service work photos only render once you click into a specific
// category, using Acuity's own "appointmentType-*" image naming. Reloads
// between categories rather than navigating back, since Acuity's widget state
// doesn't reliably reset otherwise; capped to bound how long one salon's page
// can take.
const MAX_ACUITY_CATEGORIES = 4;

async function collectAcuityServicePhotos(page, pageUrl) {
  const acuityFrame = page.frames().find((frame) => frame.url().includes("acuityscheduling.com"));
  if (!acuityFrame) return [];

  const categoryCount = await acuityFrame
    .locator("button:has-text('Select'), a:has-text('Select')")
    .count()
    .catch(() => 0);
  const categoriesToTry = Math.min(categoryCount, MAX_ACUITY_CATEGORIES);

  const found = [];
  for (let index = 0; index < categoriesToTry; index += 1) {
    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await scrollToActivateEmbeds(page);

      const frame = page.frames().find((f) => f.url().includes("acuityscheduling.com"));
      if (!frame) continue;
      const buttons = await frame.locator("button:has-text('Select'), a:has-text('Select')").all();
      if (!buttons[index]) continue;
      await buttons[index].click({ timeout: 5_000 });
      await page.waitForTimeout(2_000);

      const afterClickFrame = page.frames().find((f) => f.url().includes("acuityscheduling.com"));
      if (!afterClickFrame) continue;
      // Real appointment-type photos are often smaller than a typical hero
      // banner (compact list thumbnails), so use a lower size floor here.
      const clicked = await collectFrameImages([afterClickFrame], 150, 150);
      found.push(...clicked);
    } catch {
      // this category failed to open; move on to the next
    }
  }
  return found;
}

// Finds real content photos on a rendered page (Acuity booking pages, or an
// arbitrary business website) and returns their actual resolved image URLs —
// not screenshots — so we can download the original file for hosting. Many
// businesses embed their Acuity scheduler as an <iframe> on their own domain
// (rather than linking straight to the acuity/as.me URL), and a plain
// document.querySelectorAll on the top-level page can't see into that —
// Playwright's frame API can, regardless of the iframe being cross-origin, so
// every frame on the page gets checked, not just the main one.
export async function findCandidateImageUrls(pageUrl) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: browserUserAgent,
    viewport: { width: 1365, height: 900 },
  });
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    // Some embeds (Acuity's included) only fully render once scrolled into view.
    await scrollToActivateEmbeds(page);

    const seen = new Set();
    let candidates = await collectFrameImages(page.frames(), MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT);
    if (isFreshaHost(pageUrl)) candidates = restrictToOwnFreshaSalon(candidates);
    for (const candidate of candidates) seen.add(candidate.url);

    for (const candidate of await collectAcuityServicePhotos(page, pageUrl)) {
      if (seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      candidates.push(candidate);
    }

    return candidates
      .sort((a, b) => b.area - a.area)
      .slice(0, MAX_CANDIDATES_PER_PAGE)
      .map((c) => c.url);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function downloadImage(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  // Some CDNs (Acuity's included) serve real images as application/octet-stream —
  // the URL already came from a rendered <img src> that the browser itself
  // successfully painted, so trust that over a mislabeled content-type header.
  const looksLikeImageUrl = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
  if (!contentType.startsWith("image/") && contentType !== "application/octet-stream" && !looksLikeImageUrl) {
    throw new Error(`Not an image: ${contentType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return flattenAnimatedImage(buffer);
}

// A portfolio "photo" that's actually a looping Boomerang/animation (saved as
// a scraped Instagram/booking-page GIF) doesn't belong in a static directory
// listing — flatten it to its first frame as a still JPEG so nothing
// animated ever reaches the candidate pool in the first place.
async function flattenAnimatedImage(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return buffer; // not readable by sharp at all; let downstream handling deal with it
  }
  if (!metadata.pages || metadata.pages <= 1) return buffer;
  try {
    return await sharp(buffer, { animated: false }).jpeg().toBuffer();
  } catch {
    return buffer;
  }
}

// OCR runs on every candidate as advisory context for the vision model, never
// a hard yes/no gate. A word-count hard-reject was tried here to skip the
// vision API call on obvious dense-text screenshots, but tesseract routinely
// misreads busy, high-contrast close-up hair texture (braids, wavy strands)
// as dense text — confirmed on real portfolio photos scoring 100+ "words" of
// pure gibberish — which silently discarded exactly the photos this app most
// wants. Not worth the false-negative risk to save one API call.
export async function getOcrSignal(buffer) {
  try {
    const worker = await getOcrWorker();
    // A malformed image can make tesseract's worker throw internally without
    // ever settling the recognize() promise (it crashes via process.nextTick
    // instead of rejecting) — race it against a timeout so one bad image can't
    // hang the whole batch run indefinitely.
    const {
      data: { text },
    } = await Promise.race([
      worker.recognize(buffer),
      new Promise((_, reject) => setTimeout(() => reject(new Error("OCR timed out")), 20_000)),
    ]);
    const wordCount = (text.match(/[a-zA-Z]{3,}/g) || []).length;
    return { transcript: text.trim(), wordCount };
  } catch {
    // OCR failing shouldn't block an otherwise-good photo from being classified.
    return { transcript: "", wordCount: 0 };
  }
}

// Some booking-page images are a clean grid/row of separate photos framed like
// individual Instagram posts (e.g. a "tag us in your selfie" collage) — the
// composite as a whole correctly fails classification, but each panel inside
// it is often a perfectly good standalone hairstyle photo. The vision
// classifier reports each panel's location as fractional (0-1) coordinates;
// this crops one out as its own image buffer so it can be re-classified on
// its own merits instead of being thrown away with the rest of the collage.
export async function cropCollagePanel(buffer, panel, rotationDegrees = 0) {
  // Rotate to a real buffer first (rather than chaining .rotate() straight
  // into the same pipeline) so the metadata read below reflects the actual
  // post-rotation dimensions — needed since a 90/270 rotation swaps width
  // and height, and the panel fractions are always relative to what's
  // currently on screen, i.e. post-rotation.
  const normalizedRotation = ((Math.round(rotationDegrees) % 360) + 360) % 360;
  const workingBuffer = normalizedRotation ? await sharp(buffer).rotate(normalizedRotation).toBuffer() : buffer;

  const image = sharp(workingBuffer);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Could not read image dimensions");

  const left = Math.max(0, Math.round(panel.x * width));
  const top = Math.max(0, Math.round(panel.y * height));
  const cropWidth = Math.min(width - left, Math.round(panel.width * width));
  const cropHeight = Math.min(height - top, Math.round(panel.height * height));
  if (cropWidth < 20 || cropHeight < 20) throw new Error("Collage panel too small to crop");

  return image.extract({ left, top, width: cropWidth, height: cropHeight }).jpeg().toBuffer();
}
