import { readSalonIndex, setNoStoreHeaders } from "../server/salon-index.mjs";

export default async function handler(_req, res) {
  setNoStoreHeaders(res);

  try {
    const index = await readSalonIndex();
    return res.status(200).json({
      ok: true,
      configured: true,
      count: index.salons.length,
      updatedAt: index.meta.updatedAt,
    });
  } catch (error) {
    console.error("Health API failed", error);
    return res.status(500).json({ ok: false, message: "Health check failed." });
  }
}
