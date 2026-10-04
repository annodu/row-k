// Social Studio — slide data model, canvas sizes, safe zones and photo layouts.
// Slides are pure functions of this data, rendered at true pixel size.

export type Aspect = "4:5" | "9:16";

export const CANVAS: Record<Aspect, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export type Insets = { top: number; right: number; bottom: number; left: number };

// Deliberately generous — TikTok overlays its own UI (top tabs, right-hand
// action rail, caption/username/music block at the bottom) and re-crops
// posts across surfaces. All text, the handle, profile card and location
// pill are laid out inside these insets; only photos/backgrounds bleed.
export const SAFE_ZONES: Record<Aspect, Insets> = {
  "9:16": { top: 260, right: 200, bottom: 560, left: 100 },
  "4:5": { top: 140, right: 140, bottom: 200, left: 100 },
};

export const PALETTE = {
  offwhite: "#F2F0ED",
  darkRoast: "#211C19",
  espresso: "#1A1512",
  smoky: "#2E2825",
  peach: "#E0B293",
};

export const FONT_DISPLAY = "'Bowlby One', 'Helvetica Neue', Impact, sans-serif";
export const FONT_SERIF = "'Junicode', 'Times New Roman', serif";
// Self-hosted copy of the site's UI font, so exports match ROW K exactly.
export const FONT_UI = "'Figtree Slide', 'Figtree', ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif";

export type PhotoLayoutId = "1" | "2-v" | "2-h" | "3" | "4";

export type PhotoLayout = {
  id: PhotoLayoutId;
  label: string;
  columns: string;
  rows: string;
  // One grid-template-areas string per row; cells are named a, b, c, d.
  areas: string[];
};

export const PHOTO_LAYOUTS: PhotoLayout[] = [
  { id: "1", label: "1 photo", columns: "1fr", rows: "1fr", areas: ["a"] },
  { id: "2-v", label: "2 side by side", columns: "1fr 1fr", rows: "1fr", areas: ["a b"] },
  { id: "2-h", label: "2 stacked", columns: "1fr", rows: "1fr 1fr", areas: ["a", "b"] },
  { id: "3", label: "1 large + 2", columns: "1.4fr 1fr", rows: "1fr 1fr", areas: ["a b", "a c"] },
  { id: "4", label: "2 × 2 grid", columns: "1fr 1fr", rows: "1fr 1fr", areas: ["a b", "c d"] },
];

export function getPhotoLayout(id: PhotoLayoutId): PhotoLayout {
  return PHOTO_LAYOUTS.find((layout) => layout.id === id) ?? PHOTO_LAYOUTS[4];
}

export function layoutCellCount(id: PhotoLayoutId) {
  return new Set(getPhotoLayout(id).areas.join(" ").split(" ")).size;
}

export type PhotoCell = { src: string; focusX: number; focusY: number };

export type CoverSlideData = {
  type: "cover";
  titleTop: string;
  title: string;
  kicker: string;
  handle: string;
  subtitle: string;
  photo: string;
  // Background-removed portrait drawn in front of the headline.
  subject: string;
  // Cut-out sizing, as % of its default size and % of slide width/height to
  // shift it by. Missing = defaults (100 / 0 / 0).
  subjectScale?: number;
  subjectOffsetX?: number;
  subjectOffsetY?: number;
};

export type ListSlideData = {
  type: "list";
  salonId: string;
  name: string;
  // Always rendered — credit for using the stylist's photos.
  handle: string;
  avatar: string;
  // Shown beside the location pin, worded like the public site's result row.
  locationTag: string;
  layout: PhotoLayoutId;
  cells: PhotoCell[];
  // Every photo available for this stylist; `cells` is the chosen subset.
  photoPool: string[];
};

export type ChecklistGroup = {
  title: string;
  rows: { label: string; checked: boolean; indent?: boolean }[];
};

// What's ticked on the closing slide's filter panel — chosen in the side
// panel, rendered with the public site's filter-panel rules (build.ts).
export type CtaFilters = {
  categories: string[];
  services: string[];
  areaIds: string[];
  priceBands: string[];
};

// Nudges for the closing slide's filter sheets and caption, as deltas from
// the default composition: size in % of default, dx/dy in % of the area
// below the search bar. Missing = default layout.
export type ElementAdjust = { size: number; dx: number; dy: number };
export type CtaLayout = {
  services: ElementAdjust;
  locations: ElementAdjust;
  caption: ElementAdjust & { width: number };
};

export const DEFAULT_CTA_LAYOUT: CtaLayout = {
  services: { size: 100, dx: 0, dy: 0 },
  locations: { size: 100, dx: 0, dy: 0 },
  caption: { size: 100, dx: 0, dy: 0, width: 100 },
};

export type CtaSlideData = {
  type: "cta";
  kicker: string;
  titleTop: string;
  title: string;
  url: string;
  caption: string;
  photo: string;
  // Source of truth for the panel; `checklists` is derived from it.
  filters?: CtaFilters;
  checklists: ChecklistGroup[];
  layout?: CtaLayout;
};

export type SlideData = CoverSlideData | ListSlideData | CtaSlideData;

// "east" → "E LDN"; multi-area stylists list each code ("SE SW N LDN").
const AREA_SHORT_CODES: Record<string, string> = {
  central: "C",
  north: "N",
  "north-west": "NW",
  east: "E",
  "south-east": "SE",
  "south-west": "SW",
  west: "W",
};

const AREA_STANDALONE_LABELS: Record<string, string> = {
  croydon: "Croydon",
  kent: "Kent",
  essex: "Essex",
  mobile: "Mobile",
  "all-london": "London",
};

export function locationTagForAreas(areaIds: string[]) {
  const unique = [...new Set(areaIds.filter(Boolean))];
  const londonCodes = unique.map((id) => AREA_SHORT_CODES[id]).filter(Boolean);
  const standalone = unique.map((id) => AREA_STANDALONE_LABELS[id]).filter(Boolean);
  const parts = [] as string[];
  if (londonCodes.length) parts.push(`${londonCodes.join(" ")} LDN`);
  parts.push(...standalone);
  return parts.join(" · ");
}

// Same wording as the public result row (App.tsx getLocationLabels /
// compassRegionDisplay): "East London", "South East London · Croydon".
const AREA_FULL_LABELS: Record<string, string> = {
  central: "Central London",
  north: "North London",
  "north-west": "North West London",
  east: "East London",
  "south-east": "South East London",
  "south-west": "South West London",
  west: "West London",
  croydon: "Croydon",
  kent: "Kent",
  essex: "Essex",
  mobile: "Mobile / home service",
  "all-london": "London",
};

export function locationLineForAreas(areaIds: string[], fallback = "") {
  const ids = [...new Set(areaIds.filter(Boolean))];
  if (ids.length === 2 && ids.includes("south-east") && ids.includes("south-west")) return "South London";
  const labels = [...new Set(ids.map((id) => AREA_FULL_LABELS[id]).filter(Boolean))];
  return labels.length ? labels.join(" · ") : fallback;
}

export function instagramHandleFromUrl(url: string) {
  if (!url) return "";
  try {
    const [handle] = new URL(url).pathname.split("/").filter(Boolean);
    return handle ? `@${handle}` : "";
  } catch {
    return "";
  }
}
