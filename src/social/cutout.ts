// In-browser background removal for cover portraits (@imgly/background-removal).
// Loaded on demand: the library and its model (~40 MB, fetched from IMG.LY's
// CDN on first use, then browser-cached) only download when the admin clicks
// "Remove background". AGPL-licensed — admin-only, never in the public bundle.

const MAX_CUTOUT_HEIGHT = 1600;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// WebP keeps the alpha channel at a fraction of PNG's size, which matters
// because the cut-out lives in the studio's session storage until phase 3.
async function compactCutout(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_CUTOUT_HEIGHT / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.9);
}

export async function removeImageBackground(src: string, onProgress?: (label: string) => void) {
  onProgress?.("Loading the cut-out model…");
  const [{ removeBackground }, source] = await Promise.all([
    import("@imgly/background-removal"),
    fetch(src).then((response) => {
      if (!response.ok) throw new Error("Couldn't load that photo.");
      return response.blob();
    }),
  ]);
  const result = await removeBackground(source, {
    output: { format: "image/png" },
    progress: (key, current, total) => {
      if (key.startsWith("fetch") && total > 0) onProgress?.(`Downloading model… ${Math.round((current / total) * 100)}%`);
      else if (key.startsWith("compute")) onProgress?.("Cutting out…");
    },
  });
  onProgress?.("Finishing…");
  return compactCutout(result);
}

export function fileToDataUrl(file: File) {
  return blobToDataUrl(file);
}
