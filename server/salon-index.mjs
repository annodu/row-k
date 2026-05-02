import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");

const categoryMap = {
  "sew-in-weave": [
    "Traditional sew-in / leave out",
    "Closure sew-in",
    "Frontal sew-in",
    "Flipover / Versatile sew-in",
    "Quick weave",
    "Hybrid sew-in",
    "Pixie wig / weave install",
    "Sew-in take-down",
    "Tracks (per row)",
  ],
  "wig-services": ["Wig install (frontal / closure)", "Wig colour", "Custom wig", "U-Part wig install", "Pixie wig / weave install"],
  "extension-services": ["K-tips / Invisible strands", "LA weave", "Tape-ins", "Microlinks", "Clip-ins"],
  "bridal-session-services": ["Bridal / Editorial"],
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
    "Boho braids / goddess braids",
    "Box braids",
    "Crochet",
    "Creative braids (e.g. patewo)",
    "Feed-in braids",
    "Fulani / Lemonade braids",
    "French curl",
    "Half braids, half sew-in",
    "Miracle knots",
    "Twists (with extensions)",
    "Microbraids",
    "Pre-parting",
    "Stitch braids",
    "Braid take-down",
  ],
  "locs-services": ["Starter locs", "Retwist", "Faux locs", "Butterfly locs", "Microlocs / Sisterlocs"],
  "natural-hair-services": [
    "Curly cut / Wash & go",
    "Wash & blowdry",
    "Trim / Hair cut",
    "Silk press",
    "Twist out / Flexi rod",
    "Cornrows / Twists",
    "Natural hair education",
  ],
  "colour-services": ["Full head colour", "Highlights", "Balayage", "Wig colour"],
  "styling-services": ["Ponytail / bun", "Updo", "Half up half down", "Pixie / finger waves"],
};

const serviceAliases = {
  "Flipover sew-in": "Flipover / Versatile sew-in",
  "Boho braids / microbraids": "Boho braids / goddess braids",
  "Goddess braids": "Boho braids / goddess braids",
  "Feed in braids": "Feed-in braids",
  "Feed in / All back braids": "Feed-in braids",
  "French curl braids": "French curl",
  "Creative braids": "Creative braids (e.g. patewo)",
  Patewo: "Creative braids (e.g. patewo)",
  "Fulani braids": "Fulani / Lemonade braids",
  Fulani: "Fulani / Lemonade braids",
  "Lemonade braids": "Fulani / Lemonade braids",
  "Miracle knot": "Miracle knots",
  Ponytail: "Ponytail / bun",
  Bun: "Ponytail / bun",
  "Crochet braids": "Crochet",
  "Natural hair education": "Natural hair education",
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
  "Wig install": "Wig install (frontal / closure)",
  "Glueless wig": "Wig install (frontal / closure)",
  "U Part Wig": "U-Part wig install",
  "U-Part Wig": "U-Part wig install",
  "U-Part wig": "U-Part wig install",
  "U-part wig": "U-Part wig install",
  "Pixie wig install": "Pixie wig / weave install",
  "Pixie weave install": "Pixie wig / weave install",
  "Pixie cut": "Pixie / finger waves",
  "Pixie cut / wrap": "Pixie / finger waves",
  Wrap: "Pixie / finger waves",
  "Finger waves": "Pixie / finger waves",
  Bridal: "Bridal / Editorial",
  "Bridal hair": "Bridal / Editorial",
  "Bridal styling": "Bridal / Editorial",
  "Editorial styling": "Bridal / Editorial",
  Editorial: "Bridal / Editorial",
  "Session styling": "Bridal / Editorial",
  Locs: "Starter locs",
  "Loc styling": "Starter locs",
  "Invisible locs": "Faux locs",
  "Micro locs": "Microlocs / Sisterlocs",
  Microlocs: "Microlocs / Sisterlocs",
  Sisterlocs: "Microlocs / Sisterlocs",
};

export async function readSalonIndex() {
  const manualIndex = await readIndexFile(manualIndexPath, "manual");
  const normalizedSalons = manualIndex.salons
    .map((salon) => ({
      ...salon,
      services: normalizeServices(salon.services),
    }))
    .sort(compareSalons);

  return {
    meta: {
      source: "manual",
      updatedAt: manualIndex.meta.updatedAt ?? null,
      count: normalizedSalons.length,
    },
    salons: normalizedSalons,
  };
}

export async function searchSalons({
  categories = [],
  subcategories = [],
  regions = ["all"],
  hijabiFriendly = false,
  canBraidWithoutGel = false,
} = {}) {
  const index = await readSalonIndex();
  const normalizedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];
  const normalizedCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const normalizedSubcategories = Array.isArray(subcategories)
    ? subcategories.filter(Boolean).map((subcategory) => serviceAliases[subcategory] ?? subcategory)
    : [];

  const results = index.salons
    .filter(
      (salon) =>
        matchesRegion(salon, normalizedRegions) &&
        matchesServiceSelection(salon, normalizedCategories, normalizedSubcategories) &&
        matchesHijabiFriendly(salon, hijabiFriendly) &&
        matchesCanBraidWithoutGel(salon, canBraidWithoutGel),
    )
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
  const londonAreas = new Set(["all-london", "central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"]);
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

function matchesServiceSelection(salon, categories, subcategories) {
  const services = normalizeServices(salon.services);

  if ((!categories || categories.length === 0) && (!subcategories || subcategories.length === 0)) {
    return true;
  }

  const matchesCategories = (categories ?? []).every((category) => {
    const categoryServices = categoryMap[category] ?? [];
    return categoryServices.some((service) => services.includes(service));
  });

  if (!matchesCategories) {
    return false;
  }

  return (subcategories ?? []).every((subcategory) => services.includes(subcategory));
}

function matchesHijabiFriendly(salon, hijabiFriendly) {
  if (!hijabiFriendly) {
    return true;
  }

  return salon.hijabiFriendly === true;
}

function matchesCanBraidWithoutGel(salon, canBraidWithoutGel) {
  if (!canBraidWithoutGel) {
    return true;
  }

  return salon.canBraidWithoutGel === true;
}

function compareSalons(left, right) {
  const leftStartsWithDigit = /^\d/.test(left.name);
  const rightStartsWithDigit = /^\d/.test(right.name);

  if (leftStartsWithDigit !== rightStartsWithDigit) {
    return leftStartsWithDigit ? 1 : -1;
  }

  return left.name.localeCompare(right.name);
}

function normalizeServices(services = []) {
  return [...new Set(services.map((service) => serviceAliases[service] ?? service))];
}
