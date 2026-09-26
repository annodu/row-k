import path from "node:path";
import fs from "node:fs/promises";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
