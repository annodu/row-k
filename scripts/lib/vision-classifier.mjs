import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");

export async function loadOpenAiApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // no .env file; rely on already-exported env vars
  }
  return process.env.OPENAI_API_KEY || "";
}

const CLASSIFY_PROMPT = `You are reviewing a single photo pulled from a hair salon or stylist's booking page, website, or Google Business listing, for use in a directory app that specifically lists afro/Black hair stylists — braids, locs, sew-ins/weaves, wig installs, natural hair, and relaxed hair. Some listed salons serve a broader "unisex" or mixed clientele, so photos can come from any customer, not just ones relevant to this directory's focus.

Classify this photo into exactly one category:
- "hairstyle" — the main subject is afro/textured hairstyling work on a real person: braids, locs, twists, cornrows, a wig install, a sew-in/weave, a silk press or other natural/relaxed hair styling — whether or not a face is visible.
- "unrelated_hairstyle" — a clear, well-lit haircut or hairstyle photo, but it is NOT afro/textured hair styling (e.g. a short back-and-sides fade or a cut on straight European hair) — not relevant to this directory even though the photo itself is fine.
- "person_in_salon" — shows a person/client being served in the salon, but the hair itself isn't the clear visual focus.
- "product" — loose hair bundles, wefts, extensions, or wigs shown on a mannequin stand, a flat lay, or clearly in an e-commerce/catalog context (visible price, "shop"/"add to cart", multiple identical-angle listing shots) — i.e. the hair is being sold, not shown as a completed look on a person.

Note: some stylists do editorial, session, or red-carpet work, and their real portfolio may be professionally shot (studio lighting, press events, magazine-style photography) rather than a casual salon snapshot — that polish alone is NOT a reason to exclude a photo or call it "product". Judge "hairstyle" vs "product" by context (is this hair being sold, or a completed look on a real person/model?), not by how professional the photography looks. A striking, high-production editorial hairstyle photo should still be classified as "hairstyle" if the styling is genuinely the subject.
- "interior" — the salon's interior: waiting area, styling stations, reception, decor — with no hairstyle in focus.
- "exterior" — the storefront, shop signage, street view, or building exterior.
- "other" — anything else: price lists, logos, screenshots, unrelated images.

Also rate the photo's clarity/quality as a stylist portfolio image: is it sharp (not blurry), well-lit, and clearly showing the hair detail?

Respond with ONLY a JSON object — no markdown code fences, no extra commentary:

{
  "category": "hairstyle" | "unrelated_hairstyle" | "person_in_salon" | "product" | "interior" | "exterior" | "other",
  "show_in_directory": true | false,
  "quality": 0-10,
  "reason": "one short phrase",
  "collage_panels": []
}

Rules for "show_in_directory":
- true only for "hairstyle" (clear, well-lit, quality >= 6) — AND the photo itself must fill all or nearly all of the frame.
- false for every other category, including "unrelated_hairstyle", and false for any blurry/dark/low-quality "hairstyle" photo (quality < 6).

Important — this image will be shown center-cropped in a small carousel tile, with no ability to pick which part of it to display. Some images (especially booking-page banners) are actually a single tall composited graphic stacking several distinct sections: a hero photo, then separate blocks of welcome text, hours, contact info, policies, etc. If the photo is only ONE section of a much larger multi-section composite — even if that section clearly shows a hairstyle — set "show_in_directory": false and "category": "other", because a center-crop of the whole image would very likely land on a text section instead of the photo. A small overlaid caption or logo directly ON TOP of a full-bleed photo is fine and should still be classified as "hairstyle"; the deciding question is whether the photo occupies the overwhelming majority of the image's total area, not just whether a photo is present somewhere in it.

Collage panels: some images are a composite that still contains one or more genuine, undistorted photos as sub-regions — e.g. a clean grid or side-by-side row of multiple separate photos each framed like its own Instagram post (visible borders/gaps between them, often with a caption or "tag us" banner below or between them), OR a single hero photo boxed in by a branding title bar above and/or a caption band below (e.g. a business-name header and a congratulatory caption sandwiching one real photo in the middle). In either case, set "category" and "show_in_directory" for the image AS A WHOLE the normal way (almost always false/other, since the whole graphic isn't itself a single clean photo), but ALSO fill "collage_panels" with one entry per distinct real photo sub-region you can see, each as fractional coordinates (0 to 1) relative to the full image's width/height: {"x": left edge, "y": top edge, "width": panel width, "height": panel height} — tight around just the photo itself, excluding any title text, caption text, decorative border blocks, or padding around it. Do not invent a panel for an image that is already just one single full-bleed photo with nothing to crop out. Omit or leave empty otherwise. Cap it at 4 panels.`;

function detectMimeType(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  return "image/jpeg";
}

export async function classifyPhoto(buffer, { apiKey, ocrText, referenceExamples } = {}) {
  const key = apiKey || (await loadOpenAiApiKey());
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set in .env or the environment.");
  }

  const base64 = buffer.toString("base64");
  const mimeType = detectMimeType(buffer);
  const promptText = ocrText
    ? `${CLASSIFY_PROMPT}\n\nOCR detected the following text on this image (may be empty, partial, or irrelevant — judge from the image itself first):\n"""${ocrText.slice(0, 1000)}"""`
    : CLASSIFY_PROMPT;

  // Human-confirmed corrections (an admin approved these after the model
  // rejected them) — shown as concrete precedent so the same kind of mistake
  // is less likely to repeat, rather than only being fixed one photo at a time.
  const referenceContent = (referenceExamples || []).flatMap((example) => [
    {
      type: "text",
      text: `Reference example: a human reviewer manually approved this photo for the directory even though an earlier automated pass rejected it as "${example.category}" (${example.reason}). Treat photos like this one as acceptable.`,
    },
    {
      // "low" detail fixes image cost at a flat, low token count regardless of
      // resolution instead of tiling the full image at high-res — a single
      // full-size photo at default detail measured ~25k tokens (versus ~2-3k
      // at low detail), which was blowing through the account's per-minute
      // token budget on nearly every call. Low detail still gives the model
      // enough to judge category/quality for this task.
      type: "image_url",
      image_url: { url: `data:${detectMimeType(example.buffer)};base64,${example.buffer.toString("base64")}`, detail: "low" },
    },
  ]);

  const requestBody = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          ...referenceContent,
          { type: "text", text: "Now classify this photo:" },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "low" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 350,
  });

  let response;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: requestBody,
    });
    if (response.status !== 429 || attempt === maxAttempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in OpenAI response");

  const parsed = JSON.parse(content);
  const collagePanels = Array.isArray(parsed.collage_panels)
    ? parsed.collage_panels
        .map((panel) => ({
          x: Number(panel?.x),
          y: Number(panel?.y),
          width: Number(panel?.width),
          height: Number(panel?.height),
        }))
        .filter(
          (panel) =>
            [panel.x, panel.y, panel.width, panel.height].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
            panel.width > 0.05 &&
            panel.height > 0.05,
        )
        .slice(0, 4)
    : [];

  return {
    category: parsed.category || "other",
    showInDirectory: parsed.show_in_directory === true,
    quality: Number(parsed.quality) || 0,
    reason: parsed.reason || "",
    collagePanels,
  };
}
