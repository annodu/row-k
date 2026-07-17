import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setNoStoreHeaders } from "../server/salon-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(_req, res) {
  setNoStoreHeaders(res);

  try {
    const filtersPath = path.resolve(__dirname, "../data/filters.json");
    const locationsPath = path.resolve(__dirname, "../data/locations.json");
    const additionalNeedsPath = path.resolve(__dirname, "../data/additional-needs.json");
    const customFilterTypesPath = path.resolve(__dirname, "../data/custom-filter-types.json");
    const priceBandsPath = path.resolve(__dirname, "../data/price-bands.json");
    const [filtersRaw, locationsRaw, additionalNeedsRaw, customFilterTypesRaw, priceBandsRaw] = await Promise.all([
      fs.promises.readFile(filtersPath, "utf8").catch(() => null),
      fs.promises.readFile(locationsPath, "utf8").catch(() => null),
      fs.promises.readFile(additionalNeedsPath, "utf8").catch(() => null),
      fs.promises.readFile(customFilterTypesPath, "utf8").catch(() => null),
      fs.promises.readFile(priceBandsPath, "utf8").catch(() => null),
    ]);
    return res.status(200).json({
      ok: true,
      categories: filtersRaw ? JSON.parse(filtersRaw).categories : null,
      locations: locationsRaw ? JSON.parse(locationsRaw) : null,
      additionalNeeds: additionalNeedsRaw ? JSON.parse(additionalNeedsRaw).options : null,
      customFilterTypes: customFilterTypesRaw ? JSON.parse(customFilterTypesRaw).filterTypes : null,
      priceBands: priceBandsRaw ? JSON.parse(priceBandsRaw).bands : null,
    });
  } catch (error) {
    console.error("Filters API failed", error);
    return res.status(500).json({ ok: false, message: "Failed to load filters." });
  }
}
