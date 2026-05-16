import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { categoryMap, normalizeServices, readSalonIndex, serviceAliases } from "./salon-index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const draftsPath = path.resolve(__dirname, "../data/stylist-drafts.json");
const freshnessChecksPath = path.resolve(__dirname, "../data/freshness-checks.json");
const discoverySuggestionsPath = path.resolve(__dirname, "../data/discovery-suggestions.json");
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");
const sessionCookieName = "rowk_admin_session";
const sessions = new Map();

const regionOptions = [
  { id: "all-london", label: "London" },
  { id: "central", label: "Central London" },
  { id: "north", label: "North London" },
  { id: "north-west", label: "North West London" },
  { id: "east", label: "East London" },
  { id: "south-east", label: "South East London" },
  { id: "south-west", label: "South West London" },
  { id: "west", label: "West London" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile / Home service" },
];

const bookingPlatformMatchers = [
  ["fresha.com", "Fresha"],
  ["booksy.com", "Booksy"],
  ["setmore.com", "Setmore"],
  ["as.me", "Acuity"],
  ["acuityscheduling.com", "Acuity"],
  ["square.site", "Square"],
  ["squareup.com", "Square"],
  ["treatwell.co.uk", "Treatwell"],
  ["glossgenius.com", "GlossGenius"],
  ["styleseat.com", "StyleSeat"],
  ["calendly.com", "Calendly"],
];

const canonicalServices = [...new Set(Object.values(categoryMap).flat().filter(Boolean))].sort((left, right) => left.localeCompare(right));

const intakeServiceAliases = {
  "leave out weave": "Traditional sew-in / leave out",
  "leave-out weave": "Traditional sew-in / leave out",
  "leave out sew in": "Traditional sew-in / leave out",
  "leave-out sew-in": "Traditional sew-in / leave out",
  "middle part sewin": "Traditional sew-in / leave out",
  "middle part sew in": "Traditional sew-in / leave out",
  "middle part sew-in": "Traditional sew-in / leave out",
  "middle part weave": "Traditional sew-in / leave out",
  "side part sewin": "Traditional sew-in / leave out",
  "side part sew in": "Traditional sew-in / leave out",
  "side part sew-in": "Traditional sew-in / leave out",
  "side part weave": "Traditional sew-in / leave out",
  "traditional weave": "Traditional sew-in / leave out",
};

const serviceRuleMatchers = [
  ["Wig colour", [/\bwig\b.*\b(colou?r|dye|ton(e|ing)|bleach|highlight|custom colou?r)\b/, /\b(colou?r|dye|ton(e|ing)|bleach|highlight)\b.*\bwig\b/]],
  ["Frontal ponytail / bun", [/\bfrontal\b.*\b(pony|ponytail|bun)\b/, /\b(pony|ponytail|bun)\b.*\bfrontal\b/]],
  ["Half braids, half sew-in", [/\bhalf\b.*\b(braid|braids)\b.*\b(weave|sew\s*in|sewin)\b/, /\bhalf\s+braid\b/, /\bhalf\s+weave\b/]],
  ["Wig install (frontal / closure)", [/\bwig\b.*\b(install|instal|application|fit|fitting)\b/, /\b(glueless|lace)\s+wig\b/, /\bfrontal\s+wig\b/, /\bclosure\s+wig\b/]],
  ["U-Part wig install", [/\bu\s*part\b/, /\bu-part\b/]],
  ["Custom wig", [/\bcustom\b.*\bwig\b/, /\bwig\b.*\b(custom|made|making|construction|unit)\b/]],
  ["Pixie wig / weave install", [/\bpixie\b.*\b(wig|weave|install)\b/, /\b(wig|weave)\b.*\bpixie\b/]],
  ["Closure sew-in", [/\bclosure\b.*\b(sew\s*in|sewin|weave|install)\b/, /\b(sew\s*in|sewin|weave|install)\b.*\bclosure\b/]],
  ["Frontal sew-in", [/\bfrontal\b.*\b(sew\s*in|sewin|weave|install)\b/, /\b(sew\s*in|sewin|weave|install)\b.*\bfrontal\b/]],
  ["Flipover / Versatile sew-in", [/\bflip\s*over\b/, /\bflipover\b/, /\bversatile\b.*\b(sew\s*in|sewin|weave)\b/]],
  ["Quick weave", [/\bquick\b.*\bweave\b/, /\bquickweave\b/]],
  ["Hybrid sew-in", [/\bhybrid\b.*\b(sew\s*in|sewin|weave)\b/]],
  ["Sew-in take-down", [/\b(sew\s*in|sewin|weave|tracks?)\b.*\b(take\s*down|takedown|removal|remove)\b/, /\b(take\s*down|takedown|removal|remove)\b.*\b(sew\s*in|sewin|weave|tracks?)\b/]],
  ["Tracks (+ Silk press) / Partial / Invisible sew-in", [/\btracks?\b/, /\bpartial\b.*\b(sew\s*in|sewin|weave)\b/, /\binvisible\b.*\b(sew\s*in|sewin|weave)\b/]],
  ["Traditional sew-in / leave out", [/\bleave\s*out\b/, /\b(middle|side)\s+part\b.*\b(sew\s*in|sewin|weave)\b/, /\btraditional\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin)\b/]],
  ["K-tips / Invisible strands", [/\bk\s*tips?\b/, /\bk-tips?\b/, /\binvisible\s+strands?\b/, /\bkeratin\s+(tips?|bonds?|extensions?)\b/]],
  ["LA weave", [/\bla\s+weave\b/]],
  ["Tape ins", [/\btape\s*ins?\b/, /\btape-in\b/, /\btape\s+extensions?\b/]],
  ["Microlinks", [/\bmicro\s*links?\b/, /\bmicrolinks?\b/, /\bi\s*tips?\b/, /\bitips?\b/]],
  ["Clip ins (+ Silk press)", [/\bclip\s*ins?\b/, /\bclip-in\b/]],
  ["Boho braids / goddess braids", [/\bboho\b/, /\bgoddess\b/]],
  ["Knotless braids", [/\bknotless\b/]],
  ["Box braids", [/\bbox\b.*\bbraids?\b/]],
  ["Crochet", [/\bcrochet\b/]],
  ["Creative braids (e.g. patewo)", [/\bpatewo\b/, /\bcreative\b.*\bbraids?\b/]],
  ["Feed-in braids", [/\bfeed\s*in\b/, /\bfeed-in\b/, /\ball\s+back\b/]],
  ["French curl", [/\bfrench\s+curl\b/]],
  ["Fulani / Lemonade braids", [/\bfulani\b/, /\blemonade\b/]],
  ["Miracle knots", [/\bmiracle\s+knots?\b/]],
  ["Microbraids / x-small braids", [/\bmicro\s*braids?\b/, /\bmicrobraids?\b/, /\bx\s*small\b.*\bbraids?\b/, /\bxs\b.*\bbraids?\b/]],
  ["Pre-parting", [/\bpre\s*part(ing)?\b/, /\bpre-part(ing)?\b/]],
  ["Stitch braids", [/\bstitch\b/]],
  ["Twists (with extensions)", [/\btwists?\b.*\b(extension|extensions|hair added)\b/, /\bpassion\s+twists?\b/, /\bsenegalese\s+twists?\b/]],
  ["Braid take-down", [/\bbraids?\b.*\b(take\s*down|takedown|removal|remove)\b/, /\b(take\s*down|takedown|removal|remove)\b.*\bbraids?\b/]],
  ["Starter locs", [/\bstarter\s+locs?\b/, /\bloc\s+start\b/]],
  ["Retwist", [/\bretwist\b/, /\bre\s*twist\b/]],
  ["Faux locs", [/\bfaux\s+locs?\b/, /\binvisible\s+locs?\b/]],
  ["Butterfly locs", [/\bbutterfly\s+locs?\b/]],
  ["Microlocs / Sisterlocs", [/\bmicro\s*locs?\b/, /\bmicrolocs?\b/, /\bsister\s*locs?\b/, /\bsisterlocs?\b/]],
  ["Balayage", [/\bbalayage\b/]],
  ["Highlights", [/\bhigh\s*lights?\b/, /\bhighlights?\b/]],
  ["Full head colour", [/\bfull\s+head\b.*\bcolou?r\b/, /\bpermanent\s+(colou?r|tint)\b/, /\b(colou?r|dye|tint)\b/]],
  ["Bridal / Editorial", [/\bbridal\b/, /\bwedding\b/, /\beditorial\b/, /\bsession\s+styling\b/, /\bphotoshoot\b/]],
  ["Keratin treatment", [/\bkeratin\b/]],
  ["Relaxer / texturiser", [/\brelaxer\b/, /\btexturi[sz]er\b/, /\btexturi[sz]ing\b/]],
  ["Texture release", [/\btexture\s+release\b/]],
  ["Japanese straightening", [/\bjapanese\b.*\bstraight(en|ening)\b/]],
  ["Hair Botox", [/\bbotox\b/]],
  ["Olaplex treatment", [/\bolaplex\b/]],
  ["K-18 treatment", [/\bk\s*18\b/, /\bk-18\b/]],
  ["Moisturising treatment", [/\bmoisturi[sz](ing|e)\b/, /\bdeep\s+condition(ing)?\b/, /\bsteam\s+treat(ment)?\b/, /\bnatural\s+hair\s+care\b/]],
  ["Scalp care", [/\bscalp\b/]],
  ["Curly cut / Wash & go", [/\bcurly\s+cut\b/, /\bwash\s*(and|&)?\s*go\b/]],
  ["Wash & blowdry", [/\bwash\b.*\b(blow\s*dry|blowdry|blowout)\b/, /\bblow\s*out\b/, /\bblowout\b/]],
  ["Trim / Hair cut", [/\btrim\b/, /\bhair\s*cut\b/, /\bhaircut\b/, /\bcut\s+and\s+finish\b/]],
  ["Silk press", [/\bsilk\s+press\b/, /\bsilkpress\b/, /\bpress\s+and\s+curl\b/]],
  ["Twist out / Flexi rod", [/\btwist\s*out\b/, /\bflexi\s*rod\b/, /\bflexi-rod\b/, /\bperm\s+rod\b/]],
  ["Wig cornrows", [/\bunder\s*wig\b/, /\bwig\s+cornrows?\b/, /\bcornrows?\b/]],
  ["Natural hair education", [/\beducation\b/, /\bconsultation\b.*\bnatural\b/, /\bnatural\s+hair\b.*\bclass\b/]],
  ["Sleek ponytail / bun", [/\bsleek\b.*\b(pony|ponytail|bun)\b/, /\bpony\s*tail\b/, /\bponytail\b/, /\bbun\b/]],
  ["Half up half down", [/\bhalf\s+up\b.*\bhalf\s+down\b/, /\bhalf\s+up\s+half\s+down\b/]],
  ["Pixie / finger waves", [/\bfinger\s+waves?\b/, /\bpixie\b/, /\bwrap\b/]],
  ["Updo", [/\bup\s*do\b/, /\bupdo\b/, /\bpin\s*up\b/]],
];

export function registerAdminStylistRoutes(app) {
  app.post("/api/admin/login", async (req, res) => {
    const configuredPassword = getAdminPassword();
    if (!configuredPassword) {
      return res.status(503).json({ ok: false, message: "Set ADMIN_PASSWORD before using the admin tool." });
    }

    if (String(req.body?.password || "") !== configuredPassword) {
      return res.status(401).json({ ok: false, message: "That password was not accepted." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { createdAt: Date.now() });
    res.setHeader("Set-Cookie", makeCookie(token));
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", requireAdmin, async (_req, res) => {
    const token = getCookieValue(_req.headers.cookie, sessionCookieName);
    if (token) {
      sessions.delete(token);
    }
    res.setHeader("Set-Cookie", expireCookie());
    res.json({ ok: true });
  });

  app.get("/api/admin/session", requireAdmin, async (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/admin/stylists/options", requireAdmin, async (_req, res) => {
    res.json({
      ok: true,
      regions: regionOptions,
      services: canonicalServices,
      aliases: Object.keys(serviceAliases).sort((left, right) => left.localeCompare(right)),
    });
  });

  app.get("/api/admin/stylists/drafts", requireAdmin, async (_req, res) => {
    const store = await readDraftStore();
    res.json({ ok: true, drafts: store.drafts, meta: store.meta });
  });

  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    const draftStore = await readDraftStore();
    const freshnessStore = await readJson(freshnessChecksPath, { meta: { updatedAt: null, checkedCount: 0, total: 0 }, checks: [] });
    const discoveryStore = await readDiscoveryStore();
    const drafts = draftStore.drafts;
    const freshnessChecks = freshnessStore.checks || [];
    const suggestions = discoveryStore.suggestions;

    res.json({
      ok: true,
      drafts: {
        total: drafts.length,
        needsReview: drafts.filter((draft) => draft.status === "needs_review").length,
        readyToApprove: drafts.filter((draft) => draft.status === "ready_to_approve").length,
        missingLocation: drafts.filter((draft) => !draft.areaId).length,
        missingServices: drafts.filter((draft) => !draft.services?.length).length,
      },
      freshness: {
        totalIssues: freshnessChecks.length,
        checkedCount: freshnessStore.meta?.checkedCount ?? 0,
        total: freshnessStore.meta?.total ?? 0,
        brokenLinks: freshnessChecks.filter((check) => check.linkChecks?.some((link) => link.status !== "ok")).length,
        serviceChanges: freshnessChecks.filter((check) => check.addedServices?.length || check.removedServices?.length).length,
        updatedAt: freshnessStore.meta?.updatedAt ?? null,
      },
      discovery: {
        total: suggestions.length,
        highConfidence: suggestions.filter((suggestion) => suggestion.confidence === "high").length,
        needsReview: suggestions.filter((suggestion) => suggestion.status === "suggested").length,
      },
    });
  });

  app.get("/api/admin/stylists/checks", requireAdmin, async (req, res) => {
    const index = await readSalonIndex();
    const checkedAt = new Date().toISOString();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const batchSalons = index.salons.slice(offset, offset + limit);
    const checks = await mapWithConcurrency(batchSalons, 6, checkSalonFreshness);
    const reviewChecks = checks.filter(
      (check) => check.issues.length > 0 || check.addedServices.length > 0 || check.removedServices.length > 0,
    );
    const existingStore =
      offset > 0
        ? await readJson(freshnessChecksPath, { meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [] })
        : { checks: [] };
    const mergedChecks = [...(existingStore.checks || []), ...reviewChecks];

    await writeJson(freshnessChecksPath, {
      meta: {
        source: "freshness-checks",
        updatedAt: checkedAt,
        count: mergedChecks.length,
        checkedCount: Math.min(offset + batchSalons.length, index.salons.length),
        total: index.salons.length,
      },
      checks: mergedChecks,
    });

    res.json({
      ok: true,
      checks: reviewChecks,
      checkedAt,
      offset,
      limit,
      batchCount: batchSalons.length,
      checkedCount: Math.min(offset + batchSalons.length, index.salons.length),
      total: index.salons.length,
      nextOffset: offset + batchSalons.length < index.salons.length ? offset + batchSalons.length : null,
    });
  });

  app.post("/api/admin/stylists/match-services", requireAdmin, async (req, res) => {
    const rawServices = toArray(req.body?.rawServices);
    res.json({ ok: true, services: matchServices(rawServices) });
  });

  app.patch("/api/admin/stylists/:id/freshness", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Salon not found." });
    }

    const salon = manualIndex.salons[salonIndex];
    const addServices = normalizeServices(toArray(req.body?.addServices));
    const removeServices = normalizeServices(toArray(req.body?.removeServices));
    const rejectAddedServices = normalizeServices(toArray(req.body?.rejectAddedServices));
    const rejectRemovedServices = normalizeServices(toArray(req.body?.rejectRemovedServices));
    const currentServices = normalizeServices(salon.services || []);
    const nextServices = currentServices.filter((service) => !removeServices.includes(service));
    addServices.forEach((service) => {
      if (!nextServices.includes(service)) {
        nextServices.push(service);
      }
    });

    manualIndex.salons[salonIndex] = {
      ...salon,
      ...(typeof req.body?.bookingUrl === "string" ? { bookingUrl: cleanString(req.body.bookingUrl) } : {}),
      ...(typeof req.body?.instagramUrl === "string" ? { instagramUrl: cleanString(req.body.instagramUrl) } : {}),
      ...(typeof req.body?.websiteUrl === "string" ? { websiteUrl: cleanString(req.body.websiteUrl) } : {}),
      services: nextServices,
    };
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };
    if (
      addServices.length ||
      removeServices.length ||
      typeof req.body?.bookingUrl === "string" ||
      typeof req.body?.instagramUrl === "string" ||
      typeof req.body?.websiteUrl === "string"
    ) {
      await writeJson(manualIndexPath, manualIndex);
    }

    await updateFreshnessReview(req.params.id, {
      addServices,
      removeServices,
      rejectAddedServices,
      rejectRemovedServices,
    });

    res.json({ ok: true, salon: manualIndex.salons[salonIndex] });
  });

  app.post("/api/admin/stylists/intake", requireAdmin, async (req, res) => {
    const draft = buildDraft(req.body || {});
    const store = await readDraftStore();
    store.drafts.unshift(draft);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, draft });
  });

  app.post("/api/admin/stylists/intake-bulk", requireAdmin, async (req, res) => {
    const candidates = parseBulkIntake(req.body?.text);
    if (!candidates.length) {
      return res.status(400).json({ ok: false, message: "Paste at least one social, booking, or website link." });
    }

    const drafts = candidates.map((candidate) => buildDraft(candidate));
    const store = await readDraftStore();
    store.drafts.unshift(...drafts);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, drafts });
  });

  app.get("/api/admin/discovery", requireAdmin, async (_req, res) => {
    const store = await readDiscoveryStore();
    res.json({ ok: true, suggestions: store.suggestions, meta: store.meta });
  });

  app.post("/api/admin/discovery/generate", requireAdmin, async (_req, res) => {
    const suggestions = await generateDiscoverySuggestions();
    const store = await readDiscoveryStore();
    const existingKeys = new Set(store.suggestions.map((suggestion) => suggestion.id));
    const mergedSuggestions = [...suggestions.filter((suggestion) => !existingKeys.has(suggestion.id)), ...store.suggestions];
    await writeDiscoveryStore(mergedSuggestions);
    res.json({ ok: true, suggestions: mergedSuggestions });
  });

  app.post("/api/admin/discovery/:id/create-draft", requireAdmin, async (req, res) => {
    const store = await readDiscoveryStore();
    const suggestion = store.suggestions.find((item) => item.id === req.params.id);
    if (!suggestion) {
      return res.status(404).json({ ok: false, message: "Suggestion not found." });
    }

    const draft = buildDraft({
      links: suggestion.sourceUrl,
      name: suggestion.name,
      areaId: suggestion.areaId,
      rawServices: suggestion.services.join("\n"),
      services: suggestion.services,
      summary: suggestion.reason,
    });
    const draftStore = await readDraftStore();
    draftStore.drafts.unshift(draft);
    await writeDraftStore(draftStore);
    await writeDiscoveryStore(
      store.suggestions.map((item) => (item.id === suggestion.id ? { ...item, status: "draft_created", updatedAt: new Date().toISOString() } : item)),
    );
    res.status(201).json({ ok: true, draft });
  });

  app.patch("/api/admin/stylists/drafts/:id", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const draftIndex = store.drafts.findIndex((draft) => draft.id === req.params.id);
    if (draftIndex === -1) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    store.drafts[draftIndex] = normalizeDraftState({
      ...store.drafts[draftIndex],
      ...sanitizeDraftUpdate(req.body || {}),
      updatedAt: new Date().toISOString(),
    });
    await writeDraftStore(store);
    res.json({ ok: true, draft: store.drafts[draftIndex] });
  });

  app.post("/api/admin/stylists/drafts/:id/approve", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const draftIndex = store.drafts.findIndex((draft) => draft.id === req.params.id);
    if (draftIndex === -1) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    const draft = {
      ...store.drafts[draftIndex],
      ...sanitizeDraftUpdate(req.body || {}),
    };
    const validationMessage = validateApprovableDraft(draft);
    if (validationMessage) {
      return res.status(400).json({ ok: false, message: validationMessage });
    }

    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const existingIds = new Set(manualIndex.salons.map((salon) => salon.id));
    const salon = draftToSalon(draft, existingIds);
    manualIndex.salons.unshift(salon);
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };
    await writeJson(manualIndexPath, manualIndex);

    store.drafts.splice(draftIndex, 1);
    await writeDraftStore(store);
    res.json({ ok: true, salon });
  });

  app.delete("/api/admin/stylists/drafts/:id", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const nextDrafts = store.drafts.filter((draft) => draft.id !== req.params.id);
    if (nextDrafts.length === store.drafts.length) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    store.drafts = nextDrafts;
    await writeDraftStore(store);
    res.json({ ok: true });
  });
}

function requireAdmin(req, res, next) {
  const token = getCookieValue(req.headers.cookie, sessionCookieName);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ ok: false, message: "Admin login required." });
  }

  const session = sessions.get(token);
  if (Date.now() - session.createdAt > 1000 * 60 * 60 * 12) {
    sessions.delete(token);
    res.setHeader("Set-Cookie", expireCookie());
    return res.status(401).json({ ok: false, message: "Admin session expired." });
  }

  next();
}

function getAdminPassword() {
  const isHostedRuntime = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return process.env.ADMIN_PASSWORD || process.env.ROWK_ADMIN_PASSWORD || (isHostedRuntime ? "" : "rowk-admin");
}

function makeCookie(token) {
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`;
}

function expireCookie() {
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function getCookieValue(cookieHeader = "", name) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function readDraftStore() {
  const store = await readJson(draftsPath, { meta: { source: "admin-drafts" }, drafts: [] });
  return {
    meta: {
      source: "admin-drafts",
      updatedAt: store.meta?.updatedAt ?? null,
      count: Array.isArray(store.drafts) ? store.drafts.length : 0,
    },
    drafts: Array.isArray(store.drafts) ? store.drafts : [],
  };
}

async function writeDraftStore(store) {
  const payload = {
    meta: {
      source: "admin-drafts",
      updatedAt: new Date().toISOString(),
      count: store.drafts.length,
    },
    drafts: store.drafts,
  };
  await writeJson(draftsPath, payload);
}

async function readDiscoveryStore() {
  const store = await readJson(discoverySuggestionsPath, { meta: { source: "discovery-suggestions", updatedAt: null, count: 0 }, suggestions: [] });
  return {
    meta: {
      source: "discovery-suggestions",
      updatedAt: store.meta?.updatedAt ?? null,
      count: Array.isArray(store.suggestions) ? store.suggestions.length : 0,
    },
    suggestions: Array.isArray(store.suggestions) ? store.suggestions : [],
  };
}

async function writeDiscoveryStore(suggestions) {
  await writeJson(discoverySuggestionsPath, {
    meta: {
      source: "discovery-suggestions",
      updatedAt: new Date().toISOString(),
      count: suggestions.length,
    },
    suggestions,
  });
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function updateFreshnessReview(salonId, { addServices = [], removeServices = [], rejectAddedServices = [], rejectRemovedServices = [] }) {
  const store = await readJson(freshnessChecksPath, { meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [] });
  const reviewedAdds = normalizeServices([...addServices, ...rejectAddedServices]);
  const reviewedRemoves = normalizeServices([...removeServices, ...rejectRemovedServices]);
  const checks = (store.checks || [])
    .map((check) => {
      if (check.id !== salonId) {
        return check;
      }

      return {
        ...check,
        addedServices: (check.addedServices || []).filter((service) => !reviewedAdds.includes(service)),
        removedServices: (check.removedServices || []).filter((service) => !reviewedRemoves.includes(service)),
        reviewedAt: new Date().toISOString(),
      };
    })
    .filter((check) => check.issues?.length || check.addedServices?.length || check.removedServices?.length);

  await writeJson(freshnessChecksPath, {
    meta: {
      ...(store.meta || {}),
      source: "freshness-checks",
      updatedAt: new Date().toISOString(),
      count: checks.length,
    },
    checks,
  });
}

async function checkSalonFreshness(salon) {
  const linkChecks = await Promise.all([
    checkUrl("booking", salon.bookingUrl),
    checkUrl("instagram", salon.instagramUrl),
    checkUrl("website", salon.websiteUrl && salon.websiteUrl !== salon.bookingUrl ? salon.websiteUrl : ""),
  ]);
  const activeLinkChecks = linkChecks.filter(Boolean);
  const issues = activeLinkChecks.flatMap((check) => check.issues);
  const bookingCheck = activeLinkChecks.find((check) => check.type === "booking");
  const serviceCheck = bookingCheck?.status === "ok" ? await extractBookingServices(salon.bookingUrl) : emptyServiceCheck();
  const currentServices = normalizeServices(salon.services || []);
  const detectedServices = normalizeServices(serviceCheck.matchedServices);
  const addedServices = detectedServices.filter((service) => !currentServices.includes(service));
  const removedServices =
    serviceCheck.confidence === "medium" || serviceCheck.confidence === "high"
      ? currentServices.filter((service) => !detectedServices.includes(service))
      : [];

  if (addedServices.length > 0) {
    issues.push("Possible new services found");
  }
  if (removedServices.length > 0) {
    issues.push("Possible removed services found");
  }

  return {
    id: salon.id,
    name: salon.name,
    areaLabel: salon.areaLabel,
    bookingUrl: salon.bookingUrl || "",
    instagramUrl: salon.instagramUrl || "",
    websiteUrl: salon.websiteUrl || "",
    issues: [...new Set(issues)],
    linkChecks: activeLinkChecks,
    serviceCheck,
    currentServices,
    detectedServices,
    addedServices,
    removedServices,
    checkedAt: new Date().toISOString(),
  };
}

async function checkUrl(type, url) {
  if (!url) {
    return null;
  }

  const result = {
    type,
    url,
    finalUrl: url,
    status: "unknown",
    httpStatus: null,
    issues: [],
  };

  try {
    const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
    result.finalUrl = response.url || url;
    result.httpStatus = response.status;

    if (response.ok) {
      result.status = "ok";
    } else if (response.status === 404 || response.status === 410) {
      result.status = "broken";
      result.issues.push(`${linkLabel(type)} appears to be gone`);
    } else if (response.status === 401 || response.status === 403 || response.status === 429) {
      result.status = type === "instagram" ? "possibly_blocked" : "blocked";
      result.issues.push(`${linkLabel(type)} could not be verified`);
    } else {
      result.status = "broken";
      result.issues.push(`${linkLabel(type)} returned HTTP ${response.status}`);
    }

    const originalHost = safeHost(url);
    const finalHost = safeHost(result.finalUrl);
    if (originalHost && finalHost && originalHost !== finalHost && !isExpectedRedirect(originalHost, finalHost)) {
      result.issues.push(`${linkLabel(type)} redirects to ${finalHost}`);
    }
  } catch (error) {
    result.status = "broken";
    result.issues.push(`${linkLabel(type)} did not load`);
  }

  return result;
}

async function extractBookingServices(url) {
  try {
    const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
    if (!response.ok) {
      return emptyServiceCheck();
    }

    const html = await response.text();
    const rawServices = extractServiceCandidates(html);
    const matchedServices = matchServices(rawServices);
    return {
      confidence: rawServices.length >= 5 && matchedServices.length > 0 ? "medium" : matchedServices.length > 0 ? "low" : "unknown",
      rawServices: rawServices.slice(0, 80),
      matchedServices,
    };
  } catch {
    return emptyServiceCheck();
  }
}

function extractServiceCandidates(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  return [
    ...new Set(
      text
        .split(/\n|•|·|\|/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 4 && line.length <= 90)
        .filter((line) => /braid|loc|wig|weave|sew|silk|press|tape|micro|clip|colour|color|cut|trim|wash|blow|treat|keratin|relax|pony|bun|updo|bridal|curl|cornrow|closure|frontal|track/i.test(line))
        .filter((line) => !/cookie|privacy|terms|login|sign in|copyright|javascript|instagram|facebook/i.test(line)),
    ),
  ];
}

function emptyServiceCheck() {
  return {
    confidence: "unknown",
    rawServices: [],
    matchedServices: [],
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "ROW K freshness checker",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

function linkLabel(type) {
  return type === "booking" ? "Booking link" : type === "instagram" ? "Instagram" : "Website";
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isExpectedRedirect(originalHost, finalHost) {
  return originalHost === finalHost || finalHost.endsWith(`.${originalHost}`) || originalHost.endsWith(`.${finalHost}`);
}

function buildDraft(input) {
  const links = normalizeLines(input.links);
  const rawServices = normalizeLines(input.rawServices);
  const explicitServices = toArray(input.services);
  const inferred = inferFromLinks(links);
  const matchedServices = matchServices([...rawServices, ...explicitServices]);
  const now = new Date().toISOString();
  const name = cleanString(input.name) || inferNameFromUrl(links[0]) || "New stylist";

  return normalizeDraftState({
    id: makeUniqueDraftId(name),
    status: "needs_review",
    name,
    areaId: cleanString(input.areaId),
    areaLabel: areaLabelFor(input.areaId),
    neighbourhood: areaLabelFor(input.areaId),
    postcode: "",
    bookingPlatform: cleanString(input.bookingPlatform) || inferred.bookingPlatform,
    bookingUrl: cleanString(input.bookingUrl) || inferred.bookingUrl,
    websiteUrl: cleanString(input.websiteUrl) || inferred.websiteUrl,
    instagramUrl: cleanString(input.instagramUrl) || inferred.instagramUrl,
    tiktokUrl: cleanString(input.tiktokUrl) || inferred.tiktokUrl,
    services: matchedServices,
    rawServices,
    summary: cleanString(input.summary) || "Admin draft created from stylist intake.",
    confidence: matchedServices.length > 0 ? 0.72 : 0.35,
    warnings: [],
    evidence: buildEvidence(links, rawServices),
    source: "admin-draft",
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now,
  });
}

function parseBulkIntake(text = "") {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [];
  let current = null;

  for (const line of lines) {
    const urls = extractUrls(line);
    if (urls.length) {
      urls.forEach((url, index) => {
        if (index === 0 && current && !current.links.includes(url) && !current.rawServices.length) {
          current.links.push(url);
          current.name ||= inferNameFromUrl(url);
          return;
        }
        current = {
          links: [url],
          name: inferNameFromUrl(url),
          rawServices: [],
          services: [],
        };
        candidates.push(current);
      });
      continue;
    }

    if (!current) {
      continue;
    }

    if (/service|offer|does|speciali[sz]e/i.test(line) || matchServices([line]).length) {
      current.rawServices.push(line);
    } else if (!current.name || current.name === "New stylist") {
      current.name = line;
    } else {
      current.rawServices.push(line);
    }
  }

  return candidates.map((candidate) => ({
    links: candidate.links.join("\n"),
    name: candidate.name,
    rawServices: candidate.rawServices.join("\n"),
    services: matchServices(candidate.rawServices),
  }));
}

function extractUrls(value) {
  return String(value).match(/https?:\/\/[^\s)]+/g) || [];
}

async function generateDiscoverySuggestions() {
  const index = await readSalonIndex();
  const existingKeys = new Set(
    index.salons.flatMap((salon) => [salon.instagramUrl, salon.bookingUrl, salon.websiteUrl, salon.name].filter(Boolean).map(normalizeDiscoveryKey)),
  );
  const popularServices = countTopValues(index.salons.flatMap((salon) => normalizeServices(salon.services || []))).slice(0, 8);
  const popularAreas = countTopValues(index.salons.map((salon) => salon.areaId).filter(Boolean)).slice(0, 6);
  const suggestions = [];

  for (const service of popularServices) {
    for (const areaId of popularAreas.slice(0, 3)) {
      const areaLabel = areaLabelFor(areaId);
      const query = `${service} ${areaLabel || "London"} hair stylist booking`;
      const sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const id = slugify(`search-${query}`);
      if (existingKeys.has(normalizeDiscoveryKey(sourceUrl))) {
        continue;
      }
      suggestions.push({
        id,
        name: `Search lead: ${service} in ${areaLabel || areaId}`,
        status: "suggested",
        confidence: suggestions.length < 6 ? "high" : "medium",
        sourceUrl,
        areaId,
        areaLabel,
        services: [service],
        reason: `Generated from common ROW K pattern: ${service} listings in ${areaLabel || areaId}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return suggestions.slice(0, 24);
}

function countTopValues(values) {
  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([value]) => value);
}

function normalizeDiscoveryKey(value) {
  return String(value || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").trim();
}

function sanitizeDraftUpdate(input) {
  const links = normalizeLines(input.links);
  const rawServices = normalizeLines(input.rawServices);
  const services = matchServices(toArray(input.services));
  const inferred = inferFromLinks(links);

  return {
    ...(input.status ? { status: cleanString(input.status) } : {}),
    name: cleanString(input.name),
    areaId: cleanString(input.areaId),
    areaLabel: cleanString(input.areaLabel) || areaLabelFor(input.areaId),
    neighbourhood: cleanString(input.neighbourhood) || cleanString(input.areaLabel) || areaLabelFor(input.areaId),
    postcode: cleanString(input.postcode),
    bookingPlatform: cleanString(input.bookingPlatform) || inferred.bookingPlatform,
    bookingUrl: cleanString(input.bookingUrl) || inferred.bookingUrl,
    websiteUrl: cleanString(input.websiteUrl) || inferred.websiteUrl,
    instagramUrl: cleanString(input.instagramUrl) || inferred.instagramUrl,
    tiktokUrl: cleanString(input.tiktokUrl) || inferred.tiktokUrl,
    services,
    rawServices,
    summary: cleanString(input.summary),
    warnings: toArray(input.warnings),
    evidence: toArray(input.evidence),
  };
}

function validateApprovableDraft(draft) {
  if (!draft.name?.trim()) {
    return "Add a stylist or salon name before approving.";
  }
  if (!draft.areaId?.trim()) {
    return "Choose a location before approving.";
  }
  if (!draft.bookingUrl?.trim() && !draft.instagramUrl?.trim() && !draft.websiteUrl?.trim()) {
    return "Add at least one public link before approving.";
  }
  if (!Array.isArray(draft.services) || draft.services.length === 0) {
    return "Select at least one matched service before approving.";
  }
  return "";
}

function normalizeDraftState(draft) {
  const warnings = [];
  if (!draft.bookingUrl?.trim()) {
    warnings.push("No booking link identified yet.");
  }
  if (!Array.isArray(draft.services) || draft.services.length === 0) {
    warnings.push("No services matched yet.");
  }

  return {
    ...draft,
    status: warnings.length ? "needs_review" : "ready_to_approve",
    warnings,
  };
}

function draftToSalon(draft, existingIds) {
  const id = uniqueSlug(draft.name, existingIds);
  return {
    id,
    name: draft.name.trim(),
    areaId: draft.areaId,
    areaLabel: draft.areaLabel || areaLabelFor(draft.areaId),
    neighbourhood: draft.neighbourhood || draft.areaLabel || "",
    postcode: draft.postcode || "",
    bookingPlatform: draft.bookingPlatform || platformFromUrl(draft.bookingUrl) || "Direct",
    bookingUrl: draft.bookingUrl || draft.websiteUrl || draft.instagramUrl,
    websiteUrl: draft.websiteUrl || draft.bookingUrl || "",
    instagramUrl: draft.instagramUrl || "",
    services: normalizeServices(draft.services),
    summary: draft.summary || "Admin-approved stylist entry.",
    source: "manual",
    evidence: draft.evidence?.length ? draft.evidence : ["Approved through ROW K admin intake."],
  };
}

function inferFromLinks(links) {
  const result = {
    bookingPlatform: "",
    bookingUrl: "",
    websiteUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
  };

  for (const link of links) {
    const lower = link.toLowerCase();
    if (lower.includes("instagram.com")) {
      result.instagramUrl ||= link;
      continue;
    }
    if (lower.includes("tiktok.com")) {
      result.tiktokUrl ||= link;
      continue;
    }

    const platform = platformFromUrl(link);
    if (platform && !result.bookingUrl) {
      result.bookingUrl = link;
      result.bookingPlatform = platform;
      continue;
    }

    result.websiteUrl ||= link;
  }

  return result;
}

function platformFromUrl(url = "") {
  const lower = url.toLowerCase();
  return bookingPlatformMatchers.find(([needle]) => lower.includes(needle))?.[1] || "";
}

function matchServices(values) {
  const allKnown = new Set(canonicalServices);
  const knownByLowercase = new Map(canonicalServices.map((service) => [service.toLowerCase(), service]));
  const aliasesByLowercase = new Map([
    ...Object.entries(serviceAliases).map(([alias, service]) => [alias.toLowerCase(), service]),
    ...Object.entries(intakeServiceAliases),
  ]);
  const normalized = values.flatMap((value) =>
    String(value || "")
      .split(/\n|,/)
      .map((part) => part.trim())
      .filter(Boolean),
  );

  return normalizeServices(
    normalized
      .flatMap((service) => {
        const lower = service.toLowerCase();
        const exact = serviceAliases[service] ?? knownByLowercase.get(lower) ?? aliasesByLowercase.get(lower);
        if (exact && allKnown.has(exact)) {
          return [exact];
        }

        const ruleMatches = matchServicesByRule(lower);
        if (ruleMatches.length) {
          return ruleMatches;
        }

        return canonicalServices.find((candidate) => isStrongServiceMatch(lower, candidate.toLowerCase())) || [];
      })
      .filter(Boolean),
  );
}

function matchServicesByRule(input) {
  const normalized = normalizeServiceText(input);

  return serviceRuleMatchers
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))
    .map(([service]) => service);
}

function isStrongServiceMatch(input, candidate) {
  const normalizedInput = normalizeServiceText(input);
  const normalizedCandidate = normalizeServiceText(candidate);

  if (normalizedInput.length < 8) {
    return false;
  }

  return normalizedInput.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedInput);
}

function normalizeServiceText(value) {
  return value.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildEvidence(links, rawServices) {
  const evidence = links.map((link) => `Submitted link: ${link}`);
  if (rawServices.length) {
    evidence.push("Raw services provided during admin intake.");
  }
  return evidence.length ? evidence : ["Created through ROW K admin intake."];
}

function normalizeLines(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return normalizeLines(value);
}

function cleanString(value) {
  return String(value || "").trim();
}

function inferNameFromUrl(url = "") {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return titleCase(parts[0] || parsed.hostname.replace(/^www\./, "").split(".")[0]);
  } catch {
    return "";
  }
}

function areaLabelFor(areaId = "") {
  return regionOptions.find((region) => region.id === areaId)?.label || "";
}

function makeUniqueDraftId(name) {
  return `${slugify(name)}-${Date.now().toString(36)}`;
}

function uniqueSlug(name, existingIds) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function slugify(value) {
  return (
    String(value || "stylist")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "stylist"
  );
}

function titleCase(value) {
  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
