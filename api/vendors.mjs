import { searchVendors } from "../server/vendor-index.mjs";
import { setNoStoreHeaders } from "../server/salon-index.mjs";
import { enforceRateLimit } from "../server/security.mjs";

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }
  if (!enforceRateLimit(req, res, {
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "public-vendor-search",
    message: "Too many searches. Please try again shortly.",
  })) {
    return;
  }

  try {
    const productTypeGroups = Array.isArray(req.body?.productTypeGroups)
      ? req.body.productTypeGroups.map((group) => String(group)).filter(Boolean)
      : [];
    const productTypes = Array.isArray(req.body?.productTypes)
      ? req.body.productTypes.map((productType) => String(productType)).filter(Boolean)
      : [];
    const fulfilment = Array.isArray(req.body?.fulfilment)
      ? req.body.fulfilment.map((fulfilmentOption) => String(fulfilmentOption)).filter(Boolean)
      : [];
    const hairstylistOwned = req.body?.hairstylistOwned === true;

    const payload = await searchVendors({ productTypeGroups, productTypes, fulfilment, hairstylistOwned });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Vendor search API failed", error);
    return res.status(500).json({ ok: false, message: "Search failed." });
  }
}
