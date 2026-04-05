import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");
const exaIndexPath = path.resolve(__dirname, "../data/exa-salons.json");

const categoryMap = {
  "sew-in-weave": [
    "Traditional sew-in",
    "Closure sew-in",
    "Frontal sew-in",
    "Flipover / Versatile sew-in",
    "Quick weave",
    "Hybrid sew-in",
    "Sew-in take-down",
    "Tracks sewn in",
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
  Colour: "Full head colour",
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

export async function readSalonIndex() {
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

export async function searchSalons({ category = "all", subcategory = "all", regions = ["all"] } = {}) {
  const index = await readSalonIndex();
  const normalizedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];

  const results = index.salons
    .filter(
      (salon) =>
        matchesRegion(salon, normalizedRegions) && matchesServiceSelection(salon, category, subcategory),
    )
    .map((salon) => ({
      ...salon,
      services: normalizeServices(salon.services),
    }))
    .sort(compareSalons);

  return {
    ok: true,
    total: results.length,
    results,
    indexMeta: index.meta,
  };
}

export function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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
