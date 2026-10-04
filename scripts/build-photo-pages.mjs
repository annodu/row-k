import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "public/portfolio-photos");
const outputDir = path.join(root, "photo-pages-dist");
const outputPhotosDir = path.join(outputDir, "portfolio-photos");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputPhotosDir, { recursive: true });
// Cards show photos at most ~430 CSS px wide (full-width on phones), so 800px covers
// 2x screens. Originals run up to 1600x2844 / several MB, which is what made photos
// slow to appear. Filenames and formats stay the same so stored URLs keep working.
const MAX_WIDTH = 800;
const encoders = {
  ".jpg": (image) => image.jpeg({ quality: 78, mozjpeg: true }),
  ".jpeg": (image) => image.jpeg({ quality: 78, mozjpeg: true }),
  ".png": (image) => image.png({ compressionLevel: 9 }),
  ".webp": (image) => image.webp({ quality: 75 }),
};

let originalBytes = 0;
let outputBytes = 0;
let keptOriginals = 0;

async function optimizePhoto(name) {
  const source = path.join(sourceDir, name);
  const target = path.join(outputPhotosDir, name);
  const original = await fs.readFile(source);
  const encode = encoders[path.extname(name).toLowerCase()];
  let output = original;
  if (encode) {
    try {
      const resized = await encode(
        sharp(original).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }),
      ).toBuffer();
      // Re-encoding an already-small file can make it bigger; keep whichever is smaller.
      if (resized.length < original.length) output = resized;
    } catch (error) {
      console.warn(`Could not optimize ${name}, copying original: ${error.message}`);
    }
  }
  if (output === original) keptOriginals += 1;
  originalBytes += original.length;
  outputBytes += output.length;
  await fs.writeFile(target, output);
}

const sourceFiles = (await fs.readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
  .map((entry) => entry.name);
const queue = [...sourceFiles];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) await optimizePhoto(queue.shift());
  }),
);

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
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
console.log(
  `Prepared ${files.length} portfolio photos in ${path.relative(root, outputDir)} ` +
    `(${mb(originalBytes)} MB -> ${mb(outputBytes)} MB, ${keptOriginals} kept as-is)`,
);
