// Social Studio admin routes — the stylist finder behind TikTok carousels.
// Filtering goes through searchSalons() so a brief returns exactly the set a
// visitor would get from the same filters on the public site.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryMap, derivedServiceMatches, readSalonIndex, searchSalons, serviceAliases } from "./salon-index.mjs";
import sharp from "sharp";
import { downloadImage } from "../scripts/lib/photo-candidates.mjs";
import { safeFetch } from "./outbound-http.mjs";
import { sanitizeErrorMessage } from "./security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const socialProjectsPath = path.resolve(__dirname, "../data/social-projects.json");

const SORTS = new Set(["photos", "reviews", "recent"]);
// Longest side for an image fetched into a carousel: enough for a full-bleed
// 1080×1920 cell without shipping the original's full resolution.
const CAROUSEL_IMAGE_MAX_SIDE = 1600;
const MAX_LIMIT = 60;

function splitParam(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Same rule as the public site's price filter (App.tsx comparablePriceBand).
function comparablePriceBand(salon) {
  return salon.servicePriceBand || salon.priceBand || "";
}

// A single TikTok video link (www/m/vm/vt.tiktok.com). Short vm/vt links are
// accepted too; oEmbed resolves them itself.
export function isTikTokVideoUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.port) return false;
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
    return (host === "www.tiktok.com" || host === "tiktok.com" || host === "m.tiktok.com") && /^\/@[^/]+\/(video|photo)\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function instagramHandle(url) {
  try {
    const [handle] = new URL(url).pathname.split("/").filter(Boolean);
    return handle ? `@${handle}` : "";
  } catch {
    return "";
  }
}

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Branded salons are flattened into one row per branch by readSalonIndex();
// a carousel features the stylist once, so branches fold back into their
// brand with every branch's areas merged.
function groupBranches(salons) {
  const groups = new Map();
  for (const salon of salons) {
    const key = salon.brandId || salon.id;
    const existing = groups.get(key);
    const areaIds = salon.areaIds?.length ? salon.areaIds : [salon.areaId].filter(Boolean);
    if (existing) {
      existing.areaIds = [...new Set([...existing.areaIds, ...areaIds])];
      continue;
    }
    groups.set(key, { ...salon, id: key, name: salon.brandName || salon.name, areaIds });
  }
  return [...groups.values()];
}

// Only carousels marked as posted count — drafts you never published don't.
function buildFeaturedIndex(store) {
  const featured = new Map();
  for (const project of Array.isArray(store?.projects) ? store.projects : []) {
    if (!project?.postedAt) continue;
    const salonIds = new Set((project.slides || []).map((slide) => slide?.salonId).filter(Boolean));
    for (const salonId of salonIds) {
      if (!featured.has(salonId)) featured.set(salonId, []);
      featured.get(salonId).push({ projectId: project.id, title: project.title || "Untitled", postedAt: project.postedAt });
    }
  }
  for (const list of featured.values()) list.sort((left, right) => String(right.postedAt).localeCompare(String(left.postedAt)));
  return featured;
}

function toCandidate(salon, { matchedServices, matchesBrief, featuredIn }) {
  const photos = (salon.portfolioPhotos || []).map((photo) => photo.url).filter(Boolean);
  return {
    id: salon.id,
    name: salon.name,
    handle: instagramHandle(salon.instagramUrl),
    instagramUrl: salon.instagramUrl || "",
    bookingUrl: salon.bookingUrl || "",
    bookingPlatform: salon.bookingPlatform || "",
    areaIds: salon.areaIds,
    areaLabel: salon.areaLabel || "",
    priceBand: comparablePriceBand(salon),
    services: salon.services || [],
    matchedServices,
    googleReviewCount: Number(salon.googleReviewCount) || 0,
    verifiedReviewCount: Number(salon.verifiedReviewCount) || 0,
    photos,
    addedIndex: salon.addedIndex ?? 0,
    matchesBrief,
    featuredIn,
  };
}

function compareCandidates(sort) {
  if (sort === "photos") return (left, right) => right.photos.length - left.photos.length || left.addedIndex - right.addedIndex;
  if (sort === "reviews") {
    return (left, right) =>
      right.googleReviewCount + right.verifiedReviewCount - (left.googleReviewCount + left.verifiedReviewCount) || left.addedIndex - right.addedIndex;
  }
  return (left, right) => left.addedIndex - right.addedIndex;
}

export function registerAdminSocialRoutes(app, { requireAdmin, readJson }) {
  // POST /api/admin/social/fetch-image  { imageUrl, thumbnailUrl? }
  // A carousel copy of an Instagram photo the admin just approved to the
  // stylist's portfolio, for when that new portfolio file isn't served yet
  // (hosted admin, before the photo site redeploys). Returned as a data: URL
  // so the slide holds the pixels itself: Instagram's CDN links expire and
  // aren't CORS-readable, which would break PNG export.
  app.post("/api/admin/social/fetch-image", requireAdmin, async (req, res) => {
    const imageUrl = String(req.body?.imageUrl || "");
    const thumbnailUrl = String(req.body?.thumbnailUrl || "");
    if (!/^https:\/\//.test(imageUrl)) {
      return res.status(400).json({ ok: false, message: "A https imageUrl is required." });
    }

    let buffer;
    try {
      buffer = await downloadImage(imageUrl);
    } catch (primaryError) {
      if (!/^https:\/\//.test(thumbnailUrl)) {
        return res.status(400).json({ ok: false, message: sanitizeErrorMessage(primaryError, "Could not download that image.") });
      }
      try {
        buffer = await downloadImage(thumbnailUrl);
      } catch (fallbackError) {
        return res.status(400).json({ ok: false, message: sanitizeErrorMessage(fallbackError, "Could not download that image.") });
      }
    }

    try {
      const jpeg = await sharp(buffer)
        .rotate()
        .resize({ width: CAROUSEL_IMAGE_MAX_SIDE, height: CAROUSEL_IMAGE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 84 })
        .toBuffer();
      res.json({ ok: true, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
    } catch (error) {
      res.status(400).json({ ok: false, message: sanitizeErrorMessage(error, "Could not process that image.") });
    }
  });

  // POST /api/admin/social/tiktok-cover  { videoUrl }
  // TikTok's public oEmbed: the video's cover image (usually 576×1024) plus its
  // title and author. Free and keyless, but only the cover TikTok picked —
  // there's no way to choose a different frame through it.
  app.post("/api/admin/social/tiktok-cover", requireAdmin, async (req, res) => {
    const videoUrl = String(req.body?.videoUrl || "").trim();
    if (!isTikTokVideoUrl(videoUrl)) {
      return res.status(400).json({ ok: false, message: "Use a link to one TikTok video, e.g. tiktok.com/@name/video/…" });
    }
    try {
      const response = await safeFetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
        headers: { accept: "application/json" },
        maxBytes: 200_000,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.thumbnail_url) {
        return res.status(404).json({ ok: false, message: "TikTok didn't return a cover for that video — check it's public and the link is right." });
      }
      res.json({
        ok: true,
        imageUrl: payload.thumbnail_url,
        width: payload.thumbnail_width ?? null,
        height: payload.thumbnail_height ?? null,
        title: String(payload.title || "").slice(0, 300),
        authorHandle: payload.author_unique_id ? `@${payload.author_unique_id}` : "",
      });
    } catch (error) {
      res.status(502).json({ ok: false, message: sanitizeErrorMessage(error, "Couldn't reach TikTok. Try again.") });
    }
  });

  // GET /api/admin/social/candidates
  //   category, service       — a filters.json category id and/or canonical subcategory
  //   areaIds, priceBands     — comma-separated
  //   q                       — name/@handle search across the whole directory
  //                             (ignores the brief; results flag `matchesBrief`)
  //   sort, offset, limit
  app.get("/api/admin/social/candidates", requireAdmin, async (req, res) => {
    const category = String(req.query.category || "").trim();
    const rawService = String(req.query.service || "").trim();
    const service = serviceAliases[rawService] ?? rawService;
    const areaIds = splitParam(req.query.areaIds);
    const priceBands = splitParam(req.query.priceBands);
    const q = normalizeForSearch(req.query.q).slice(0, 80);
    const sort = SORTS.has(req.query.sort) ? req.query.sort : "photos";
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || 24));

    const [index, briefSearch, projectsStore] = await Promise.all([
      readSalonIndex(),
      searchSalons({
        categories: category ? [category] : [],
        subcategories: service ? [service] : [],
        regions: areaIds.length ? areaIds : ["all"],
      }),
      readJson(socialProjectsPath, { projects: [] }),
    ]);

    const priceAllowed = (salon) => !priceBands.length || priceBands.includes(comparablePriceBand(salon));
    const briefIds = new Set(briefSearch.results.filter(priceAllowed).map((salon) => salon.brandId || salon.id));
    const featured = buildFeaturedIndex(projectsStore);
    // An umbrella service (e.g. "Hybrid installs") credits stylists with whichever members they do.
  const serviceScope = service ? [service, ...(derivedServiceMatches[service] ?? [])] : category ? categoryMap[category] ?? [] : [];

    let pool;
    if (q) {
      const compactQuery = q.replace(/ /g, "");
      pool = groupBranches(index.salons).filter((salon) => {
        const handle = normalizeForSearch(instagramHandle(salon.instagramUrl)).replace(/ /g, "");
        const name = normalizeForSearch(salon.name);
        return name.includes(q) || name.replace(/ /g, "").includes(compactQuery) || handle.includes(compactQuery);
      });
    } else {
      pool = groupBranches(briefSearch.results.filter(priceAllowed));
    }

    const candidates = pool
      .map((salon) =>
        toCandidate(salon, {
          matchedServices: serviceScope.filter((name) => (salon.services || []).includes(name)),
          matchesBrief: briefIds.has(salon.id),
          featuredIn: featured.get(salon.id) ?? [],
        }),
      )
      .sort(compareCandidates(q ? "recent" : sort));

    res.json({
      ok: true,
      total: candidates.length,
      offset,
      limit,
      directoryTotal: groupBranches(index.salons).length,
      candidates: candidates.slice(offset, offset + limit),
    });
  });
}
