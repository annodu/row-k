import http from "node:http";
import express from "express";
import { readSalonIndex, searchSalons, setNoStoreHeaders } from "./salon-index.mjs";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  setNoStoreHeaders(res);
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

  return res.json(await searchSalons({ categories, subcategories, regions }));
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
