import { searchSalons, setNoStoreHeaders } from "../server/salon-index.mjs";

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }

  try {
    const categories = Array.isArray(req.body?.categories)
      ? req.body.categories.map((category) => String(category)).filter(Boolean)
      : req.body?.category && req.body.category !== "all"
        ? [String(req.body.category)]
        : [];
    const subcategories = Array.isArray(req.body?.subcategories)
      ? req.body.subcategories.map((subcategory) => String(subcategory)).filter(Boolean)
      : req.body?.subcategory && req.body.subcategory !== "all"
        ? [String(req.body.subcategory)]
        : [];
    const regions = Array.isArray(req.body?.regions)
      ? req.body.regions.map((region) => String(region)).filter(Boolean)
      : [String(req.body?.region || "all")];

    const payload = await searchSalons({ categories, subcategories, regions });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Search API failed", error);
    return res.status(500).json({ ok: false, message: "Search failed." });
  }
}
