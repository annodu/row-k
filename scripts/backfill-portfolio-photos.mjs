import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadGooglePlacesApiKey, getPlacePhotos, fetchPlacePhotoMedia } from "../server/google-match.mjs";
import { findCandidateImageUrls, downloadImage, getOcrSignal, cropCollagePanel, closeBrowser, closeOcrWorker } from "./lib/photo-candidates.mjs";
import { classifyPhoto, loadOpenAiApiKey } from "./lib/vision-classifier.mjs";

// tesseract.js's worker occasionally throws on malformed/corrupt image data
// (e.g. a truncated GIF) via process.nextTick from inside its internal worker
// thread, bypassing the try/catch around recognize() entirely and crashing the
// whole process by default. One bad candidate image shouldn't kill a multi-hour
// batch run, so log and keep going instead.
process.on("uncaughtException", (error) => {
  console.log(`UNCAUGHT (continuing): ${error.message}`);
});

// Pools candidate photos from every source we have for a salon — Google Places,
// their Acuity/as.me booking page, and their own website — runs the same
// OCR-then-vision-classifier filter over all of them regardless of source, and
// keeps only the best few. This replaces the earlier Google-only pipeline
// (backfill-place-photos.mjs / the googlePlacePhotos field), because relying on
// Google Business photos alone was too hit-or-miss: plenty of salons had only
// storefront/interior shots, or no Google match at all, even though their own
// booking page or website had real examples of finished hairstyles.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/manual-salons.json");
const photosDir = path.resolve(__dirname, "../public/portfolio-photos");
const reviewDataPath = path.resolve(__dirname, "../data/portfolio-photo-review.json");
const reviewPhotosDir = path.resolve(__dirname, "../data/portfolio-review-photos");
const correctionsDataPath = path.resolve(__dirname, "../data/portfolio-photo-corrections.json");
const correctionsPhotosDir = path.resolve(__dirname, "../data/portfolio-photo-corrections-photos");
const MAX_REFERENCE_EXAMPLES = 3;

// A small, rotating sample of admin-approved corrections, shown to the
// classifier as reference examples on every call (see vision-classifier.mjs).
// Most-recent-first, capped to bound the extra image-token cost per call.
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

const KNOWN_BOOKING_PLATFORM_HOSTS = [
  "instagram.com",
  "phorest.com",
  "gettimely.com",
  "tress.ly",
  "s-iq.co",
  "squarespacescheduling.com",
  "square.com",
  "square.site",
  "simplybook.it",
  "getslick.com",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function imageExtension(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[8] === 0x57) return "webp";
  return "jpg";
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isKnownBookingPlatform(host) {
  if (!host) return true; // no host at all isn't a scrapeable own-site
  if (host.endsWith(".as.me")) return true; // handled separately as the "acuity" source
  return KNOWN_BOOKING_PLATFORM_HOSTS.some((platform) => host === platform || host.endsWith(`.${platform}`));
}

// Every page we should check for this salon: the Acuity booking page (if
// that's their booking platform) and their own website, deduped against each
// other and skipping known third-party booking platforms and hair shops
// (product catalogs, not portfolio photos).
function collectScrapeUrls(salon) {
  const urls = new Set();
  const bookingHost = hostnameOf(salon.bookingUrl);
  if (bookingHost.endsWith(".as.me") || bookingHost === "app.acuityscheduling.com") {
    urls.add(salon.bookingUrl);
  } else if (salon.bookingUrl && !isKnownBookingPlatform(bookingHost)) {
    urls.add(salon.bookingUrl);
  }
  // websiteUrl can share a domain with hairShopUrl (a business's main site with
  // a shop section further down) without the homepage itself being a product
  // catalog — a domain-level block would be too blunt (confirmed by checking
  // Aaliyah Naomi's site directly: the homepage is a real portfolio, the shop
  // is a separate sub-page). Leaning on the classifier's product-vs-real-work
  // judgment for this instead of excluding by domain.
  if (salon.websiteUrl?.trim()) {
    urls.add(salon.websiteUrl);
  }
  return [...urls];
}

async function gatherGoogleCandidates(salon, apiKey) {
  if (salon.googleMatchConfidence !== "high" || !salon.googlePlaceId) return [];
  try {
    const photos = await getPlacePhotos(salon.googlePlaceId, apiKey);
    const candidates = [];
    for (const photo of photos.slice(0, 5)) {
      try {
        const buffer = await fetchPlacePhotoMedia(photo.name, apiKey);
        candidates.push({ buffer, source: "google" });
      } catch {
        // skip this one photo, keep going
      }
      await sleep(120);
    }
    return candidates;
  } catch {
    return [];
  }
}

async function gatherScrapedCandidates(salon) {
  const candidates = [];
  for (const url of collectScrapeUrls(salon)) {
    try {
      const imageUrls = await findCandidateImageUrls(url);
      const source = hostnameOf(url).endsWith(".as.me") || hostnameOf(url) === "app.acuityscheduling.com" ? "acuity" : "website";
      for (const imageUrl of imageUrls) {
        try {
          const buffer = await downloadImage(imageUrl);
          candidates.push({ buffer, source });
        } catch {
          // skip this one image
        }
      }
    } catch {
      // page failed to load; skip this source for this salon
    }
  }
  return candidates;
}

async function main() {
  const [googleApiKey, openAiApiKey] = await Promise.all([loadGooglePlacesApiKey(), loadOpenAiApiKey()]);
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set in .env or the environment.");
  }

  await fs.mkdir(photosDir, { recursive: true });
  await fs.mkdir(reviewPhotosDir, { recursive: true });

  const referenceExamples = await loadReferenceExamples();
  if (referenceExamples.length > 0) {
    console.log(`Loaded ${referenceExamples.length} human-corrected reference example(s) for the classifier.`);
  }

  const raw = await fs.readFile(dataPath, "utf8");
  const initial = JSON.parse(raw);

  let targets = initial.salons.filter((salon) => !salon.branches && !salon.portfolioPhotosCheckedAt);
  if (process.env.BACKFILL_SOURCE === "acuity") {
    targets = targets.filter((salon) => {
      const host = hostnameOf(salon.bookingUrl);
      return host.endsWith(".as.me") || host === "app.acuityscheduling.com";
    });
  }
  if (process.env.BACKFILL_SALON_IDS) {
    // Targets a specific, known set of salons (e.g. re-checking everyone on a
    // platform after a scraping bug fix) regardless of portfolioPhotosCheckedAt,
    // since these are deliberately being re-processed, not freshly discovered.
    const ids = new Set(process.env.BACKFILL_SALON_IDS.split(",").map((id) => id.trim()));
    targets = initial.salons.filter((salon) => !salon.branches && ids.has(salon.id));
  }
  const limit = Number(process.env.BACKFILL_LIMIT);
  if (limit > 0) targets = targets.slice(0, limit);
  console.log(`Gathering portfolio photos for ${targets.length} salons.`);

  const results = new Map();
  const reviewCandidates = [];
  let checked = 0;
  let withPhotos = 0;
  let failed = 0;

  async function persistReview() {
    const current = await fs
      .readFile(reviewDataPath, "utf8")
      .then((text) => JSON.parse(text))
      .catch(() => ({ meta: {}, candidates: [] }));
    current.candidates = [...(current.candidates || []), ...reviewCandidates];
    current.meta = { updatedAt: today() };
    await fs.writeFile(reviewDataPath, JSON.stringify(current, null, 2) + "\n", "utf8");
    reviewCandidates.length = 0;
  }

  async function persist() {
    const current = JSON.parse(await fs.readFile(dataPath, "utf8"));
    let applied = 0;
    for (const salon of current.salons) {
      const update = results.get(salon.id);
      if (update) {
        delete salon.googlePlacePhotos;
        delete salon.googlePlacePhotosCheckedAt;
        Object.assign(salon, update);
        applied += 1;
      }
    }
    await fs.writeFile(dataPath, JSON.stringify(current, null, 2) + "\n", "utf8");
    return applied;
  }

  try {
    for (const salon of targets) {
      try {
        const rawCandidates = [
          ...(googleApiKey ? await gatherGoogleCandidates(salon, googleApiKey) : []),
          ...(await gatherScrapedCandidates(salon)),
        ];

        const kept = [];
        let hadClassifyError = false;
        for (const candidate of rawCandidates) {
          const ocr = await getOcrSignal(candidate.buffer);
          try {
            const classification = await classifyPhoto(candidate.buffer, {
              apiKey: openAiApiKey,
              ocrText: ocr.transcript,
              referenceExamples,
            });
            // A cropped-out collage panel's coordinates come from the vision
            // model's own (imprecise) estimate — verified live examples showed
            // real bleed from neighboring panels, caption bands, and even a
            // phone-mockup bezel. Never auto-publish one of these; always
            // route it to manual review so a human confirms the framing is
            // actually clean before it goes live.
            if (classification.showInDirectory && !candidate.isCollageCrop) {
              kept.push({ ...candidate, ...classification });
            } else {
              // Held for manual review in the admin tool rather than discarded —
              // the classifier's rejections are heuristic and some are wrong.
              const reviewId = crypto.randomUUID();
              const filename = `${reviewId}.${imageExtension(candidate.buffer)}`;
              await fs.writeFile(path.join(reviewPhotosDir, filename), candidate.buffer);
              reviewCandidates.push({
                id: reviewId,
                filename,
                salonId: salon.id,
                salonName: salon.name,
                source: candidate.source,
                category: classification.category,
                quality: classification.quality,
                reason: candidate.isCollageCrop ? `[cropped from collage] ${classification.reason}` : classification.reason,
                rejectedAt: today(),
              });
            }
            // A rejected composite can still contain individually good photos —
            // an Instagram-style "tag us in your selfie" collage of 2-4 framed
            // shots is common on booking pages. Crop each reported panel out
            // and feed it back through the same queue so it gets its own
            // OCR + classification pass as a standalone candidate.
            for (const panel of classification.collagePanels || []) {
              try {
                const croppedBuffer = await cropCollagePanel(candidate.buffer, panel);
                rawCandidates.push({ buffer: croppedBuffer, source: candidate.source, isCollageCrop: true });
              } catch {
                // panel coordinates didn't produce a sane crop; skip it
              }
            }
          } catch (error) {
            // A candidate that never got classified (rate limit, transient API
            // error) must not silently count as "checked and rejected" — a
            // salon must not be stamped portfolioPhotosCheckedAt below unless
            // every one of its candidates actually got a real answer, otherwise
            // a real photo can be lost forever behind a false "NONE" that never
            // gets retried (this exact bug previously happened at scale during
            // an OpenAI credit outage).
            hadClassifyError = true;
            console.log(`  classify error: ${error.message}`);
          }
          await sleep(500);
        }

        kept.sort((a, b) => b.quality - a.quality);
        const existingPhotos = salon.portfolioPhotos || [];

        checked += 1;

        if (hadClassifyError && kept.length === 0) {
          console.log(`SKIP  ${salon.name} (classify errors, will retry later; ${rawCandidates.length} candidates found)`);
        } else if (kept.length === 0) {
          results.set(salon.id, { portfolioPhotosCheckedAt: today() });
          console.log(`NONE  ${salon.name} (${rawCandidates.length} candidates checked)`);
        } else {
          // Every classifier-approved candidate gets added — no cap here.
          // Which 3 actually show publicly is decided later, by a human, in
          // the stylist drawer's Photos tab (see getPortfolioPhotos in
          // App.tsx, which slices to the first 3).
          const portfolioPhotos = [...existingPhotos];
          kept.forEach((photo) => {
            const filename = `${salon.id}-${crypto.randomUUID()}.${imageExtension(photo.buffer)}`;
            portfolioPhotos.push({
              id: `${salon.id}-portfolio-photo-${crypto.randomUUID()}`,
              url: `/portfolio-photos/${filename}`,
              source: photo.source,
            });
            fs.writeFile(path.join(photosDir, filename), photo.buffer).catch(() => {});
          });
          withPhotos += 1;
          results.set(salon.id, { portfolioPhotos, portfolioPhotosCheckedAt: today() });
          console.log(
            `OK    ${salon.name} -> ${kept.length} new photo(s) from [${kept.map((c) => c.source).join(", ")}] (${rawCandidates.length} candidates checked)`,
          );
        }
      } catch (error) {
        failed += 1;
        console.log(`FAIL  ${salon.name}: ${error.message}`);
      }

      if (checked % 10 === 0) {
        const applied = await persist();
        await persistReview();
        console.log(`-- checkpoint: saved ${applied} results to disk --`);
      }

      await sleep(300);
    }
  } finally {
    await closeBrowser();
    await closeOcrWorker();
    const applied = await persist();
    await persistReview();
    console.log(`Done. Checked ${checked}, with photos ${withPhotos}, failed ${failed}, applied ${applied}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
