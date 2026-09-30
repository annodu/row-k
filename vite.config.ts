import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const publicAssetContentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function serveRowKPublicAssets() {
  return {
    name: "serve-rowk-public-assets",
    apply: "serve" as const,
    configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; statusCode: number; end: () => void }, next: () => void) => void) => void } }) {
      const publicDir = path.resolve(__dirname, "public");

      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
        if (pathname !== "/icon.svg" && !pathname.startsWith("/portfolio-photos/")) {
          next();
          return;
        }

        const assetPath = path.resolve(publicDir, pathname.slice(1));
        if (!assetPath.startsWith(`${publicDir}${path.sep}`) || !fsSync.existsSync(assetPath) || !fsSync.statSync(assetPath).isFile()) {
          next();
          return;
        }

        const contentType = publicAssetContentTypes[path.extname(assetPath).toLowerCase()];
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        res.setHeader("Cache-Control", "no-cache");
        fsSync.createReadStream(assetPath).pipe(res);
      });
    },
  };
}

function copyRowKPublicAssets() {
  let outputDir = "dist";
  return {
    name: "copy-rowk-public-assets",
    apply: "build" as const,
    configResolved(config: { build: { outDir: string } }) {
      outputDir = config.build.outDir;
    },
    async closeBundle() {
      const resolvedOutputDir = path.resolve(__dirname, outputDir);
      await fs.mkdir(resolvedOutputDir, { recursive: true });
      await fs.copyFile(path.resolve(__dirname, "public/icon.svg"), path.join(resolvedOutputDir, "icon.svg"));
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [
    serveRowKPublicAssets(),
    react(),
    tailwindcss(),
    copyRowKPublicAssets(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/data/*.json"],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
