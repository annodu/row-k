import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {}

  try {
    process.loadEnvFile(".env");
  } catch {}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, "../data/exa-salons.json");

const exaApiKey = process.env.EXA_API_KEY;
const existingWebsetId = process.env.EXA_WEBSET_ID;

if (!exaApiKey) {
  throw new Error("EXA_API_KEY is missing. Add it to .env.local before running the Exa sync.");
}

const websetId = existingWebsetId || (await createWebset());
const items = await waitForItems(websetId);
const salons = items.map(transformItem).filter(Boolean);

await fs.writeFile(
  outputPath,
  JSON.stringify(
    {
      meta: {
        source: "exa-webset",
        updatedAt: new Date().toISOString(),
        count: salons.length,
        websetId,
      },
      salons,
    },
    null,
    2,
  ),
);

console.log(`Saved ${salons.length} salons to ${outputPath}`);
console.log(`Webset ID: ${websetId}`);

async function createWebset() {
  const response = await fetch("https://api.exa.ai/websets/v0/websets", {
    method: "POST",
    headers: {
      "x-api-key": exaApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "K ROW London Afrohair Index",
      search: {
        query:
          "Find London afro, textured hair, and black hair salons or hairstylists with bookable pages on platforms like Setmore, Phorest, Acuity, as.me, Zenoti, S-IQ, or custom salon websites.",
        count: 100,
        criteria: [
          {
            description:
              "Business is based in London, Croydon, Kent, or Essex and clearly serves London-area clients.",
          },
          {
            description:
              "Business visibly offers afro hair, textured hair, black hair, natural hair, silk press, braids, cornrows, locs, wig installs, or smoothing services for textured hair.",
          },
          {
            description:
              "Exclude businesses that are primarily nails, lashes, brows, waxing, facials, massage, aesthetics, or general beauty bars.",
          },
        ],
      },
      enrichments: [
        {
          key: "booking_platform",
          description: "Booking platform or site, such as Setmore, Phorest, Acuity, as.me, Zenoti, S-IQ, or direct website.",
        },
        {
          key: "booking_url",
          description: "Best direct booking URL for the salon or stylist.",
        },
        {
          key: "instagram_url",
          description: "Public Instagram profile URL for the salon or stylist, if present.",
        },
        {
          key: "area_label",
          description: "Best matching K ROW area label: Central, East, North, South East, Croydon, South West, West, Kent, or Essex.",
        },
        {
          key: "neighbourhood",
          description: "Neighbourhood or area name, such as Peckham, Brixton, Plumstead, Clapham, or Hackney.",
        },
        {
          key: "postcode",
          description: "The outward postcode, such as SE18 or SW4, if visible.",
        },
        {
          key: "services",
          description:
            "Comma-separated list using K ROW service labels when supported: Knotless braids, Boho braids, Silk press, Keratin treatment, Closure sew-in, Traditional sew-in, Frontal sew-in, Flipover sew-in, Locs, Cornrows, Crochet braids, Twists, Faux locs, Wig install, Colour, Stitch braids, Butterfly locs, Natural hair care.",
        },
        {
          key: "summary",
          description: "Short one-paragraph summary of why this salon qualifies for K ROW.",
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create Exa webset: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.id || payload.websetId;
}

async function waitForItems(websetId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const items = await fetchItems(websetId);
    if (items.length > 0) {
      return items;
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error("Timed out waiting for Exa webset items.");
}

async function fetchItems(websetId) {
  const response = await fetch(`https://api.exa.ai/websets/v0/websets/${websetId}/items`, {
    headers: {
      "x-api-key": exaApiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch Exa webset items: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

function transformItem(item) {
  const enrichments = item.enrichments || {};
  const services = parseServices(enrichments.services);
  const bookingUrl = enrichments.booking_url || item.url || "";
  const areaLabel = normalizeAreaLabel(enrichments.area_label);

  if (!bookingUrl || !areaLabel) {
    return null;
  }

  return {
    id: slugify(item.title || bookingUrl),
    name: item.title || "Untitled salon",
    areaId: slugify(areaLabel),
    areaLabel,
    neighbourhood: enrichments.neighbourhood || "",
    postcode: enrichments.postcode || "",
    bookingPlatform: enrichments.booking_platform || inferPlatform(bookingUrl),
    bookingUrl,
    websiteUrl: item.url || bookingUrl,
    instagramUrl: enrichments.instagram_url || "",
    services,
    summary: enrichments.summary || item.snippet || "Imported from Exa Websets.",
    source: "exa-webset",
    evidence: [item.url || bookingUrl],
  };
}

function parseServices(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeAreaLabel(value) {
  const labels = new Set(["Central", "East", "North", "South East", "Croydon", "South West", "West", "Kent", "Essex"]);
  return labels.has(value) ? value : "";
}

function inferPlatform(url) {
  const lowered = String(url).toLowerCase();
  if (lowered.includes("setmore")) return "Setmore";
  if (lowered.includes("phorest")) return "Phorest";
  if (lowered.includes("acuityscheduling")) return "Acuity";
  if (lowered.includes("as.me")) return ".as.me";
  if (lowered.includes("zenoti")) return "Zenoti";
  if (lowered.includes("s-iq")) return "S-IQ";
  return "Direct website";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
