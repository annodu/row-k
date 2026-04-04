import { readSalonIndex, setNoStoreHeaders } from "../server/salon-index.mjs";

export default async function handler(_req, res) {
  setNoStoreHeaders(res);

  try {
    const index = await readSalonIndex();
    return res.status(200).json({ ok: true, meta: index.meta });
  } catch (error) {
    console.error("Index status API failed", error);
    return res.status(500).json({ ok: false, message: "Index status failed." });
  }
}
