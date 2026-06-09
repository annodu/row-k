import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { readSalonIndex, searchSalons, setNoStoreHeaders } from "./salon-index.mjs";
import { registerAdminStylistRoutes } from "./admin-stylists.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadLocalEnv(path.resolve(__dirname, "../.env"));

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

registerAdminStylistRoutes(app);

app.get("/api/filters", async (_req, res) => {
  try {
    const filtersPath = path.resolve(__dirname, "../data/filters.json");
    const locationsPath = path.resolve(__dirname, "../data/locations.json");
    const additionalNeedsPath = path.resolve(__dirname, "../data/additional-needs.json");
    const [filtersRaw, locationsRaw, additionalNeedsRaw] = await Promise.all([
      fs.promises.readFile(filtersPath, "utf8").catch(() => null),
      fs.promises.readFile(locationsPath, "utf8").catch(() => null),
      fs.promises.readFile(additionalNeedsPath, "utf8").catch(() => null),
    ]);
    res.json({
      ok: true,
      categories: filtersRaw ? JSON.parse(filtersRaw).categories : null,
      locations: locationsRaw ? JSON.parse(locationsRaw) : null,
      additionalNeeds: additionalNeedsRaw ? JSON.parse(additionalNeedsRaw).options : null,
    });
  } catch {
    res.status(500).json({ ok: false });
  }
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
  const hijabiFriendly = req.body?.hijabiFriendly === true;
  const canBraidWithoutGel = req.body?.canBraidWithoutGel === true;
  const wheelchairAccessible = req.body?.wheelchairAccessible === true;

  return res.json(await searchSalons({ categories, subcategories, regions, hijabiFriendly, canBraidWithoutGel, wheelchairAccessible }));
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
  console.log(`AI pricing fallback ${process.env.OPENAI_API_KEY || process.env.ROWK_OPENAI_API_KEY ? "enabled" : "disabled"}`);
});

await new Promise(() => {});

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) {
      return;
    }
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}
