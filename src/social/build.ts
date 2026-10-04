// Turns a brief + chosen stylists into carousel slides. Everything here comes
// from directory data — a field with nothing behind it is left blank (and
// hidden on the slide) rather than guessed.

import { getServiceDisplayName, serviceFilterRows } from "@/lib/serviceTaxonomy";
import { type ChecklistGroup, type CtaFilters, type ListSlideData, type SlideData, locationLineForAreas } from "./model";

export type FilterCategory = { id: string; label: string; subcategories: string[] };
export type RegionOption = { id: string; label: string };
export type PriceBandTier = { symbol: string; label: string; maxAmount: number | null };

export type Brief = {
  category: string;
  service: string;
  areaIds: string[];
  priceBands: string[];
};

export const EMPTY_BRIEF: Brief = { category: "", service: "", areaIds: [], priceBands: [] };

export type FeaturedIn = { projectId: string; title: string; postedAt: string };

export type Candidate = {
  id: string;
  name: string;
  handle: string;
  instagramUrl: string;
  bookingUrl: string;
  bookingPlatform: string;
  areaIds: string[];
  areaLabel: string;
  priceBand: string;
  services: string[];
  matchedServices: string[];
  googleReviewCount: number;
  verifiedReviewCount: number;
  photos: string[];
  matchesBrief: boolean;
  featuredIn: FeaturedIn[];
};

export type BriefOptions = {
  categories: FilterCategory[];
  regions: RegionOption[];
  priceBands: PriceBandTier[];
};

const portfolioPhotosBaseUrl = String(import.meta.env.VITE_PORTFOLIO_PHOTOS_BASE_URL || "").replace(/\/+$/, "");

export function resolvePhotoUrl(url: string) {
  if (portfolioPhotosBaseUrl && url.startsWith("/portfolio-photos/")) return `${portfolioPhotosBaseUrl}${url}`;
  return url;
}

// "Boho braids / goddess braids" → "Boho braids": the first name reads better
// as a cover headline than the full canonical label.
export function shortServiceLabel(label: string) {
  return label.split(" / ")[0].split(" (")[0].trim();
}

export function briefServiceLabel(brief: Brief, options: BriefOptions) {
  if (brief.service) return getServiceDisplayName(brief.service);
  return options.categories.find((category) => category.id === brief.category)?.label ?? "";
}

function regionLabel(id: string, options: BriefOptions) {
  return options.regions.find((region) => region.id === id)?.label ?? id;
}

export function describeBrief(brief: Brief, options: BriefOptions) {
  const parts = [briefServiceLabel(brief, options)];
  if (brief.areaIds.length) parts.push(brief.areaIds.map((id) => regionLabel(id, options)).join(", "));
  if (brief.priceBands.length) parts.push(brief.priceBands.join(" / "));
  return parts.filter(Boolean).join(" · ");
}

export function candidateToListSlide(candidate: Candidate): ListSlideData {
  const photoPool = candidate.photos.map(resolvePhotoUrl);
  return {
    type: "list",
    salonId: candidate.id,
    name: candidate.name,
    handle: candidate.handle,
    avatar: "",
    locationTag: locationLineForAreas(candidate.areaIds, candidate.areaLabel),
    layout: photoPool.length >= 4 ? "4" : photoPool.length === 3 ? "3" : photoPool.length === 2 ? "2-v" : "1",
    cells: photoPool.slice(0, 4).map((src) => ({ src, focusX: 50, focusY: 50 })),
    photoPool,
  };
}

// Cover kicker: for a whole category, the sub-styles the chosen stylists
// actually offer; for a single service, where and how much.
function buildKicker(brief: Brief, options: BriefOptions, stylists: Candidate[]) {
  const category = options.categories.find((item) => item.id === brief.category);
  if (!brief.service && category) {
    const offered = category.subcategories
      .map((sub) => ({ sub, count: stylists.filter((stylist) => stylist.services.includes(sub)).length }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 4)
      .map((item) => shortServiceLabel(item.sub));
    return offered.length ? `${offered.join(", ")} ++` : "";
  }
  const where = brief.areaIds.map((id) => regionLabel(id, options).replace(/ London$/i, "")).join(", ");
  const tier = brief.priceBands.length === 1 ? options.priceBands.find((band) => band.symbol === brief.priceBands[0]) : undefined;
  return [where, tier?.label].filter(Boolean).join(" · ");
}

export function filtersFromBrief(brief: Brief): CtaFilters {
  return {
    // A single style is ticked on its own, like picking it on the site; a
    // whole-category brief ticks the category.
    categories: brief.category && !brief.service ? [brief.category] : [],
    services: brief.service ? [brief.service] : [],
    areaIds: brief.areaIds.length ? brief.areaIds : [],
    priceBands: brief.priceBands,
  };
}

// The public site's location filter (App.tsx): "London" with its compass
// areas nested underneath (labelled "East (E)"), then the standalone areas.
const LONDON_CHILDREN = ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"];
const COMPASS_SHORT: Record<string, string> = {
  central: "Central",
  north: "North (N)",
  "north-west": "North West (NW)",
  east: "East (E)",
  "south-east": "South East (SE)",
  "south-west": "South West (SW)",
  west: "West (W)",
};

// Mirrors the site's filter panel: a category expands to its styles when it
// (or one of its styles) is ticked; London expands to its areas the same way.
export function filterPanelGroups(filters: CtaFilters, options: BriefOptions): ChecklistGroup[] {
  const serviceRows: ChecklistGroup["rows"] = [];
  for (const category of options.categories) {
    const rows = serviceFilterRows(category.id, category.subcategories, filters.services);
    const expanded = filters.categories.includes(category.id) || rows.some((row) => filters.services.includes(row.service));
    serviceRows.push({ label: category.label, checked: filters.categories.includes(category.id) });
    if (expanded) {
      // A style can belong to two families (Boho sew-in is in Boho and Hybrid),
      // which would list it twice. Keep its first appearance, and leave a
      // family closed if that duplicate was its only ticked style.
      const shown = new Set<string>();
      let family: ChecklistGroup["rows"] = [];
      const flush = () => {
        const [head, ...children] = family;
        if (head) serviceRows.push(head, ...(head.checked || children.some((child) => child.checked) ? children : []));
        family = [];
      };
      for (const row of rows) {
        if (!row.nested) flush();
        else if (shown.has(row.service)) continue;
        shown.add(row.service);
        family.push({ label: getServiceDisplayName(row.service), checked: filters.services.includes(row.service), indent: row.nested ? 2 : 1 });
      }
      flush();
    }
  }

  const regionLabel = (id: string) => options.regions.find((region) => region.id === id)?.label ?? id;
  const londonExpanded = filters.areaIds.includes("all-london") || LONDON_CHILDREN.some((id) => filters.areaIds.includes(id));
  const locationRows: ChecklistGroup["rows"] = [
    { label: "London", checked: filters.areaIds.includes("all-london") },
    ...(londonExpanded
      ? LONDON_CHILDREN.map((id) => ({ label: COMPASS_SHORT[id] ?? regionLabel(id), checked: filters.areaIds.includes(id), indent: true }))
      : []),
    ...options.regions
      .filter((region) => !LONDON_CHILDREN.includes(region.id) && region.id !== "all-london")
      .map((region) => ({ label: region.label, checked: filters.areaIds.includes(region.id) })),
  ];

  const priceRows = [
    ...options.priceBands.map((band) => ({ label: `${band.symbol}: ${band.label}`, checked: filters.priceBands.includes(band.symbol) })),
    { label: "Price not listed", checked: filters.priceBands.includes("not-listed") },
  ];

  return [
    { title: "Services", rows: serviceRows },
    { title: "Locations", rows: locationRows },
    { title: "Price", rows: priceRows },
  ];
}

// A round "1,000+"-style figure rather than the exact count: thousands once
// past 1,000, hundreds below that. Empty when the count isn't known yet.
function roundedStylistCount(total: number) {
  if (total < 100) return "";
  const step = total >= 1000 ? 1000 : 100;
  return `${(Math.floor(total / step) * step).toLocaleString("en-GB")}+`;
}

export function buildCarousel(brief: Brief, options: BriefOptions, stylists: Candidate[], directoryTotal: number): SlideData[] {
  const listSlides = stylists.map(candidateToListSlide);
  const title = shortServiceLabel(briefServiceLabel(brief, options)) || "Stylist recs";
  return [
    {
      type: "cover",
      titleTop: "",
      title,
      kicker: buildKicker(brief, options, stylists),
      handle: "London",
      subtitle: "recs.",
      photo: listSlides[0]?.photoPool[0] ?? "",
      subject: "",
    },
    ...listSlides,
    {
      type: "cta",
      kicker: "find more",
      titleTop: "Black hair",
      title: "Salons",
      url: "www.row-k.london",
      caption: roundedStylistCount(directoryTotal)
        ? `${roundedStylistCount(directoryTotal)} stylists. filter by service, price & location`
        : "filter by service, price & location",
      photo: "",
      filters: filtersFromBrief(brief),
      checklists: filterPanelGroups(filtersFromBrief(brief), options),
    },
  ];
}
