import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");
const exaIndexPath = path.resolve(__dirname, "../data/exa-salons.json");

const app = express();
const port = Number(process.env.PORT || 3001);
const categoryMap = {
  "sew-in-weave": [
    "Traditional sew-in",
    "Closure sew-in",
    "Frontal sew-in",
    "Flipover / Versatile sew-in",
    "Quick weave",
    "Hybrid sew-in",
    "Sew-in take-down",
  ],
  "wig-services": ["Wig install", "Wig colour", "Custom wig"],
  "extension-services": ["K-tips", "LA weave", "Tape-ins", "Microlinks", "Clip-ins"],
  "straightening-treatments": [
    "Keratin treatment",
    "Relaxer",
    "Texture release",
    "Japanese straightening",
    "Hair Botox",
    "Olaplex treatment",
    "K-18 treatment",
    "Moisturising treatment",
    "Scalp care",
  ],
  "braiding-services": [
    "Knotless braids",
    "Boho braids",
    "Feed-in braids",
    "Fulani braids",
    "French curl",
    "Half braids, half sew-in",
    "Twists",
    "Stitch braids",
    "Braid take-down",
  ],
  "locs-services": ["Starter locs", "Retwist", "Faux locs", "Butterfly locs"],
  "natural-hair-services": [
    "Curly cut / Wash & go",
    "Wash & blowdry",
    "Trim / Hair cut",
    "Silk press",
    "Twist out",
    "Cornrows",
  ],
  "colour-services": ["Full head colour", "Highlights", "Balayage", "Wig colour"],
  "styling-services": ["Ponytail", "Updo", "Half up half down", "Pixie cut / wrap"],
};

const serviceAliases = {
  "Flipover sew-in": "Flipover / Versatile sew-in",
  "Feed in braids": "Feed-in braids",
  "French curl braids": "French curl",
  "Braid takedown": "Braid take-down",
  "Natural hair care": "Moisturising treatment",
  "Colour": "Full head colour",
  "Permanent colour": "Full head colour",
  "Permanent tint": "Full head colour",
  "Half braid": "Half braids, half sew-in",
  "Half weave": "Half braids, half sew-in",
  "Half braid / Half weave": "Half braids, half sew-in",
  "K18 treatment": "K-18 treatment",
  "Wash & go": "Curly cut / Wash & go",
  "Wash & go / Curly cut": "Curly cut / Wash & go",
  "Curly cut": "Curly cut / Wash & go",
  "Wash & blowdry / Blowout": "Wash & blowdry",
  Blowout: "Wash & blowdry",
  "Hair cut": "Trim / Hair cut",
  "Hair cut / Trim": "Trim / Hair cut",
  Trim: "Trim / Hair cut",
  "Glueless wig": "Wig install",
  "Pixie cut": "Pixie cut / wrap",
  Wrap: "Pixie cut / wrap",
  Locs: "Starter locs",
  "Loc styling": "Starter locs",
  "Invisible locs": "Faux locs",
};

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.get("/api/health", async (_req, res) => {
  const index = await readSalonIndex();
  res.json({
    ok: true,
    configured: true,
    count: index.salons.length,
    updatedAt: index.meta.updatedAt,
  });
});

app.get("/api/index-status", async (_req, res) => {
  const index = await readSalonIndex();
  res.json({ ok: true, meta: index.meta });
});

app.post("/api/search", async (req, res) => {
  const category = String(req.body?.category || "all");
  const subcategory = String(req.body?.subcategory || "all");
  const regions = Array.isArray(req.body?.regions)
    ? req.body.regions.map((region) => String(region)).filter(Boolean)
    : [String(req.body?.region || "all")];
  const index = await readSalonIndex();

  const results = index.salons.filter(
    (salon) => matchesRegion(salon, regions) && matchesServiceSelection(salon, category, subcategory),
  ).map((salon) => ({
    ...salon,
    services: normalizeServices(salon.services),
  }));

  return res.json({
    ok: true,
    total: results.length,
    results: results.sort(compareSalons),
    indexMeta: index.meta,
  });
});

const server = http.createServer(app);

server.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    console.log(`ROW K API already running on http://localhost:${port}`);
    return;
  }

  throw error;
});

server.listen(port, () => {
  console.log(`ROW K API listening on http://localhost:${port}`);
});

await new Promise(() => {});

async function readSalonIndex() {
  const [manualIndex, exaIndex] = await Promise.all([
    readIndexFile(manualIndexPath, "manual"),
    readIndexFile(exaIndexPath, "exa-webset"),
  ]);

  const mergedSalons = dedupeSalons([...manualIndex.salons, ...exaIndex.salons]);

  return {
    meta: {
      source: "hybrid",
      updatedAt: maxDate(manualIndex.meta.updatedAt, exaIndex.meta.updatedAt),
      count: mergedSalons.length,
      sources: {
        manual: manualIndex.salons.length,
        exa: exaIndex.salons.length,
      },
    },
    salons: mergedSalons,
  };
}

function matchesRegion(salon, regions) {
  const areaIds = Array.isArray(salon.areaIds) ? salon.areaIds : salon.areaId ? [salon.areaId] : [];
  const londonAreas = new Set(["all-london", "central", "north", "east", "south-east", "south-west", "west", "croydon"]);
  const selectedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];

  if (selectedRegions.includes("all")) {
    return areaIds.length > 0;
  }

  return selectedRegions.some((region) => {
    if (region === "london") {
      return areaIds.some((areaId) => londonAreas.has(areaId));
    }

    return areaIds.includes(region);
  });
}

function matchesServiceSelection(salon, category, subcategory) {
  const services = normalizeServices(salon.services);

  if (subcategory !== "all") {
    return services.includes(subcategory);
  }

  if (category === "all") {
    return true;
  }

  const categoryServices = categoryMap[category] ?? [];
  return categoryServices.some((service) => services.includes(service));
}

function compareSalons(left, right) {
  return left.name.localeCompare(right.name);
}

async function readIndexFile(filePath, source) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      meta: { source, updatedAt: null, count: 0 },
      salons: [],
    };
  }
}

function dedupeSalons(salons) {
  const seen = new Map();

  for (const salon of salons) {
    const key = salon.bookingUrl || salon.id;
    if (!key) {
      continue;
    }

    if (!seen.has(key) || seen.get(key).source !== "manual") {
      seen.set(key, salon);
    }
  }

  return [...seen.values()];
}

function maxDate(left, right) {
  if (!left) return right ?? null;
  if (!right) return left ?? null;
  return new Date(left) > new Date(right) ? left : right;
}

function normalizeServices(services = []) {
  return [...new Set(services.map((service) => serviceAliases[service] ?? service))];
}
