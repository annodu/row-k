import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "public/portfolio-photos");
const outputDir = path.join(root, "photo-pages-dist");
const outputPhotosDir = path.join(outputDir, "portfolio-photos");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputPhotosDir, { recursive: true });
await fs.cp(sourceDir, outputPhotosDir, { recursive: true });

await fs.writeFile(
  path.join(outputDir, "_headers"),
  "/portfolio-photos/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  "utf8",
);

await fs.writeFile(
  path.join(outputDir, "index.html"),
  "<!doctype html><meta charset=\"utf-8\"><title>Row K portfolio photos</title>\n",
  "utf8",
);

const files = await fs.readdir(outputPhotosDir);
console.log(`Prepared ${files.length} portfolio photos in ${path.relative(root, outputDir)}`);
