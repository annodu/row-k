import { searchSalons, setNoStoreHeaders } from "../server/salon-index.mjs";

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }

  try {
    const category = String(req.body?.category || "all");
    const subcategory = String(req.body?.subcategory || "all");
    const regions = Array.isArray(req.body?.regions)
      ? req.body.regions.map((region) => String(region)).filter(Boolean)
      : [String(req.body?.region || "all")];

    const payload = await searchSalons({ category, subcategory, regions });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Search API failed", error);
    return res.status(500).json({ ok: false, message: "Search failed." });
  }
}
