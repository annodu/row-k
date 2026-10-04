import { toPng } from "html-to-image";
import bowlbyOneUrl from "../fonts/bowlby-one-regular.woff2?url";
import figtreeUrl from "../fonts/figtree-variable.woff2?url";
import junicodeItalicUrl from "../fonts/junicode-italic.otf?url";
import junicodeRegularUrl from "../fonts/junicode-regular.otf?url";

// Only the slide fonts are embedded — letting html-to-image scan every
// stylesheet would also try (and fail) to inline the cross-origin Google
// Fonts CSS the admin chrome uses.
const SLIDE_FONTS = [
  { family: "Bowlby One", url: bowlbyOneUrl, format: "woff2", style: "normal", weight: "400" },
  { family: "Figtree Slide", url: figtreeUrl, format: "woff2", style: "normal", weight: "400 800" },
  { family: "Junicode", url: junicodeRegularUrl, format: "opentype", style: "normal", weight: "400" },
  { family: "Junicode", url: junicodeItalicUrl, format: "opentype", style: "italic", weight: "400" },
];

let fontEmbedCssPromise: Promise<string> | null = null;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function getFontEmbedCss() {
  fontEmbedCssPromise ??= Promise.all(
    SLIDE_FONTS.map(async (font) => {
      const dataUrl = await fetch(font.url).then((response) => response.blob()).then(blobToDataUrl);
      return `@font-face { font-family: "${font.family}"; font-style: ${font.style}; font-weight: ${font.weight}; src: url(${dataUrl}) format("${font.format}"); }`;
    }),
  )
    .then((rules) => rules.join("\n"))
    .catch((error) => {
      fontEmbedCssPromise = null;
      throw error;
    });
  return fontEmbedCssPromise;
}

export async function renderSlidePng(node: HTMLElement, width: number, height: number) {
  await document.fonts?.ready;
  const fontEmbedCSS = await getFontEmbedCss();
  // cacheBust: portfolio photos are served `immutable`, so a copy cached
  // before CORS headers were added would otherwise taint the canvas.
  return toPng(node, { width, height, pixelRatio: 1, cacheBust: true, fontEmbedCSS });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
