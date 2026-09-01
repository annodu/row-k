import { Fragment, type FormEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Info, Search, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdminApp } from "@/AdminApp";
import { trackEvent as trackAnalyticsEvent } from "@/lib/analytics";
import { useIsSlowConnection } from "@/lib/connectionQuality";
import { cn } from "@/lib/utils";
import {
  getVerifiedReviewsPlatform as getVerifiedReviewsPlatformForUrl,
  getVerifiedReviewsUrl as getVerifiedReviewsUrlForBookingUrl,
} from "@/lib/verifiedReviews";

const vendorProductTypeGroups: { label: string; options: string[] }[] = [
  {
    label: "Braiding hair",
    options: [
      "Bulk braiding hair",
      "Bone Straight (synthetic)",
      "Braiding hair (colour mix)",
      "Crochet (Miracle knots)",
      "French curl braiding hair",
    ],
  },
  {
    label: "Extensions",
    options: ["I-tips", "K-tips", "Tape-ins", "Clip-ins", "Ponytails"],
  },
  {
    label: "Wigs",
    options: ["Wigs", "Half wigs / Upart wigs / headband wigs"],
  },
  {
    label: "Bundles & lace systems",
    options: ["Bundles (wefts)", "Custom colour bundles", "Frontals / closures"],
  },
];

const regions = [
  { id: "all-london", label: "London" },
  { id: "central", label: "Central London" },
  { id: "north", label: "North London" },
  { id: "north-west", label: "North west London" },
  { id: "east", label: "East London" },
  { id: "south-east", label: "South east London" },
  { id: "south-west", label: "South west London" },
  { id: "west", label: "West London" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile / home service" },
] as const;

// Same set as `regions`, but relabelled/reordered for the "Submit a stylist"
// location picker: "all-london" reads oddly as a bare "London" chip next to
// specific areas, so it's relabelled "London (general)" and moved last
// rather than first, where a submitter with a specific area in mind would
// otherwise be drawn to it by default.
const submissionRegionOptions = [
  ...regions.filter((region) => region.id !== "all-london"),
  { id: "all-london", label: "London (general)" },
];

type RegionParentGroup = { id: string; label: string; childIds: string[] };
const defaultRegionParentGroups: RegionParentGroup[] = [
  { id: "all-london", label: "London", childIds: ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"] },
];
const standaloneRegionIds = ["kent", "essex", "mobile"] as const;

// Compass-direction regions get fixed Title Case display forms — "South east
// London" (the canonical label used for matching/search) becomes "South East
// London" in results, or "South East (SE)" in the filter list. Every other
// region (Croydon, Kent, Essex, Mobile / home service, London) is left as-is.
const compassRegionDisplay: Record<string, { short: string; full: string; abbr?: string }> = {
  central: { short: "Central", full: "Central London" },
  north: { short: "North", full: "North London", abbr: "N" },
  "north-west": { short: "North West", full: "North West London", abbr: "NW" },
  east: { short: "East", full: "East London", abbr: "E" },
  "south-east": { short: "South East", full: "South East London", abbr: "SE" },
  "south-west": { short: "South West", full: "South West London", abbr: "SW" },
  west: { short: "West", full: "West London", abbr: "W" },
};

function getRegionDisplayLabel(regionId: string, fallbackLabel: string, { abbreviate = false }: { abbreviate?: boolean } = {}) {
  const entry = compassRegionDisplay[regionId];
  if (!entry) return fallbackLabel;
  if (abbreviate) {
    return entry.abbr ? `${entry.short} (${entry.abbr})` : entry.short;
  }
  return entry.full;
}

const DISCLAIMER_DISMISSED_KEY = "rowk_disclaimer_dismissed";

const categoryMap = {
  all: { label: "All services", subcategories: ["all"] },
  "braiding-services": { label: "Braids", subcategories: ["all","Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob","Men's braids","Wig cornrows"] },
  "colour-services": { label: "Colour", subcategories: ["all","Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"] },
  "bridal-services": { label: "Bridal", subcategories: ["all","Bridal"] },
  "editorial-services": { label: "Editorial / Session styling", subcategories: ["all","Editorial / Session styling"] },
  "kids-teens-services": { label: "Kids & teens styles", subcategories: ["all","Kids & teens styles"] },
  "extension-services": { label: "Extensions", subcategories: ["all","Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"] },
  "locs-services": { label: "Locs", subcategories: ["all","Starter locs / instant locs","Retwist / interlocking","Loc styling","Microlocs / sisterlocs","Loc extensions (permanent)"] },
  "faux-locs-services": { label: "Faux locs", subcategories: ["all","Soft locs","Crochet faux locs / invisible locs","Butterfly locs"] },
  "sew-in-weave": { label: "Sew in / weave", subcategories: ["all","Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"] },
  "styling-services": { label: "Styling (sew in / frontal / relaxer)", subcategories: ["all","Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie cut / finger waves","Sleek ponytail / bun","Updo"] },
  "straightening-treatments": { label: "Treatments", subcategories: ["all","Hair botox","Japanese straightening","K-18 treatment","Keratin treatment / Brazilian blowdry","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"] },
  "natural-hair-services": { label: "Natural hair washing & styling", subcategories: ["all","Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Bantu knots","Wash & blowdry","Japanese head spa","Scalp detox / treatments","Men's braids"] },
  "natural-hair-scalp-health": { label: "Natural hair health & trichology", subcategories: ["all","Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"] },
  "wig-services": { label: "Wigs", subcategories: ["all","Custom wig","Pixie wig / weave install","U-Part / Half wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry","Wig laundry"] },
} as const;

const categoryServiceMap = {
  "braiding-services": ["Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob","Men's braids","Wig cornrows"],
  "colour-services": ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"],
  "bridal-services": ["Bridal"],
  "editorial-services": ["Editorial / Session styling"],
  "kids-teens-services": ["Kids & teens styles"],
  "extension-services": ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"],
  "locs-services": ["Starter locs / instant locs","Retwist / interlocking","Loc styling","Microlocs / sisterlocs","Loc extensions (permanent)"],
  "faux-locs-services": ["Soft locs","Crochet faux locs / invisible locs","Butterfly locs"],
  "sew-in-weave": ["Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"],
  "styling-services": ["Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie cut / finger waves","Sleek ponytail / bun","Updo"],
  "straightening-treatments": ["Hair botox","Japanese straightening","K-18 treatment","Keratin treatment / Brazilian blowdry","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"],
  "natural-hair-services": ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Bantu knots","Wash & blowdry","Japanese head spa","Scalp detox / treatments","Men's braids"],
  "natural-hair-scalp-health": ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"],
  "wig-services": ["Custom wig","Pixie wig / weave install","U-Part / Half wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry","Wig laundry"],
} as const satisfies Record<ServiceCategoryId, readonly string[]>;

type RegionId = (typeof regions)[number]["id"];
type CategoryId = keyof typeof categoryMap;
type SubcategoryId = (typeof categoryMap)[CategoryId]["subcategories"][number];
type ServiceCategoryId = Exclude<CategoryId, "all">;
type ServiceSubcategoryId = Exclude<SubcategoryId, "all">;
type SortOption =
  | "default"
  | "alphabetical-asc"
  | "alphabetical-desc"
  | "most-specialised"
  | "most-services"
  | "price-asc"
  | "price-desc";
type PriceBand = string;
type PriceRangeFilterId = PriceBand | "not-listed";
type PriceBandTier = { symbol: string; label: string; maxAmount: number | null };

type SalonResult = {
  id: string;
  addedIndex?: number;
  name: string;
  brandId?: string;
  brandName?: string;
  branchLabel?: string;
  areaId?: string;
  areaIds?: string[];
  areaLabel: string;
  neighbourhood?: string;
  postcode?: string;
  bookingPlatform: string;
  bookingUrl: string;
  instagramUrl?: string;
  websiteUrl?: string;
  hairShopUrl?: string;

  services: string[];
  hijabiFriendly?: boolean;
  canBraidWithoutGel?: boolean;
  wheelchairAccessible?: boolean;
  senFriendly?: boolean;
  lgbtqFriendly?: boolean;
  parkingAvailable?: boolean;
  sellsHairSeparately?: boolean;
  sameDayEmergency?: boolean;
  temporarilyClosed?: boolean;
  hasVerifiedReviews?: boolean;
  verifiedReviewCount?: number;
  googleMapsUri?: string;
  googleReviewCount?: number;
  googleMatchConfidence?: "high" | "low" | "no-match";
  portfolioPhotos?: PortfolioPhoto[];
  customFilters?: Record<string, string[]>;
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: "service-only" | "mixed" | "package-only";
  summary: string;
  source: string;
};

type PortfolioPhoto = {
  id: string;
  url: string;
  source?: string;
};

type SearchResponse = {
  ok: boolean;
  results: SalonResult[];
  total: number;
  indexMeta?: {
    updatedAt?: string;
    source?: string;
    count?: number;
  };
  message?: string;
};

type DirectoryMode = "stylists" | "vendors";

const VENDOR_MODE_ENABLED = false;

type LinkedStylistBranch = {
  id: string;
  label: string;
  areaLabel?: string | null;
  bookingUrl?: string | null;
  bookingPlatform?: string | null;
};

type VendorResult = {
  id: string;
  name: string;
  productTypes: string[];
  fulfilment: string[];
  areaId?: string;
  areaLabel?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  hairShopUrl?: string;
  linkedSalonId?: string;
  linkedStylist?: { name: string; instagramUrl?: string | null; priceIncludesHair?: boolean; branches: LinkedStylistBranch[] } | null;
  summary?: string;
};

type VendorSearchResponse = {
  ok: boolean;
  results: VendorResult[];
  total: number;
  message?: string;
};

const regionLabelMap = Object.fromEntries(regions.map((region) => [region.id, region.label])) as Record<string, string>;

const serviceDisplayNames: Record<string, string> = {
  "Wig cornrows": "Cornrows / Twists / Wig cornrows",
};

function getServiceDisplayName(service: string) {
  return serviceDisplayNames[service] ?? service;
}

function normalizeServiceSearch(s: string) {
  return s.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

// Fallback used until /api/filters responds with the server's searchAliases
// (sourced from the same alias list the health check matcher uses server-side —
// see admin-stylists.mjs's serviceNegationHints — so new synonyms added there
// become searchable here too without a second copy to keep in sync).
const defaultServiceSearchAliases: Record<string, string[]> = {
  "Balayage": ["balayage"],
  "Highlights": ["highlight", "highlights", "lowlights"],
  "Full head colour": ["colour", "color", "tint", "dye", "rooting"],
  "Wig colouring / bundle colouring": ["wig colour", "wig color", "colouring full wig", "custom colour", "colour service", "613"],
  "Frontal sew-in": ["frontal sew in", "frontal sew-in", "frontal sewin", "frontal weave"],
  "Closure sew-in": ["closure sew in", "closure sew-in", "closure sewin", "closure weave", "weave with lace closure"],
  "Creative braids": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids", "koroba", "tyla braids", "tyla", "alicia keys braids", "diva braids"],
  "Feed-in braids": ["feed in", "feed-in", "all back", "braids going back", "all back cornrows", "all back braids", "cornrows with extensions", "cornrows with hair"],
  "Fulani / lemonade braids": ["fulani", "lemonade", "alicia keys braids"],
  "K-tips / invisible strands": ["k tips", "k-tips", "keratin tip", "keratin tips", "keratin bonds", "invisible strands"],
  "Frontal ponytail / bun": ["frontal ponytail", "frontal pony", "frontal bun", "frontal updo"],
  "U-Part / Half wig install": ["u part", "upart", "u-part", "u part wig", "u-part wig", "v part", "vpart", "v-part", "half wig"],
  "Custom wig": ["custom wig", "bespoke wig", "custom lace", "custom unit", "wig making", "wig construction"],
  "Wig install (frontal / closure)": ["wig install", "wig installation", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "frontal unit install", "closure unit install"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie sew in", "pixie sew-in"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist"],
  "Hybrid sew in (tapes + sew in)": ["hybrid sew in", "hybrid sew-in", "hybrid weave", "tracks + tapes hybrid", "tracks and tapes hybrid"],
  "Tracks (+ silk press) / partial / invisible sew-in": ["rows", "tracks", "track per row", "per row", "one row", "weave tracks", "partial sew in", "partial sew-in", "invisible sew in", "invisible weave", "invisible weft", "half head weave"],
  "Silk press": ["straightening", "straighten", "silk press", "silkpress", "press and curl"],
  "Bouncy blowout / round brush blow dry": ["bouncy blowout", "bouncy blow out", "bouncy blowdry", "bouncy blow dry", "bouncy blow-dry", "round brush blow dry", "round brush blowdry", "blowout"],
  "Sew in / extensions blowdry": ["extensions blowdry", "extensions blow dry", "extensions blowout", "extensions blow out", "extension blowdry", "extension blow dry", "extension blowout", "extension blow out", "blowdry with extensions", "blow dry with extensions", "blowout with extensions", "blow out with extensions", "weave blowdry", "weave blow dry", "weave blowout", "weave blow out", "sew in blowdry", "sew in blow dry", "sew-in blowdry", "sew-in blow dry", "sewin blowdry", "sewin blow dry", "sew in blowout", "sew in blow out", "sew-in blowout", "sew-in blow out", "k tips blowdry", "k-tips blowdry", "ktips blowdry", "k tips blow dry", "k-tips blow dry", "ktips blow dry"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "shampoo blowdry", "shampoo blow dry"],
  "Japanese head spa": ["japanese head spa", "head spa", "headspa"],
  "Updo": ["updo", "up do", "pin up", "french roll"],
  "Wig cornrows": ["under wig", "wig cornrows", "cornrows for wig", "cornrows"],
  "Butterfly locs": ["butterfly locs"],
  "Soft locs": ["faux locs", "soft locs"],
  "Crochet faux locs / invisible locs": ["crochet locs", "crochet faux locs", "invisible locs", "faux locs crochet"],
  "Starter locs / instant locs": ["starter locs", "start locs", "loc start", "instant locs"],
  "Retwist / interlocking": ["retwist", "re twist", "interlocking", "inter locking"],
  "Half braids, half sew-in": ["boho braids sew in", "boho braid sew in", "boho sew in", "fulani braids sew in", "fulani braid sew in", "fulani sew in"],
  "Braid take-down": ["braids removal", "braid removal", "braids takedown", "braid takedown"],
  "Sew-in take-down": ["sew in removal", "sewin removal", "sew-in removal", "weave removal", "weave takedown", "sew in takedown", "sewin takedown"],
  "Stitch braids": ["stitch braids", "stitch"],
  "Scalp detox / treatments": ["scalp", "scalp care", "scalp therapy", "scalp treatment", "scalp scrub", "scalp detox"],
  "Trichology / scalp analysis": ["scalp", "scalp analysis", "scalp health", "trichology"],
  "Kids & teens styles": ["kids", "kid", "teen", "teens", "children", "child"],
};

const sortedCategoryEntries = [
  ...Object.entries(categoryMap).filter(([id]) => id === "all"),
  ...Object.entries(categoryMap)
    .filter(([id]) => id !== "all")
    .sort(([, left], [, right]) => left.label.localeCompare(right.label)),
] as [CategoryId, (typeof categoryMap)[CategoryId]][];

const RESULTS_BATCH_SIZE = 20;
const RESULTS_SKELETON_COUNT = 6;
const sortOptions: { id: SortOption; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "alphabetical-asc", label: "A → Z" },
  { id: "alphabetical-desc", label: "Z → A" },
  { id: "price-asc", label: "Price: Low to high" },
  { id: "price-desc", label: "Price: High to low" },
  { id: "most-specialised", label: "Most specialised" },
  { id: "most-services", label: "Most services" },
];
const defaultPriceBandTiers: PriceBandTier[] = [
  { symbol: "£", label: "under £100", maxAmount: 100 },
  { symbol: "££", label: "£100-£200", maxAmount: 200 },
  { symbol: "£££", label: "£200-£300", maxAmount: 300 },
  { symbol: "££££", label: "over £300", maxAmount: null },
];
let priceBandTiersCache: PriceBandTier[] = defaultPriceBandTiers;

function getPriceRangeOptions(tiers: PriceBandTier[]): { id: PriceRangeFilterId; label: string }[] {
  return [...tiers.map((tier) => ({ id: tier.symbol, label: `${tier.symbol}: ${tier.label}` })), { id: "not-listed", label: "Price not listed" }];
}

function compareSalonNames(left: SalonResult, right: SalonResult) {
  const leftStartsWithDigit = /^\d/.test(left.name);
  const rightStartsWithDigit = /^\d/.test(right.name);

  if (leftStartsWithDigit !== rightStartsWithDigit) {
    return leftStartsWithDigit ? 1 : -1;
  }

  return left.name.localeCompare(right.name);
}

function compareSalonNamesDesc(left: SalonResult, right: SalonResult) {
  return compareSalonNames(right, left);
}

function comparablePriceBand(result: SalonResult) {
  return result.servicePriceBand || result.priceBand;
}

function getResultCustomFilterLabels(result: SalonResult, filterTypes: CustomFilterType[]): string[] {
  if (!result.customFilters) return [];
  return filterTypes.flatMap((filterType) => {
    const selectedIds = result.customFilters?.[filterType.id] ?? [];
    return filterType.options.filter((option) => selectedIds.includes(option.id)).map((option) => option.label);
  });
}

function getVerifiedReviewsPlatform(result: SalonResult): string | null {
  return getVerifiedReviewsPlatformForUrl(result.bookingUrl);
}

function getVerifiedReviewsUrl(result: SalonResult): string {
  return getVerifiedReviewsUrlForBookingUrl(result.bookingUrl);
}

function getReviewsBannerInfo(
  result: SalonResult,
  options?: { preferBookingPlatform?: boolean },
): { label: string; url: string; accessibleLabel: string } | null {
  const hasGoogleReviews = result.googleMatchConfidence === "high" && Number(result.googleReviewCount) > 0 && result.googleMapsUri;
  const platform = getVerifiedReviewsPlatform(result);
  const hasBookingPlatformReviews = Boolean(platform) && Number(result.verifiedReviewCount) > 0;

  // Google reviews win by default, but a user who's filtered to booking-site
  // reviews specifically wants to see that link, not Google's, for salons with both.
  if (options?.preferBookingPlatform && hasBookingPlatformReviews) {
    return { label: `Reviews on ${platform}`, url: getVerifiedReviewsUrl(result), accessibleLabel: `Reviews for ${result.name} on ${platform}` };
  }

  if (hasGoogleReviews) {
    return { label: "Google reviews available", url: result.googleMapsUri, accessibleLabel: `Google reviews for ${result.name} available` };
  }

  if (hasBookingPlatformReviews) {
    return { label: `Reviews on ${platform}`, url: getVerifiedReviewsUrl(result), accessibleLabel: `Reviews for ${result.name} on ${platform}` };
  }

  return null;
}

// Loose enough to treat "instagram.com/x", "www.instagram.com/x/" and
// "https://instagram.com/x?igsh=..." as the same destination, without
// misjudging a genuinely different link (e.g. a specific shop/product post)
// as a duplicate of the profile URL.
function normalizeUrlForComparison(url: string) {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function getHairShopLinkInfo(result: SalonResult): { label: string; url: string; accessibleLabel: string } | null {
  if (!result.sellsHairSeparately) {
    return null;
  }

  const url = result.hairShopUrl || result.websiteUrl;
  if (!url) {
    return null;
  }

  // Some stylists only sell hair through their Instagram, so the "shop"
  // link on file is the exact same destination as the Instagram icon
  // already shown for this card — a second link to it would just be the
  // same URL twice, so fall through to the plain (non-link) attribute
  // badge instead.
  if (result.instagramUrl && normalizeUrlForComparison(url) === normalizeUrlForComparison(result.instagramUrl)) {
    return null;
  }

  return { label: "Hair sold separately", url, accessibleLabel: `Hair shop for ${result.name}` };
}

function isInstagramUrl(url: string) {
  return /(^|\/\/)(www\.)?instagram\.com\//i.test(url);
}

// Reel-thumbnail covers (a Reel's pre-generated CDN cover frame, not a real
// photo post) are the lowest-quality source on file — text-overlay title
// cards, "GRWM" slides, capped at a small fixed resolution. Never let one pad
// a card out to 3 when there aren't enough real photos to fill it; show
// fewer instead. Falls back to them only when that's literally all a salon
// has, so a card still shows *something*. "instagram-reel-frame" (a specific
// frame scrubbed directly from the Reel's video at native resolution) is
// deliberately excluded from this penalty — it's not the low-quality
// auto-cover, so it's treated the same as a real photo.
function getPortfolioPhotos(result: SalonResult): PortfolioPhoto[] {
  const photos = result.portfolioPhotos ?? [];
  const nonReelPhotos = photos.filter((photo) => photo.source !== "instagram-reel-thumbnail");
  return (nonReelPhotos.length > 0 ? nonReelPhotos : photos).slice(0, 3);
}

// Placeholder for salons without portfolio photos yet — the site's wide
// wordmark mark, greyed out via currentColor rather than its usual
// dark/light brand fill.
function PortfolioPlaceholderIcon({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg
      viewBox="0 0 263 180"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M-52 288V-152H121.582C153.563 -152 181.967 -145.714 206.794 -133.143C231.622 -120.99 250.979 -103.809 264.865 -81.6C279.173 -59.8095 286.326 -34.6667 286.326 -6.17142C286.326 22.3238 279.173 47.6762 264.865 69.8857C250.558 92.0952 230.78 109.486 205.532 122.057C180.704 134.21 152.09 140.286 119.688 140.286H49.6241V288H-52ZM187.858 288L88.1277 113.257L164.504 57.3143L304 288H187.858ZM49.6241 47.2571H118.426C130.208 47.2571 140.728 44.9524 149.986 40.3429C159.243 35.7333 166.397 29.4476 171.447 21.4857C176.917 13.1048 179.652 3.88571 179.652 -6.17142C179.652 -21.6762 173.761 -34.4571 161.979 -44.5143C150.617 -54.5714 135.468 -59.6 116.532 -59.6H49.6241V47.2571Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="263" height="180" />
        </clipPath>
      </defs>
    </svg>
  );
}

function PortfolioPhotoCarousel({
  result,
  photos,
  className,
  expandedHeightPx,
}: {
  result: SalonResult;
  photos: PortfolioPhoto[];
  className?: string;
  // Set only once the sibling services text's post-expand height has actually
  // been measured — driving this off a real pixel value (rather than a CSS
  // percentage stretch) avoids feeding back into the grid's own row-sizing pass,
  // which was inflating the row above it instead of leaving it fixed.
  expandedHeightPx?: number | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const isSlowConnection = useIsSlowConnection();
  // Read via a ref rather than as an effect dependency below — the Network Information
  // API's effectiveType can legitimately downgrade mid-session as the page's own image
  // loading saturates the connection, and we only want that to affect photos we haven't
  // started loading yet, not retroactively yank ones that already loaded fine.
  const isSlowConnectionRef = useRef(isSlowConnection);
  isSlowConnectionRef.current = isSlowConnection;
  const [photoState, setPhotoState] = useState<"loading" | "loaded" | "failed">(
    isSlowConnection ? "failed" : "loading",
  );
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // We drive visibility ourselves (rather than the img's native loading="lazy") so the
  // stall timeout below starts at the same moment the fetch actually starts. With
  // potentially hundreds of cards on one results page, the browser's own lazy-load
  // heuristic defers many images well past our own visibility check, and racing two
  // uncoordinated "is it visible" signals flags perfectly healthy, not-yet-requested
  // photos as failed.
  const [isNearViewport, setIsNearViewport] = useState(false);

  const activePhoto = photos[0] ? (photos[activeIndex] ?? photos[0]) : null;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activePhoto || !isNearViewport) return;
    const slow = isSlowConnectionRef.current;
    setPhotoState(slow ? "failed" : "loading");
    if (slow) return;
    // A photo that hasn't finished loading after this long once we've started
    // fetching it is treated as failed — catches stalled/broken requests on every
    // browser, not just the ones the Network Information API can flag (Chromium/
    // Android only). Guarded on "loading" so a photo that already resolved via
    // onLoad/onError isn't clobbered once the timer eventually fires.
    const timeoutId = window.setTimeout(() => {
      setPhotoState((current) => (current === "loading" ? "failed" : current));
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [activePhoto?.url, isNearViewport]);

  if (photos.length === 0 || !activePhoto) return null;

  const hasMultiplePhotos = photos.length > 1;
  const goToPhoto = (nextIndex: number) => {
    setActiveIndex((nextIndex + photos.length) % photos.length);
  };

  const SWIPE_THRESHOLD_PX = 45;
  const TAP_MOVEMENT_TOLERANCE_PX = 10;

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !hasMultiplePhotos) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)) {
      // Suppresses the browser's emulated click that would otherwise follow
      // this touch — without it, the click handler below (added for mouse
      // users on narrow desktop windows, where the hover chevrons are
      // hidden) would double-navigate on real touchscreens.
      event.preventDefault();
      goToPhoto(activeIndex + (deltaX < 0 ? 1 : -1));
      return;
    }
    if (
      Math.abs(deltaX) < TAP_MOVEMENT_TOLERANCE_PX &&
      Math.abs(deltaY) < TAP_MOVEMENT_TOLERANCE_PX &&
      !(event.target instanceof HTMLElement && event.target.closest("button"))
    ) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const tappedRight = touch.clientX - rect.left > rect.width / 2;
      goToPhoto(activeIndex + (tappedRight ? 1 : -1));
    }
  };

  // Mouse-driven counterpart to the touch tap above. The prev/next chevrons
  // are only shown from `sm:` up (hover-revealed, no use on touch devices),
  // so a desktop browser window resized narrower than that — a mouse-only
  // environment, not a touchscreen — would otherwise have no way to scrub
  // photos at all. Real touches never reach this: the touchend handler
  // above calls preventDefault() before the browser can emit its follow-up
  // click.
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!hasMultiplePhotos || (event.target instanceof HTMLElement && event.target.closest("button"))) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const clickedRight = event.clientX - rect.left > rect.width / 2;
    goToPhoto(activeIndex + (clickedRight ? 1 : -1));
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-none border border-stone-300/60 bg-stone-200 dark:border-stone-700/60 dark:bg-stone-900 transition-[height] duration-300",
          expandedHeightPx == null && "aspect-[3/2] sm:aspect-[4/3]",
        )}
        style={expandedHeightPx != null ? { height: expandedHeightPx } : undefined}
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleContainerClick}
      >
        {!isNearViewport ? null : photoState === "failed" ? (
          <PortfolioPlaceholderIcon className="h-full w-full text-stone-100 dark:text-stone-950" />
        ) : (
          <img
            src={activePhoto.url}
            alt=""
            className="h-full w-full object-cover"
            onLoad={() => setPhotoState("loaded")}
            onError={() => setPhotoState("failed")}
          />
        )}

        {hasMultiplePhotos ? (
          // The photos themselves are decorative (alt=""), so scrubbing
          // through them carries no information — these controls are hidden
          // from the accessibility tree and pulled out of the tab order
          // entirely rather than making every stylist card contribute several
          // extra stops (prev/next + one dot per photo) to keyboard/screen
          // reader navigation of a list that can run into the hundreds.
          <div aria-hidden="true">
            <button
              type="button"
              tabIndex={-1}
              onClick={(event) => {
                event.preventDefault();
                goToPhoto(activeIndex - 1);
              }}
              className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-none border border-white/40 bg-white/30 text-stone-900 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md backdrop-saturate-150 transition hover:bg-white/45 hover:opacity-100 dark:border-white/15 dark:bg-white/22 dark:text-white dark:shadow-[0_2px_8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-white/32"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(event) => {
                event.preventDefault();
                goToPhoto(activeIndex + 1);
              }}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-none border border-white/40 bg-white/30 text-stone-900 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md backdrop-saturate-150 transition hover:bg-white/45 hover:opacity-100 dark:border-white/15 dark:bg-white/22 dark:text-white dark:shadow-[0_2px_8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-white/32"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPhoto(index);
                  }}
                  className="size-1.5 rounded-none bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.18)] transition hover:bg-white"
                />
              ))}
              <div
                className="pointer-events-none absolute left-0 size-1.5 rounded-none bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${activeIndex * 12}px)` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function priceBandRank(result: SalonResult) {
  const priceBand = comparablePriceBand(result);
  if (!priceBand) return Number.POSITIVE_INFINITY;
  const index = priceBandTiersCache.findIndex((tier) => tier.symbol === priceBand);
  return index === -1 ? Number.POSITIVE_INFINITY : index + 1;
}

function compareSalonPriceBandsAsc(left: SalonResult, right: SalonResult) {
  return priceBandRank(left) - priceBandRank(right) || compareSalonNames(left, right);
}

function compareSalonPriceBandsDesc(left: SalonResult, right: SalonResult) {
  const leftRank = priceBandRank(left);
  const rightRank = priceBandRank(right);

  if (!Number.isFinite(leftRank) && !Number.isFinite(rightRank)) {
    return compareSalonNames(left, right);
  }

  if (!Number.isFinite(leftRank)) {
    return 1;
  }

  if (!Number.isFinite(rightRank)) {
    return -1;
  }

  return rightRank - leftRank || compareSalonNames(left, right);
}

function sortResults(
  results: SalonResult[],
  sortOption: SortOption,
  _hasActiveFilters: boolean,
  _selectedCategories: ServiceCategoryId[],
  _selectedSubcategories: ServiceSubcategoryId[],
  getShuffleKey: (id: string) => number,
) {
  switch (sortOption) {
    case "alphabetical-asc":
      return [...results].sort(compareSalonNames);
    case "alphabetical-desc":
      return [...results].sort(compareSalonNamesDesc);
    case "price-asc":
      return [...results].sort(compareSalonPriceBandsAsc);
    case "price-desc":
      return [...results].sort(compareSalonPriceBandsDesc);
    case "most-services":
      return [...results].sort((left, right) => right.services.length - left.services.length || compareSalonNames(left, right));
    case "most-specialised":
      return [...results].sort((left, right) => left.services.length - right.services.length || compareSalonNames(left, right));
    case "default":
    default:
      // Stable per-session random order so no single stylist (e.g. alphabetically first) always
      // gets the most impressions — see StylistCardWrapper's view-tracking IntersectionObserver.
      return [...results].sort((left, right) => getShuffleKey(left.id) - getShuffleKey(right.id));
  }
}

function useViewedOnce(onViewed: () => void) {
  const ref = useRef<HTMLLIElement | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onViewed);
  callbackRef.current = onViewed;

  const setRef = useCallback((node: HTMLLIElement | null) => {
    ref.current = node;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          callbackRef.current();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
  }, []);

  return setRef;
}

function StylistCardWrapper({
  result,
  services,
  children,
}: {
  result: SalonResult;
  services: string;
  children: React.ReactNode;
}) {
  const setRef = useViewedOnce(() => {
    trackAnalyticsEvent("stylist_viewed", {
      salon: result.name,
      location: result.areaLabel,
      services,
    });
  });

  return (
    <li
      ref={setRef}
      className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-6 text-left last:border-b-0 dark:border-stone-800"
    >
      {children}
    </li>
  );
}

function makeFilterLabelId(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLocationLabels(result: SalonResult) {
  const areaIds = result.areaIds?.length ? result.areaIds : result.areaId ? [result.areaId] : [];
  const isSouthUmbrella =
    result.areaId === "south" &&
    result.areaIds?.length === 2 &&
    result.areaIds.includes("south-east") &&
    result.areaIds.includes("south-west");

  const locationLabels = isSouthUmbrella
    ? ["South London"]
    : [...new Set(areaIds.map((areaId) => regionLabelMap[areaId] && getRegionDisplayLabel(areaId, regionLabelMap[areaId])).filter(Boolean))];

  if (!locationLabels.length && result.areaLabel) {
    locationLabels.push(result.areaLabel);
  }

  return locationLabels;
}

function BrandGroupCard({
  brandBranches,
  orderedServices,
  customFilterTypes,
  preferBookingPlatform,
}: {
  brandBranches: SalonResult[];
  orderedServices: string[];
  customFilterTypes: CustomFilterType[];
  preferBookingPlatform: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Mirrors SalonResultCard's fix: the photo's height always matches the
  // right-hand column's actual content height (row 1 + gap + services),
  // rather than a fixed aspect ratio, and the services block sits flush
  // against the card's bottom via a measured margin-top (not align-self:
  // end) — frozen once expansion starts so only the block's bottom grows.
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const [servicesMarginTopPx, setServicesMarginTopPx] = useState<number | null>(null);
  const [photoHeightPx, setPhotoHeightPx] = useState<number | null>(null);
  // Mirrors SalonResultCard's identical state: the Instagram link is
  // duplicated below — once inline next to the name (mobile) and once in
  // the button row (desktop) — so aria-hidden/tabIndex track the real
  // breakpoint rather than just hiding one via CSS, keeping only one
  // "Go to X Instagram" name in the accessibility tree at a time.
  const [isSmUp, setIsSmUp] = useState(false);
  const nameInfoRef = useRef<HTMLDivElement | null>(null);
  const buttonRowRef = useRef<HTMLDivElement | null>(null);
  const servicesBlockRef = useRef<HTMLDivElement | null>(null);
  // See SalonResultCard's identical refs for why growth while expanded is
  // added on top of this frozen baseline rather than recomputed fresh.
  const baselinePhotoHeightRef = useRef<number>(MIN_PHOTO_HEIGHT_PX);
  const baselineServicesHeightRef = useRef<number>(0);
  const brand = brandBranches[0];
  const brandName = brand.brandName ?? brand.name;
  // Temporarily closed branches are hidden entirely — not worth showing a
  // branch a customer can't currently visit.
  const openBranches = brandBranches.filter((branch) => !branch.temporarilyClosed);
  // Wheelchair access is branch-specific (shown per-row below); these other
  // attributes live on the shared brand record, so they show once here,
  // same position/style as the badge on a regular single-location card.
  const hairShopLink = getHairShopLinkInfo(brand);
  const attributeLabels = [
    brand.hijabiFriendly ? "hijabi-friendly" : null,
    brand.canBraidWithoutGel ? "can braid without gel" : null,
    brand.senFriendly ? "sensory-safe / sen-friendly" : null,
    brand.lgbtqFriendly ? "lgbtqia+-friendly" : null,
    brand.priceIncludesHair ? "hair-inclusive packages" : null,
    !hairShopLink && brand.sellsHairSeparately ? "hair sold separately" : null,
    brand.sameDayEmergency ? "same-day / walk-ins" : null,
    ...getResultCustomFilterLabels(brand, customFilterTypes),
  ].filter((label): label is string => Boolean(label));
  const portfolioPhotos = getPortfolioPhotos(brand);
  const hasPortfolioPhotos = portfolioPhotos.length > 0;

  const setRef = useViewedOnce(() => {
    trackAnalyticsEvent("stylist_viewed", { salon: brandName, location: "multiple", services: "brand-group" });
  });

  const areaLabels = [...new Set(openBranches.flatMap((branch) => getLocationLabels(branch)))];
  const locationSummary = areaLabels.length > 1 ? "London" : (areaLabels[0] ?? "");
  const priceSymbols = priceBandTiersCache
    .map((tier) => tier.symbol)
    .filter((symbol) => openBranches.some((branch) => comparablePriceBand(branch) === symbol));
  const priceSummary = priceSymbols.length > 1 ? `${priceSymbols[0]} – ${priceSymbols[priceSymbols.length - 1]}` : (priceSymbols[0] ?? "");

  const sortedBranches = [...openBranches].sort((left, right) =>
    (left.branchLabel ?? left.name).localeCompare(right.branchLabel ?? right.name),
  );
  const visibleBranches = expanded ? sortedBranches : sortedBranches.slice(0, 5);
  const hiddenCount = sortedBranches.length - visibleBranches.length;
  // When every open branch books through the exact same link (e.g. a brand-wide
  // booking page rather than a per-location one), showing "Book" on every row
  // is just noise — show it once at the brand level instead.
  const sharedBookingUrl =
    openBranches.length > 0 && openBranches.every((branch) => branch.bookingUrl && branch.bookingUrl === openBranches[0].bookingUrl)
      ? openBranches[0].bookingUrl
      : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const syncIsSmUp = (event: MediaQueryList | MediaQueryListEvent) => setIsSmUp(event.matches);
    syncIsSmUp(mediaQuery);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsSmUp);
      return () => mediaQuery.removeEventListener("change", syncIsSmUp);
    }
    mediaQuery.addListener(syncIsSmUp);
    return () => mediaQuery.removeListener(syncIsSmUp);
  }, []);

  useEffect(() => {
    // Both values below are derived from the same measurement pass — see
    // SalonResultCard's identical effect for why that matters.
    const measure = () => {
      const isSmUp = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
      if (!isSmUp) {
        setPhotoHeightPx(null);
        setServicesMarginTopPx(null);
        return;
      }

      const row1Height = Math.max(
        nameInfoRef.current?.getBoundingClientRect().height ?? 0,
        buttonRowRef.current?.getBoundingClientRect().height ?? 0,
      );
      const servicesHeight = servicesBlockRef.current?.getBoundingClientRect().height ?? 0;
      const rowGapPx = 10; // matches the grid's sm:gap-y-2.5

      if (!isServicesExpanded) {
        const contentNeededHeight = row1Height + rowGapPx + servicesHeight;
        const nextPhotoHeight = Math.max(contentNeededHeight, MIN_PHOTO_HEIGHT_PX);
        setPhotoHeightPx(nextPhotoHeight);
        const row2TrackPx = nextPhotoHeight - row1Height - rowGapPx;
        setServicesMarginTopPx(Math.max(0, row2TrackPx - servicesHeight));
        baselinePhotoHeightRef.current = nextPhotoHeight;
        baselineServicesHeightRef.current = servicesHeight;
      } else {
        const growthPx = Math.max(0, servicesHeight - baselineServicesHeightRef.current);
        setPhotoHeightPx(baselinePhotoHeightRef.current + growthPx);
      }
    };

    const raf = requestAnimationFrame(measure);
    let cancelled = false;
    document.fonts?.ready?.then(() => {
      if (!cancelled) measure();
    });
    // Only watch row 1 here, not the services block — see SalonResultCard's
    // identical effect for why observing the services block's own resize
    // races with the isServicesExpanded state update and un-freezes the
    // margin mid-hover.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (nameInfoRef.current) resizeObserver?.observe(nameInfoRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isServicesExpanded, orderedServices]);

  return (
    <li
      ref={setRef}
      className="flex w-full flex-col items-start gap-3 border-b border-stone-300 px-0 py-6 text-left last:border-b-0 dark:border-stone-800"
    >
      <div className="flex w-full flex-col gap-2.5 sm:grid sm:items-start sm:gap-x-4 sm:gap-y-2.5 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:grid-rows-[min-content_1fr] lg:grid-cols-[240px_minmax(0,1fr)_auto]">
        {hasPortfolioPhotos ? (
          <PortfolioPhotoCarousel
            result={brand}
            photos={portfolioPhotos}
            className="order-1 mb-1 sm:row-span-2 sm:mb-0"
            expandedHeightPx={photoHeightPx}
          />
        ) : (
          <div className="order-1 mb-1 hidden w-full sm:row-span-2 sm:mb-0 sm:block" aria-hidden="true">
            <div
              className={cn(
                "flex w-full items-center justify-center overflow-hidden rounded-none border border-stone-300/60 bg-stone-300 dark:border-stone-700/60 dark:bg-stone-700 transition-[height] duration-300",
                photoHeightPx == null && "aspect-[3/2] sm:aspect-[4/3]",
              )}
              style={photoHeightPx != null ? { height: photoHeightPx } : undefined}
            >
              <PortfolioPlaceholderIcon className="h-full w-full text-stone-100 dark:text-stone-950" />
            </div>
          </div>
        )}
        <div className="min-w-0 order-2" ref={nameInfoRef}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">{brandName}</h3>
                <span className="inline-block rounded-none bg-stone-200/45 px-1.5 py-1 text-[11px] font-semibold leading-none tracking-[0.06em] text-stone-600 dark:bg-stone-900/48 dark:text-stone-400">
                  {openBranches.length} branches
                </span>
              </div>
              {locationSummary || priceSummary ? (
                <p className="mt-0.5 text-[13px] font-medium text-stone-500 dark:text-stone-400">
                  {locationSummary}
                  {locationSummary && priceSummary ? " · " : ""}
                  {priceSummary}
                </p>
              ) : null}
              {hairShopLink ? (
                <a
                  href={hairShopLink.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${hairShopLink.accessibleLabel} - opens in a new tab`}
                  onClick={() => trackAnalyticsEvent("hair_shop_click", { salon: brandName, location: "multiple" })}
                  className="mt-1 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[oklch(0.45_0.05_255)] transition-colors hover:text-[oklch(0.38_0.06_255)] active:text-[oklch(0.38_0.06_255)] dark:text-[oklch(0.72_0.05_255)] dark:hover:text-[oklch(0.80_0.06_255)] dark:active:text-[oklch(0.80_0.06_255)]"
                >
                  <span aria-hidden="true">{hairShopLink.label}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
              {attributeLabels.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {attributeLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-block w-fit rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {brand.instagramUrl ? (
              <a
                href={brand.instagramUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackAnalyticsEvent("instagram_click", { salon: brandName, placement: "brand-group-mobile" })}
                aria-hidden={isSmUp}
                tabIndex={isSmUp ? -1 : 0}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:hidden"
              >
                <InstagramIcon className="size-4" />
                <span className="sr-only">Go to {brandName} Instagram - opens in a new tab</span>
              </a>
            ) : null}
          </div>
        </div>
        <div
          className="order-4 mt-2 flex w-full shrink-0 items-center gap-2 sm:order-3 sm:mt-0 sm:w-auto sm:justify-self-end"
          ref={buttonRowRef}
        >
          {brand.instagramUrl ? (
            <a
              href={brand.instagramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAnalyticsEvent("instagram_click", { salon: brandName, placement: "brand-group" })}
              aria-hidden={!isSmUp}
              tabIndex={isSmUp ? 0 : -1}
              className="hidden min-h-[48px] min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-2 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:inline-flex sm:min-h-[40px]"
            >
              <InstagramIcon className="size-4" />
              <span className="sr-only">Go to {brandName} Instagram - opens in a new tab</span>
            </a>
          ) : null}
          {sharedBookingUrl ? (
            <a
              href={sharedBookingUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackAnalyticsEvent("book_click", {
                  salon: brandName,
                  platform: brand.bookingPlatform,
                  location: "multiple",
                  services: "none",
                })
              }
              className="inline-flex min-h-[48px] flex-1 shrink-0 items-center justify-center rounded-none bg-stone-950 px-4 py-2 text-[13px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300 sm:min-h-[40px] sm:flex-none"
            >
              <span aria-hidden="true">Book</span>
              <span className="sr-only">Book {brandName} - opens in a new tab</span>
            </a>
          ) : null}
        </div>

        {orderedServices.length > 0 ? (
          <div
            className="order-3 mt-2 w-full sm:order-3 sm:col-span-2 sm:mt-0 sm:self-start lg:mt-0"
            style={servicesMarginTopPx != null ? { marginTop: servicesMarginTopPx } : undefined}
            ref={servicesBlockRef}
          >
            <div className="border-l-2 border-stone-300 pl-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:text-stone-300">
              <ServicesSummary services={orderedServices} maxLines={2} onExpandedChange={setIsServicesExpanded} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="w-full bg-stone-200/45 p-5 mt-4 dark:bg-stone-900/48">
        <div className="divide-y divide-stone-300 dark:divide-stone-800">
          {visibleBranches.map((branch) => {
          const reviewsBanner = getReviewsBannerInfo(branch, { preferBookingPlatform });
          const branchLocation = getLocationLabels(branch).join(" · ");
          return (
            <div key={branch.id} className="flex items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-stone-950 dark:text-stone-50">{branch.branchLabel ?? branch.name}</p>
                {branchLocation ? <p className="text-[13px] text-stone-500 dark:text-stone-400">{branchLocation}</p> : null}
                {reviewsBanner ? (
                  <a
                    href={reviewsBanner.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${reviewsBanner.accessibleLabel} - opens in a new tab`}
                    onClick={() =>
                      trackAnalyticsEvent("verified_reviews_click", {
                        salon: branch.name,
                        platform: getVerifiedReviewsPlatform(branch) ?? "google",
                      })
                    }
                    className="mt-0.5 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[oklch(0.45_0.05_255)] transition-colors hover:text-[oklch(0.38_0.06_255)] active:text-[oklch(0.38_0.06_255)] dark:text-[oklch(0.72_0.05_255)] dark:hover:text-[oklch(0.80_0.06_255)] dark:active:text-[oklch(0.80_0.06_255)]"
                  >
                    <span aria-hidden="true">{reviewsBanner.label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : null}
                {branch.wheelchairAccessible ? (
                  <span className="mt-2.5 block w-fit rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]">
                    wheelchair access
                  </span>
                ) : null}
              </div>
              {!sharedBookingUrl && branch.bookingUrl && branch.bookingPlatform !== "Instagram" ? (
                <a
                  href={branch.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent("book_click", {
                      salon: branch.name,
                      platform: branch.bookingPlatform,
                      location: branch.areaLabel,
                      services: "none",
                    })
                  }
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-none bg-stone-950 px-4 py-2 text-[13px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300 sm:min-h-[40px]"
                >
                  <span aria-hidden="true">Book</span>
                  <span className="sr-only">Book {branch.name} - opens in a new tab</span>
                </a>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>

      {sortedBranches.length > 5 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-center gap-1 rounded-none px-2 py-2 text-[13px] font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-950 active:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100 dark:active:bg-stone-900"
        >
          <span>{expanded ? "Show fewer branches" : `${hiddenCount} more branches`}</span>
          <ChevronDown className={cn("size-4 transition-transform", expanded ? "rotate-180" : "")} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

function SalonResultCard({
  result,
  locationLabels,
  orderedServices,
  activeServices,
  reviewsBanner,
  hairShopLink,
  attributeLabels,
  portfolioPhotos,
  hasPortfolioPhotos,
}: {
  result: SalonResult;
  locationLabels: string[];
  orderedServices: string[];
  activeServices: string;
  reviewsBanner: ReturnType<typeof getReviewsBannerInfo>;
  hairShopLink: ReturnType<typeof getHairShopLinkInfo>;
  attributeLabels: string[];
  portfolioPhotos: PortfolioPhoto[];
  hasPortfolioPhotos: boolean;
}) {
  // The photo's height always tracks whichever is taller: its own normal
  // aspect ratio, or the actual combined height of the name/info + button row
  // + services text beside it — so a card whose right-hand content (multiple
  // links, pills, etc.) runs taller than the photo's usual crop doesn't leave
  // the photo looking short next to it, even before any hover happens. Once
  // the services text expands on hover, the same calculation naturally grows
  // the photo further to keep matching. Driven off a measured pixel height
  // (not a CSS percentage stretch) — feeding a stretch/h-full back into the
  // grid's own row-sizing pass was inflating the row above it instead of
  // leaving its top fixed.
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const [photoHeightPx, setPhotoHeightPx] = useState<number | null>(null);
  // While collapsed, the services block sits flush against the bottom of the
  // card via a measured margin-top (not align-self: end) — that way, once it
  // starts expanding, freezing this same margin keeps its top fixed in place
  // and only its bottom grows, instead of align-self recomputing the top
  // upward every time the content gets taller.
  const [servicesMarginTopPx, setServicesMarginTopPx] = useState<number | null>(null);
  const nameInfoRef = useRef<HTMLDivElement | null>(null);
  const buttonRowRef = useRef<HTMLDivElement | null>(null);
  const servicesBlockRef = useRef<HTMLDivElement | null>(null);
  // The resting (collapsed) photo height and services height, captured the
  // instant expansion starts — growth while expanded is added on top of this
  // frozen baseline rather than recomputed fresh from Math.max(content, floor)
  // each time. That fresh recompute was wrong whenever the floor exceeded the
  // collapsed content need: the floor doesn't know about the (also frozen)
  // margin already tuned to sit the text flush against that floor, so it let
  // the growing text overshoot past the photo's bottom instead of taking the
  // photo with it.
  const baselinePhotoHeightRef = useRef<number>(MIN_PHOTO_HEIGHT_PX);
  const baselineServicesHeightRef = useRef<number>(0);

  // The Instagram link is duplicated below — once inline next to the name
  // (mobile) and once in the button row (desktop) — because the two spots
  // are genuinely different layout positions, not just different styling of
  // the same spot, so a single element can't occupy both. The `sm:hidden` /
  // `hidden sm:inline-flex` pair already keeps only one on screen (and out
  // of the accessibility tree, since a real display:none is excluded from
  // it) at any given viewport, but a static/DOM-level audit that doesn't
  // evaluate media queries still sees two links with an identical accessible
  // name. Mirroring that same breakpoint here as real aria-hidden/tabIndex
  // state (not just a CSS class) means only one ever carries the "Go to X
  // Instagram" name at the attribute level too, satisfying that kind of
  // check as well as a live one.
  const [isSmUp, setIsSmUp] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const syncIsSmUp = (event: MediaQueryList | MediaQueryListEvent) => setIsSmUp(event.matches);
    syncIsSmUp(mediaQuery);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsSmUp);
      return () => mediaQuery.removeEventListener("change", syncIsSmUp);
    }
    mediaQuery.addListener(syncIsSmUp);
    return () => mediaQuery.removeListener(syncIsSmUp);
  }, []);

  useEffect(() => {
    // Both values below are derived from the same measurement pass — reading
    // the margin back from the grid's own computed row sizes in a separate
    // effect meant it could run against last render's (still-hovered) grid
    // dimensions before this render's photo-height update had applied,
    // producing a one-frame mismatch that snapped visibly on unhover.
    const measure = () => {
      const isSmUp = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
      if (!isSmUp) {
        setPhotoHeightPx(null);
        setServicesMarginTopPx(null);
        return;
      }

      const row1Height = Math.max(
        nameInfoRef.current?.getBoundingClientRect().height ?? 0,
        buttonRowRef.current?.getBoundingClientRect().height ?? 0,
      );
      const servicesHeight = servicesBlockRef.current?.getBoundingClientRect().height ?? 0;
      const rowGapPx = 10; // matches the article's sm:gap-y-2.5

      if (!isServicesExpanded) {
        // Collapsed: recompute the resting height fresh every time, matching
        // the right-hand column's content directly — not the photo's own
        // aspect ratio — so the photo's bottom always lands exactly at the
        // services block's bottom. A flat floor (rather than the aspect-ratio
        // height) keeps sparse cards from looking squished.
        const contentNeededHeight = row1Height + rowGapPx + servicesHeight;
        const nextPhotoHeight = Math.max(contentNeededHeight, MIN_PHOTO_HEIGHT_PX);
        setPhotoHeightPx(nextPhotoHeight);
        const row2TrackPx = nextPhotoHeight - row1Height - rowGapPx;
        setServicesMarginTopPx(Math.max(0, row2TrackPx - servicesHeight));
        baselinePhotoHeightRef.current = nextPhotoHeight;
        baselineServicesHeightRef.current = servicesHeight;
      } else {
        // Expanded: grow the frozen baseline photo height by exactly however
        // much the services block has grown past its frozen baseline height —
        // margin-top is left untouched (frozen), so the block's top doesn't
        // move; only its bottom does, and the photo grows in lockstep with it.
        const growthPx = Math.max(0, servicesHeight - baselineServicesHeightRef.current);
        setPhotoHeightPx(baselinePhotoHeightRef.current + growthPx);
      }
    };

    const raf = requestAnimationFrame(measure);
    // Web fonts finishing their load after this first pass can reflow row 1's
    // text (changing its wrapping/height) without a resize event firing.
    // Re-measure once fonts settle to catch that.
    let cancelled = false;
    document.fonts?.ready?.then(() => {
      if (!cancelled) measure();
    });
    // Only watch row 1 (name/info) for its own late reflows here — NOT the
    // services block. Observing the services block's own size caused a race:
    // ServicesSummary grows its own height as soon as the mouse enters, which
    // fires this observer with the *previous* render's isServicesExpanded
    // still false (React hasn't propagated the state change yet), so it
    // recalculated the margin as if still collapsed instead of leaving it
    // frozen — shrinking it to fit the taller text within the same total,
    // which is exactly the "top moves instead of bottom" bug this is meant
    // to prevent. The isServicesExpanded/orderedServices deps below already
    // trigger a fresh measurement once the state genuinely changes.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (nameInfoRef.current) resizeObserver?.observe(nameInfoRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isServicesExpanded, orderedServices]);

  return (
    <StylistCardWrapper result={result} services={activeServices}>
      <article className="flex w-full flex-col gap-2.5 sm:grid sm:items-start sm:gap-x-4 sm:gap-y-2.5 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:grid-rows-[min-content_1fr] lg:grid-cols-[240px_minmax(0,1fr)_auto]">
        {hasPortfolioPhotos ? (
          <PortfolioPhotoCarousel
            result={result}
            photos={portfolioPhotos}
            className="order-1 mb-1 sm:row-span-2 sm:mb-0"
            expandedHeightPx={photoHeightPx}
          />
        ) : (
          <div className="order-1 mb-1 hidden w-full sm:row-span-2 sm:mb-0 sm:block" aria-hidden="true">
            <div
              className={cn(
                "flex w-full items-center justify-center overflow-hidden rounded-none border border-stone-300/60 bg-stone-300 dark:border-stone-700/60 dark:bg-stone-700 transition-[height] duration-300",
                photoHeightPx == null && "aspect-[3/2] sm:aspect-[4/3]",
              )}
              style={photoHeightPx != null ? { height: photoHeightPx } : undefined}
            >
              <PortfolioPlaceholderIcon className="h-full w-full text-stone-100 dark:text-stone-950" />
            </div>
          </div>
        )}

        <div className="min-w-0 order-2" ref={nameInfoRef}>
          <div className="min-w-0 grow">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1 text-[17px] font-semibold text-stone-950 dark:text-stone-50">
                  {result.name}
                </h3>
                {locationLabels.length > 0 || comparablePriceBand(result) ? (
                  <p className="mt-0.5 text-[13px] font-medium text-stone-500 dark:text-stone-400">
                    {locationLabels.join(" · ")}
                    {locationLabels.length > 0 && comparablePriceBand(result) ? " · " : ""}
                    {comparablePriceBand(result)}
                  </p>
                ) : null}
                {reviewsBanner || hairShopLink || attributeLabels.length > 0 ? (
                <div className="mt-1.5 flex flex-col items-start gap-2">
                {reviewsBanner ? (
                  <a
                    href={reviewsBanner.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${reviewsBanner.accessibleLabel} - opens in a new tab`}
                    onClick={() =>
                      trackAnalyticsEvent("verified_reviews_click", {
                        salon: result.name,
                        platform: getVerifiedReviewsPlatform(result) ?? "google",
                      })
                    }
                    className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[oklch(0.45_0.05_255)] transition-colors hover:text-[oklch(0.38_0.06_255)] active:text-[oklch(0.38_0.06_255)] dark:text-[oklch(0.72_0.05_255)] dark:hover:text-[oklch(0.80_0.06_255)] dark:active:text-[oklch(0.80_0.06_255)]"
                  >
                    <span aria-hidden="true">{reviewsBanner.label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : null}
                {hairShopLink ? (
                  <a
                    href={hairShopLink.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${hairShopLink.accessibleLabel} - opens in a new tab`}
                    onClick={() => trackAnalyticsEvent("hair_shop_click", { salon: result.name })}
                    className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[oklch(0.45_0.05_255)] transition-colors hover:text-[oklch(0.38_0.06_255)] active:text-[oklch(0.38_0.06_255)] dark:text-[oklch(0.72_0.05_255)] dark:hover:text-[oklch(0.80_0.06_255)] dark:active:text-[oklch(0.80_0.06_255)]"
                  >
                    <span aria-hidden="true">{hairShopLink.label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : null}
                {attributeLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {attributeLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-block w-fit rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                </div>
                ) : null}
              </div>
              {result.instagramUrl ? (
                <a
                  href={result.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent("instagram_click", {
                      salon: result.name,
                      placement: "mobile",
                    })
                  }
                  aria-hidden={isSmUp}
                  tabIndex={isSmUp ? -1 : 0}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:hidden"
                >
                  <InstagramIcon className="size-4" />
                  <span className="sr-only">Go to {result.name} Instagram - opens in a new tab</span>
                </a>
              ) : null}
            </div>
          </div>

        </div>

        <div
          className="order-4 mt-2 flex w-full shrink-0 items-center gap-2 sm:order-2 sm:mt-0 sm:w-auto sm:self-start sm:justify-self-end"
          ref={buttonRowRef}
        >
          {result.instagramUrl ? (
            <a
              href={result.instagramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackAnalyticsEvent("instagram_click", {
                  salon: result.name,
                  placement: "desktop",
                })
              }
              aria-hidden={!isSmUp}
              tabIndex={isSmUp ? 0 : -1}
              className="hidden min-h-[48px] items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 sm:inline-flex sm:min-h-[40px]"
            >
              <InstagramIcon className="size-4" />
              <span className="sr-only">Go to {result.name} Instagram - opens in a new tab</span>
            </a>
          ) : null}
          {result.bookingPlatform !== "Instagram" ? (
            <a
              href={result.bookingUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackAnalyticsEvent("book_click", {
                  salon: result.name,
                  platform: result.bookingPlatform,
                  location: result.areaLabel,
                  services: activeServices,
                })
              }
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-none bg-stone-950 px-5 py-2 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300 sm:min-h-[40px] sm:flex-none sm:px-4"
            >
              <span aria-hidden="true">Book</span>
              <span className="sr-only">Book {result.name} - opens in a new tab</span>
            </a>
          ) : null}
        </div>

        {orderedServices.length > 0 ? (
          <div
            className="order-3 mt-2 w-full sm:order-3 sm:col-span-2 sm:mt-0 sm:self-start lg:mt-0"
            style={servicesMarginTopPx != null ? { marginTop: servicesMarginTopPx } : undefined}
            ref={servicesBlockRef}
          >
            <div className="border-l-2 border-stone-300 pl-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:text-stone-300">
              <ServicesSummary services={orderedServices} maxLines={2} onExpandedChange={setIsServicesExpanded} />
            </div>
          </div>
        ) : null}
      </article>
    </StylistCardWrapper>
  );
}

function orderServicesBySelection(
  services: string[],
  selectedCategories: ServiceCategoryId[],
  selectedSubcategories: ServiceSubcategoryId[],
  catServiceMap: Record<string, string[]> = categoryServiceMap,
) {
  if (selectedCategories.length === 0 && selectedSubcategories.length === 0) {
    return services;
  }

  const prioritizedServices = new Set<string>(selectedSubcategories);

  selectedCategories.forEach((categoryId) => {
    (catServiceMap[categoryId] ?? []).forEach((service) => {
      prioritizedServices.add(service);
    });
  });

  const matchingServices: string[] = [];
  const remainingServices: string[] = [];

  services.forEach((service) => {
    if (prioritizedServices.has(service)) {
      matchingServices.push(service);
    } else {
      remainingServices.push(service);
    }
  });

  return [...matchingServices, ...remainingServices];
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncPreference = (event: MediaQueryList | MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    syncPreference(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  return prefersReducedMotion;
}

function AnimatedCollapsible({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn("overflow-hidden", className)}
      style={{ height: open ? "auto" : 0 }}
    >
      <div className={cn(open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-0 opacity-0")}>
        {children}
      </div>
    </div>
  );
}

// Matches the text-[12px] leading-[18px] typography every ServicesSummary caller uses.
const SERVICES_SUMMARY_LINE_HEIGHT_PX = 18;

// Floor for the portfolio photo/placeholder height on a listing card — the
// photo otherwise always matches the right-hand column's actual content
// height, but sparse cards (short name, no links/pills, short service list)
// would render an oddly short photo without this minimum.
const MIN_PHOTO_HEIGHT_PX = 160;

function ServicesSummary({
  services,
  badgeLabels,
  maxLines = 1,
  onExpandedChange,
}: {
  services: string[];
  badgeLabels?: string[] | null;
  maxLines?: number;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const labels = badgeLabels ?? [];
  const isMultiLine = maxLines > 1;
  const lineRef = useRef<HTMLDivElement | null>(null);
  const separatorMeasureRef = useRef<HTMLSpanElement | null>(null);
  const badgeCandidateMeasureRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const serviceMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const suffixMeasureRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const shortSuffixMeasureRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const [visibleCount, setVisibleCount] = useState(services.length);
  const [useShortSuffix, setUseShortSuffix] = useState(false);
  const [badgeVisibleCount, setBadgeVisibleCount] = useState(labels.length);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isExpandedOnMobile, setIsExpandedOnMobile] = useState(false);
  const [isHoveredOnDesktop, setIsHoveredOnDesktop] = useState(false);
  const marqueeCopyRef = useRef<HTMLSpanElement | null>(null);
  const [marqueeSeconds, setMarqueeSeconds] = useState(8);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const syncViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    syncViewport(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    const lineElement = lineRef.current;
    const separatorElement = separatorMeasureRef.current;

    if (!lineElement || !separatorElement) {
      return;
    }

    const measure = () => {
      const availableWidth = lineElement.clientWidth;
      const safetyBuffer = 28;
      if (!availableWidth) {
        return;
      }

      const serviceWidths = services.map((_, index) => serviceMeasureRefs.current[index]?.offsetWidth ?? 0);
      const separatorWidth = separatorElement.offsetWidth;

      // The badge is always shown, never part of the truncation count. But a long
      // additional-needs badge (2+ items) shouldn't be allowed to eat the whole
      // line and starve the services list of even a short "+N" indicator — so the
      // badge itself only gets truncated (labels replaced with a trailing "+N")
      // once it would otherwise leave no room for that minimal indicator.
      const shortestServicesIndicatorWidth =
        services.length > 0 ? (shortSuffixMeasureRefs.current[1]?.offsetWidth ?? 0) + separatorWidth : 0;
      const maxBadgeWidth = Math.max(0, availableWidth - safetyBuffer - shortestServicesIndicatorWidth);

      let nextBadgeVisibleCount = labels.length;
      if (labels.length > 1) {
        nextBadgeVisibleCount = 1;
        for (let count = labels.length; count >= 1; count -= 1) {
          const candidateWidth = badgeCandidateMeasureRefs.current[count]?.offsetWidth ?? 0;
          if (candidateWidth <= maxBadgeWidth) {
            nextBadgeVisibleCount = count;
            break;
          }
        }
      }
      setBadgeVisibleCount(nextBadgeVisibleCount);

      const badgeCandidateWidth = labels.length > 0 ? (badgeCandidateMeasureRefs.current[nextBadgeVisibleCount]?.offsetWidth ?? 0) : 0;
      const badgeWidth = labels.length > 0 ? badgeCandidateWidth + (services.length > 0 ? separatorWidth : 0) : 0;

      // Multi-line callers don't actually get more horizontal room per line, just
      // more lines to wrap into — so simulate real greedy line-wrapping (each
      // segment either joins the current line or starts a new one) rather than
      // just comparing total width against a multiplied budget, which let items
      // get cut off mid-word right at a line boundary.
      const lineCapacity = Math.max(1, availableWidth - safetyBuffer);
      const buildSegments = (count: number, hiddenCount: number, useShort: boolean): number[] => {
        const segments: number[] = [];
        if (badgeWidth > 0) segments.push(badgeWidth);
        for (let index = 0; index < count; index += 1) {
          segments.push(serviceWidths[index] + (segments.length > 0 ? separatorWidth : 0));
        }
        if (hiddenCount > 0) {
          const suffixWidth = useShort
            ? (shortSuffixMeasureRefs.current[hiddenCount]?.offsetWidth ?? 0)
            : (suffixMeasureRefs.current[hiddenCount]?.offsetWidth ?? 0);
          segments.push(suffixWidth + (segments.length > 0 ? separatorWidth : 0));
        }
        return segments;
      };
      const fitsInLines = (segments: number[]): boolean => {
        let linesUsed = 1;
        let currentLineWidth = 0;
        for (const width of segments) {
          if (currentLineWidth === 0) {
            currentLineWidth = width;
          } else if (currentLineWidth + width <= lineCapacity) {
            currentLineWidth += width;
          } else {
            linesUsed += 1;
            if (linesUsed > maxLines) return false;
            currentLineWidth = width;
          }
        }
        return true;
      };

      let nextVisibleCount = services.length;
      let nextUseShortSuffix = false;

      outer: for (let count = services.length; count >= 0; count -= 1) {
        const hiddenCount = services.length - count;

        if (hiddenCount === 0) {
          if (fitsInLines(buildSegments(count, 0, false))) {
            nextVisibleCount = count;
            nextUseShortSuffix = false;
            break outer;
          }
          continue;
        }

        if (fitsInLines(buildSegments(count, hiddenCount, false))) {
          nextVisibleCount = count;
          nextUseShortSuffix = false;
          break outer;
        }

        if (fitsInLines(buildSegments(count, hiddenCount, true))) {
          nextVisibleCount = count;
          nextUseShortSuffix = true;
          break outer;
        }

        if (count === 0) {
          // Nothing fits cleanly even with the compact suffix — best effort: show
          // no services and the short indicator rather than clipping mid-word.
          nextVisibleCount = 0;
          nextUseShortSuffix = true;
        }
      }

      setVisibleCount(nextVisibleCount);
      setUseShortSuffix(nextUseShortSuffix);
    };

    measure();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(lineElement);

    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [services, labels.join(" · "), maxLines]);

  useEffect(() => {
    setIsExpandedOnMobile(false);
  }, [services, labels.join(" · ")]);

  useEffect(() => {
    if (isMobileViewport) {
      setIsHoveredOnDesktop(false);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    if (!isHoveredOnDesktop || isMobileViewport || isMultiLine || services.length - visibleCount <= 0) return;
    const copyWidth = marqueeCopyRef.current?.scrollWidth ?? 0;
    const pixelsPerSecond = 55;
    if (copyWidth > 0) {
      setMarqueeSeconds(Math.max(4, copyWidth / pixelsPerSecond));
    }
  }, [isHoveredOnDesktop, isMobileViewport, services.length, visibleCount]);

  const hiddenCount = Math.max(0, services.length - visibleCount);
  const badgeHiddenCount = Math.max(0, labels.length - badgeVisibleCount);
  const fullBadgeText = labels.length > 0 ? labels.join(" · ") : null;
  const collapsedBadgeText =
    labels.length === 0
      ? null
      : badgeHiddenCount > 0
        ? `${labels.slice(0, badgeVisibleCount).join(" · ")} +${badgeHiddenCount}`
        : fullBadgeText;
  const fullServicesLabel = services.map((service) => getServiceDisplayName(service)).join(" · ");
  const fullAriaLabel = fullBadgeText ? `${fullBadgeText} · ${fullServicesLabel}` : fullServicesLabel;
  const isExpandableOnMobile = isMobileViewport && hiddenCount > 0;
  const isExpandableOnDesktop = !isMobileViewport && hiddenCount > 0;
  const showExpandedList = isExpandableOnMobile && isExpandedOnMobile;
  const showExpandedOnDesktop = isExpandableOnDesktop && isHoveredOnDesktop;

  useEffect(() => {
    onExpandedChange?.(isMultiLine && showExpandedOnDesktop);
  }, [isMultiLine, showExpandedOnDesktop, onExpandedChange]);

  const badgeClassName =
    "mr-1.5 inline-block rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]";
  // The full, untruncated badge — used whenever the whole services line is
  // expanded (tapped open on mobile, or hovered on desktop), same as it should
  // normally behave.
  const badgeElement = fullBadgeText ? <span className={badgeClassName}>{fullBadgeText}</span> : null;
  // The collapsed badge may be shorter, with a trailing "+N" for any
  // additional-needs labels that don't fit (e.g. a salon with 3+ needs).
  const collapsedBadgeElement = collapsedBadgeText ? <span className={badgeClassName}>{collapsedBadgeText}</span> : null;
  const collapsedSummary = (
    <>
      {collapsedBadgeElement}
      {services.slice(0, visibleCount).map((service, index) => (
        <Fragment key={`${service}-${index}`}>
          {index > 0 ? <span className="text-stone-500/70 dark:text-stone-500/80"> · </span> : null}
          <span>{getServiceDisplayName(service)}</span>
        </Fragment>
      ))}
      {hiddenCount > 0 ? (
        <>
          {visibleCount > 0 ? <span className="text-stone-500/70 dark:text-stone-500/80"> · </span> : null}
          <span className="text-stone-600 dark:text-stone-400">
            {useShortSuffix ? `+${hiddenCount}` : `+ ${hiddenCount} ${hiddenCount === 1 ? "service" : "services"}`}
          </span>
        </>
      ) : null}
    </>
  );

  return (
    <div
      className="relative"
      onMouseEnter={isExpandableOnDesktop ? () => setIsHoveredOnDesktop(true) : undefined}
      onMouseLeave={isExpandableOnDesktop ? () => setIsHoveredOnDesktop(false) : undefined}
    >
      {/* aria-label on a plain, non-widget div isn't reliably announced by
          every screen reader when sweeping through page content (NVDA's
          browse mode in particular still reads the div's own visible text,
          "+N services" included) — so the truncated/marquee visuals below
          are hidden from the accessibility tree outright, and the real,
          untruncated list is exposed as ordinary (visually hidden) text
          instead, which every screen reader reads the same way. */}
      {isExpandableOnMobile ? (
        <>
          <button
            type="button"
            onClick={() => setIsExpandedOnMobile((current) => !current)}
            aria-expanded={isExpandedOnMobile}
            aria-label={`${isExpandedOnMobile ? "Hide" : "Show"} full services list`}
            className="absolute inset-x-0 -inset-y-1 z-10 block"
          />
          <div
            ref={lineRef}
            aria-hidden="true"
            className={cn(
              showExpandedList
                ? "whitespace-normal"
                : isMultiLine
                  ? "overflow-hidden whitespace-normal"
                  : "overflow-hidden whitespace-nowrap",
            )}
            style={!showExpandedList && isMultiLine ? { maxHeight: SERVICES_SUMMARY_LINE_HEIGHT_PX * maxLines } : undefined}
          >
            {showExpandedList ? <>{badgeElement}{fullServicesLabel}</> : collapsedSummary}
          </div>
        </>
      ) : showExpandedOnDesktop && isMultiLine ? (
        <div ref={lineRef} aria-hidden="true" className="whitespace-normal">
          {badgeElement}
          {fullServicesLabel}
        </div>
      ) : showExpandedOnDesktop ? (
        <div ref={lineRef} aria-hidden="true" className="overflow-hidden whitespace-nowrap">
          <div className="inline-flex whitespace-nowrap" style={{ animation: `services-marquee ${marqueeSeconds}s linear infinite` }}>
            <span ref={marqueeCopyRef} className="inline-flex items-center pr-8">
              {badgeElement}
              {fullServicesLabel}
            </span>
            <span aria-hidden="true" className="inline-flex items-center pr-8">
              {badgeElement}
              {fullServicesLabel}
            </span>
          </div>
        </div>
      ) : (
        <div
          ref={lineRef}
          aria-hidden="true"
          className={cn(isMultiLine ? "overflow-hidden whitespace-normal" : "overflow-hidden whitespace-nowrap")}
          style={isMultiLine ? { maxHeight: SERVICES_SUMMARY_LINE_HEIGHT_PX * maxLines } : undefined}
        >
          {collapsedSummary}
        </div>
      )}
      <span className="sr-only">{fullAriaLabel}</span>

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0" aria-hidden="true">
        <span ref={separatorMeasureRef} className="text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em]">
          {" · "}
        </span>
        {services.map((service, index) => (
          <span
            key={`measure-${service}-${index}`}
            ref={(element) => {
              serviceMeasureRefs.current[index] = element;
            }}
            className="inline-block text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em]"
          >
            {getServiceDisplayName(service)}
          </span>
        ))}
        {services.map((_, hiddenCountIndex) => {
          const count = hiddenCountIndex + 1;

          return (
            <span
              key={`suffix-${count}`}
              ref={(element) => {
                suffixMeasureRefs.current[count] = element;
              }}
              className="inline-block text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em]"
            >
              + {count} {count === 1 ? "service" : "services"}
            </span>
          );
        })}
        {services.map((_, hiddenCountIndex) => {
          const count = hiddenCountIndex + 1;

          return (
            <span
              key={`short-suffix-${count}`}
              ref={(element) => {
                shortSuffixMeasureRefs.current[count] = element;
              }}
              className="inline-block text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em]"
            >
              +{count}
            </span>
          );
        })}
        {labels.map((_, index) => {
          const count = index + 1;
          const hidden = labels.length - count;
          const text = hidden > 0 ? `${labels.slice(0, count).join(" · ")} +${hidden}` : labels.join(" · ");

          return (
            <span
              key={`badge-candidate-${count}`}
              ref={(element) => {
                badgeCandidateMeasureRefs.current[count] = element;
              }}
              className={badgeClassName}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type RuntimeCategory = { id: string; label: string; subcategories: string[] };
type RuntimeFilterConfig = {
  categories: RuntimeCategory[];
  parentGroups: RegionParentGroup[];
  standaloneRegionIds: string[];
  regions: { id: string; label: string }[];
};
type CustomFilterType = {
  id: string;
  label: string;
  description: string;
  behavior: "toggle-group" | "tag-multiselect";
  options: { id: string; label: string }[];
};

const terminalServiceCategoryIds = new Set<string>(["bridal-services", "editorial-services"]);

function normalizeRuntimeCategory(category: RuntimeCategory): RuntimeCategory {
  if (!terminalServiceCategoryIds.has(category.id)) {
    return category;
  }

  return { ...category, subcategories: [] };
}

function buildRuntimeConfig(
  apiCategories: RuntimeCategory[],
  apiLocations: { regions: { id: string; label: string }[]; parentGroups: { parentId: string; childIds: string[] }[]; standaloneIds: string[] } | null,
): RuntimeFilterConfig {
  const regionsWithAll = apiLocations
    ? [{ id: "all", label: "All locations" }, ...apiLocations.regions.filter((r) => r.id !== "all")]
    : null;
  const parentGroups = apiLocations
    ? apiLocations.parentGroups
        .map((group) => {
          const parent = apiLocations.regions.find((r) => r.id === group.parentId);
          return parent ? { id: parent.id, label: parent.label, childIds: group.childIds } : null;
        })
        .filter((group): group is RegionParentGroup => Boolean(group))
    : defaultRegionParentGroups;
  return {
    categories: [{ id: "all", label: "All services", subcategories: [] }, ...apiCategories.map(normalizeRuntimeCategory)],
    parentGroups,
    standaloneRegionIds: apiLocations?.standaloneIds ?? [...standaloneRegionIds],
    regions: regionsWithAll ?? regions.map((r) => ({ id: r.id, label: r.label })),
  };
}

const defaultFilterConfig: RuntimeFilterConfig = {
  categories: [
    { id: "all", label: "All services", subcategories: [] },
    ...Object.entries(categoryMap)
      .filter(([id]) => id !== "all")
      .map(([id, cat]) => normalizeRuntimeCategory({ id, label: cat.label, subcategories: cat.subcategories.filter((s) => s !== "all") as string[] })),
  ],
  parentGroups: defaultRegionParentGroups,
  standaloneRegionIds: [...standaloneRegionIds],
  regions: regions.map((r) => ({ id: r.id, label: r.label })),
};

function VendorCard({ vendor }: { vendor: VendorResult }) {
  const browseUrl = vendor.hairShopUrl || vendor.websiteUrl;
  const browseUrlIsInstagram = Boolean(browseUrl && isInstagramUrl(browseUrl));
  const linkedStylist = vendor.linkedStylist;

  return (
    <li className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-6 text-left last:border-b-0 dark:border-stone-800">
      <article className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 grow">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">{vendor.name}</h3>
            {linkedStylist ? (
              <span className="inline-block rounded-none border border-stone-300 bg-stone-100 px-1.5 py-1 text-[11px] font-semibold leading-none tracking-[0.06em] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
                Hairstylist-owned
              </span>
            ) : null}
          </div>
          {vendor.areaLabel && vendor.fulfilment.includes("Can collect in person / at appointment") ? (
            <p className="mt-0.5 text-[13px] font-medium text-stone-500 dark:text-stone-400">{vendor.areaLabel}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {vendor.instagramUrl && !browseUrlIsInstagram ? (
            <a
              href={vendor.instagramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAnalyticsEvent("vendor_instagram_click", { vendor: vendor.name })}
              className="inline-flex min-h-11 min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-2 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800"
            >
              <InstagramIcon className="size-4" />
              <span className="sr-only">Go to {vendor.name} Instagram - opens in a new tab</span>
            </a>
          ) : null}
          {browseUrl && browseUrlIsInstagram ? (
            <a
              href={browseUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAnalyticsEvent("vendor_instagram_click", { vendor: vendor.name, source: "hair-shop-link" })}
              className="inline-flex min-h-11 min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-2 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800"
            >
              <InstagramIcon className="size-4" />
              <span className="sr-only">Go to {vendor.name} hair shop on Instagram - opens in a new tab</span>
            </a>
          ) : browseUrl ? (
            <a
              href={browseUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAnalyticsEvent("vendor_link_click", { vendor: vendor.name, label: "Browse" })}
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-none bg-stone-950 px-4 py-2 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300"
            >
              <span aria-hidden="true">Browse</span>
              <span className="sr-only"> - opens in a new tab</span>
            </a>
          ) : null}
        </div>
      </article>

      {vendor.productTypes.length > 0 || vendor.fulfilment.length > 0 ? (
        <div className="w-full rounded-none border-l-4 border-stone-300 bg-stone-200/45 pl-2 pr-3 py-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:bg-stone-900/48 dark:text-stone-300">
          <ServicesSummary services={vendor.productTypes} badgeLabels={vendor.fulfilment} />
        </div>
      ) : null}

      {linkedStylist ? (
        <div className="w-full">
          <div className="w-full divide-y divide-stone-200 border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {linkedStylist.branches.map((branch) => {
              const stylistInstagramUrl = linkedStylist.instagramUrl || null;
              return (
                <div key={branch.id} className="flex items-start justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-stone-950 dark:text-stone-50">{branch.label}</p>
                    {branch.areaLabel ? <p className="text-[13px] text-stone-500 dark:text-stone-400">{branch.areaLabel}</p> : null}
                    {linkedStylist.priceIncludesHair ? (
                      <span className="mt-2.5 block w-fit rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]">
                        hair-inclusive packages
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {stylistInstagramUrl ? (
                      <a
                        href={stylistInstagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackAnalyticsEvent("instagram_click", { salon: branch.label, placement: "linked-stylist" })}
                        className="inline-flex min-h-[48px] min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-2 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:min-h-[40px]"
                      >
                        <InstagramIcon className="size-4" />
                        <span className="sr-only">Go to {branch.label} Instagram - opens in a new tab</span>
                      </a>
                    ) : null}
                    {branch.bookingUrl && branch.bookingPlatform !== "Instagram" ? (
                      <a
                        href={branch.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() =>
                          trackAnalyticsEvent("book_click", {
                            salon: branch.label,
                            platform: branch.bookingPlatform ?? undefined,
                            location: branch.areaLabel ?? undefined,
                            services: "none",
                          })
                        }
                        className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-none border border-stone-400 bg-transparent px-4 py-2 text-[13px] font-medium text-stone-800 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:border-stone-600 dark:bg-transparent dark:text-stone-200 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:min-h-[40px]"
                      >
                        <span aria-hidden="true">Book</span>
                        <span className="sr-only">Book {branch.label} - opens in a new tab</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function VendorResultsList({
  vendors,
  isSearching,
  searchError,
  hasSearched,
  onResetFilters,
}: {
  vendors: VendorResult[];
  isSearching: boolean;
  searchError: string | null;
  hasSearched: boolean;
  onResetFilters: () => void;
}) {
  return (
    <>
      {searchError ? (
        <div className="mt-4 bg-rose-100 px-4 py-6 text-left dark:bg-rose-950/30">
          <h3 className="text-[17px] font-semibold text-rose-900 dark:text-rose-200">Something went wrong</h3>
          <p className="mt-2 text-sm leading-7 text-rose-800 dark:text-rose-300">You can:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7 text-rose-800 dark:text-rose-300">
            <li>
              Refresh or{" "}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline text-rose-900 underline decoration-current underline-offset-4 transition-colors hover:text-rose-700 dark:text-rose-100 dark:hover:text-rose-200"
              >
                Try again
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      {isSearching ? (
        <ul className="flex w-full list-none flex-col items-start" aria-hidden="true">
          {Array.from({ length: RESULTS_SKELETON_COUNT }, (_, index) => (
            <li
              key={`vendor-skeleton-${index}`}
              className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-6 text-left last:border-b-0 dark:border-stone-800"
            >
              <div className="h-6 w-48 animate-pulse rounded-[4px] bg-stone-300/70 dark:bg-stone-800/70" />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="h-6 w-24 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
                <span className="h-6 w-20 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
              </div>
            </li>
          ))}
        </ul>
      ) : !searchError ? (
        <ul className="flex w-full list-none flex-col items-start">
          {vendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </ul>
      ) : null}

      {!isSearching && !searchError && hasSearched && vendors.length === 0 ? (
        <div className="mt-4 bg-stone-200 px-4 py-6 text-left dark:bg-stone-900/60">
          <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">No hair vendors found</h3>
          <p className="mt-2 text-sm leading-7 text-stone-700 dark:text-stone-300">You can:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7 text-stone-700 dark:text-stone-300">
            <li>
              Change your filters, or{" "}
              <button
                type="button"
                onClick={onResetFilters}
                className="inline text-stone-950 underline underline-offset-4 transition-colors hover:text-stone-700 dark:text-stone-100 dark:hover:text-stone-300"
              >
                reset
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

const submissionNeedFields = [
  {
    field: "hijabiFriendly",
    label: "Hijabi-friendly",
    description:
      "Female-only space, not in view of any windows. The space / salon could be hijabi-friendly all the time, or only on specific days. The whole space could be hijabi-friendly, or there could be a private section of the space.",
  },
  { field: "canBraidWithoutGel", label: "Can braid without gel", description: "For clients with sensitive scalps, its important that they can get their braids done without the use of gel or hair wax." },
  { field: "wheelchairAccessible", label: "Wheelchair accessible entrance", description: "The venue has step-free access at the entrance." },
  { field: "senFriendly", label: "Sensory-safe / SEN-friendly", description: "The salon accommodates the needs of neurodivergent clients, or clients with Special Educational Needs." },
  { field: "lgbtqFriendly", label: "LGBTQIA+-friendly", description: "A welcoming, inclusive space for LGBTQIA+ clients." },
  { field: "sameDayEmergency", label: "Same-day / walk-ins", description: "Can take clients without needing to book in advance." },
  { field: "sellsHairSeparately", label: "Hair sold separately", description: "Sells hair, but you must buy it separately from appointment bookings." },
  { field: "priceIncludesHair", label: "Hair-inclusive packages available", description: "Some items in the service menu include the cost of wigs/extensions/braiding hair in the price." },
] as const;
type SubmissionNeedField = (typeof submissionNeedFields)[number]["field"];
const defaultSubmissionNeeds = Object.fromEntries(submissionNeedFields.map((item) => [item.field, false])) as Record<SubmissionNeedField, boolean>;
// "Sells hair" is a UI-only grouping toggle (not its own stored field,
// mirroring the public search filter's "Sells hair" parent) that reveals
// these two once checked, same as toggleSellingHair() does for search.
const submissionSellsHairSeparatelyField = submissionNeedFields.find((item) => item.field === "sellsHairSeparately")!;
const submissionPriceIncludesHairField = submissionNeedFields.find((item) => item.field === "priceIncludesHair")!;

function SubmissionNeedCheckbox({
  label,
  description,
  checked,
  onChange,
  indent,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  indent?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-8 cursor-pointer items-center gap-3 rounded-none px-1 py-1 text-[14px] font-medium text-stone-800 transition hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-900",
        indent && "ml-7",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded-none border-stone-400 accent-stone-950"
      />
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span title={description}>
          <Info className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        </span>
      </span>
    </label>
  );
}

// Profile URLs put the handle in the first path segment; anything else
// (p/, reel/, explore/, stories/) is a post or feature link, not a profile,
// so there's no handle worth turning into a name.
const INSTAGRAM_NON_PROFILE_SEGMENTS = new Set(["p", "reel", "reels", "explore", "stories", "tv"]);

function deriveNameFromInstagramUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  let pathname: string;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    pathname = new URL(withProtocol).pathname;
  } catch {
    return "";
  }

  const handle = pathname.split("/").filter(Boolean)[0];
  if (!handle || INSTAGRAM_NON_PROFILE_SEGMENTS.has(handle.toLowerCase())) return "";

  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Tolerant of a missing "https://" (plenty of visitors just paste the bare
// instagram.com/... part) but otherwise strict — the host must actually be
// instagram.com, so a link to some other site can't slip through as the
// "Instagram link" and end up rendered as a broken Instagram icon later.
function normalizeUrlProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isInstagramProfileUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(normalizeUrlProtocol(trimmed));
  } catch {
    return false;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "instagram.com") return false;

  const handle = parsed.pathname.split("/").filter(Boolean)[0];
  return Boolean(handle) && !INSTAGRAM_NON_PROFILE_SEGMENTS.has(handle.toLowerCase());
}

function SubmissionLinkField({
  label,
  icon,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  required,
  error,
  children,
}: {
  label: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  children?: ReactNode;
}) {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-600 dark:text-stone-400">
        {icon}
        {label}
      </label>
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        type="url"
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="text-[12px] text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export default function App() {
  if (window.location.pathname.startsWith("/admin/stylists")) {
    return <AdminApp />;
  }

  const [filterConfig, setFilterConfig] = useState<RuntimeFilterConfig>(defaultFilterConfig);
  const [priceBandTiers, setPriceBandTiers] = useState<PriceBandTier[]>(defaultPriceBandTiers);
  const priceRangeOptions = getPriceRangeOptions(priceBandTiers);
  const [customFilterTypes, setCustomFilterTypes] = useState<CustomFilterType[]>([]);
  const [selectedCustomFilters, setSelectedCustomFilters] = useState<Record<string, string[]>>({});
  const [draftSelectedCustomFilters, setDraftSelectedCustomFilters] = useState<Record<string, string[]>>({});
  const [openCustomFilterTypeId, setOpenCustomFilterTypeId] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<RegionId[]>(["all"]);
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategoryId[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<ServiceSubcategoryId[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceSearchAliases, setServiceSearchAliases] = useState<Record<string, string[]>>(defaultServiceSearchAliases);
  const [results, setResults] = useState<SalonResult[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const shuffleKeysRef = useRef<Map<string, number>>(new Map());
  const getShuffleKey = useCallback((id: string) => {
    let key = shuffleKeysRef.current.get(id);
    if (key === undefined) {
      key = Math.random();
      shuffleKeysRef.current.set(id, key);
    }
    return key;
  }, []);
  const [draftSelectedRegions, setDraftSelectedRegions] = useState<RegionId[]>(["all"]);
  const [draftSelectedCategories, setDraftSelectedCategories] = useState<ServiceCategoryId[]>([]);
  const [draftSelectedSubcategories, setDraftSelectedSubcategories] = useState<ServiceSubcategoryId[]>([]);
  const [draftSelectedPriceBands, setDraftSelectedPriceBands] = useState<PriceRangeFilterId[]>([]);
  const [draftSelectedHijabiFriendly, setDraftSelectedHijabiFriendly] = useState(false);
  const [draftSelectedCanBraidWithoutGel, setDraftSelectedCanBraidWithoutGel] = useState(false);
  const [draftSelectedWheelchairAccessible, setDraftSelectedWheelchairAccessible] = useState(false);
  const [draftSelectedSenFriendly, setDraftSelectedSenFriendly] = useState(false);
  const [draftSelectedLgbtqFriendly, setDraftSelectedLgbtqFriendly] = useState(false);
  const [draftSelectedParkingAvailable, setDraftSelectedParkingAvailable] = useState(false);
  const [draftSelectedSellingHair, setDraftSelectedSellingHair] = useState(false);
  const [draftSelectedPriceIncludesHair, setDraftSelectedPriceIncludesHair] = useState(false);
  const [draftSelectedSellsHairSeparately, setDraftSelectedSellsHairSeparately] = useState(false);
  const [draftSelectedSameDayEmergency, setDraftSelectedSameDayEmergency] = useState(false);
  const [draftSelectedVendorProductTypeGroups, setDraftSelectedVendorProductTypeGroups] = useState<string[]>([]);
  const [draftSelectedVendorProductTypes, setDraftSelectedVendorProductTypes] = useState<string[]>([]);
  const [draftSelectedVendorFulfilment, setDraftSelectedVendorFulfilment] = useState<string[]>([]);
  const [draftSelectedHairstylistOwned, setDraftSelectedHairstylistOwned] = useState(false);
  const [draftSelectedHasVerifiedReviews, setDraftSelectedHasVerifiedReviews] = useState(false);
  const [draftSelectedGoogleReviewsOnly, setDraftSelectedGoogleReviewsOnly] = useState(false);
  const [draftSelectedBookingSitesOnly, setDraftSelectedBookingSitesOnly] = useState(false);
  const [draftSortOption, setDraftSortOption] = useState<SortOption>("default");
  const [visibleResultCount, setVisibleResultCount] = useState(RESULTS_BATCH_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const submissionServicesInputId = useId();
  const submissionServicesHintId = useId();
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [siteDisclaimerModalOpen, setSiteDisclaimerModalOpen] = useState(false);
  const [submissionName, setSubmissionName] = useState("");
  const [submissionIsProvider, setSubmissionIsProvider] = useState(false);
  const [submissionInstagramUrl, setSubmissionInstagramUrl] = useState("");
  // Only show the "that's not a valid Instagram link" error once the visitor
  // has actually left the field — not on every keystroke while they're still
  // typing a partial URL.
  const [submissionInstagramTouched, setSubmissionInstagramTouched] = useState(false);
  // Tracks the last name we auto-filled from the Instagram handle, so we only
  // keep overwriting the Name field while the user hasn't typed their own
  // value over it.
  const submissionAutoNameRef = useRef("");
  const [submissionBookingUrl, setSubmissionBookingUrl] = useState("");
  const [submissionBookingSameAsInstagram, setSubmissionBookingSameAsInstagram] = useState(false);
  const [submissionAreaIds, setSubmissionAreaIds] = useState<string[]>([]);
  const [submissionNeeds, setSubmissionNeeds] = useState<Record<SubmissionNeedField, boolean>>(defaultSubmissionNeeds);
  const [submissionSellsHair, setSubmissionSellsHair] = useState(false);
  const [submissionCustomFilters, setSubmissionCustomFilters] = useState<Record<string, string[]>>({});
  const [submissionRawServices, setSubmissionRawServices] = useState("");
  const [submissionServices, setSubmissionServices] = useState<string[]>([]);
  const [submissionServiceQuery, setSubmissionServiceQuery] = useState("");
  // Guards the debounced suggest-services fetch: only refires when the
  // trimmed link actually changed, so repeated blurs on an unedited field
  // don't trigger another outbound request.
  const lastSuggestedLinkRef = useRef("");
  const [submissionHoneypot, setSubmissionHoneypot] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISCLAIMER_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissDisclaimer = useCallback(() => {
    setDisclaimerDismissed(true);
    try {
      localStorage.setItem(DISCLAIMER_DISMISSED_KEY, "1");
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — dismissal just won't persist.
    }
  }, []);
  const disclaimerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Push the button up from the bottom while the visitor is scrolling back
    // up (the moment they'd want a shortcut to the top) and hide it again the
    // instant they resume scrolling down, rather than leaving it pinned the
    // whole time they're reading further down the list.
    let lastScrollY = window.scrollY;
    // Momentum/inertial scrolling (trackpads, mobile) commonly overshoots and
    // settles back up by a few pixels right as a downward scroll ends — a
    // naive "any upward delta" check would misread that as the visitor
    // scrolling up and reveal the button right after they scrolled down.
    // Requiring a small sustained upward distance (reset on every downward
    // tick) filters that out while still reacting immediately to a real
    // scroll-up gesture.
    let upwardDistance = 0;
    const BACK_TO_TOP_REVEAL_THRESHOLD = 400;
    const MIN_SUSTAINED_UPWARD_SCROLL = 24;
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      if (currentScrollY <= BACK_TO_TOP_REVEAL_THRESHOLD) {
        setShowBackToTop(false);
        upwardDistance = 0;
      } else if (delta < 0) {
        upwardDistance -= delta;
        if (upwardDistance >= MIN_SUSTAINED_UPWARD_SCROLL) {
          setShowBackToTop(true);
        }
      } else if (delta > 0) {
        upwardDistance = 0;
        setShowBackToTop(false);
      }
      lastScrollY = currentScrollY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    if (disclaimerDismissed) return;
    const node = disclaimerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          dismissDisclaimer();
        }
      },
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disclaimerDismissed, dismissDisclaimer]);
  const [selectedHijabiFriendly, setSelectedHijabiFriendly] = useState(false);
  const [selectedCanBraidWithoutGel, setSelectedCanBraidWithoutGel] = useState(false);
  const [selectedWheelchairAccessible, setSelectedWheelchairAccessible] = useState(false);
  const [selectedSenFriendly, setSelectedSenFriendly] = useState(false);
  const [selectedLgbtqFriendly, setSelectedLgbtqFriendly] = useState(false);
  const [selectedParkingAvailable, setSelectedParkingAvailable] = useState(false);
  const [selectedSellingHair, setSelectedSellingHair] = useState(false);
  const [selectedPriceIncludesHair, setSelectedPriceIncludesHair] = useState(false);
  const [selectedSellsHairSeparately, setSelectedSellsHairSeparately] = useState(false);
  const [selectedSameDayEmergency, setSelectedSameDayEmergency] = useState(false);
  const [selectedVendorProductTypeGroups, setSelectedVendorProductTypeGroups] = useState<string[]>([]);
  const [selectedVendorProductTypes, setSelectedVendorProductTypes] = useState<string[]>([]);
  const [selectedVendorFulfilment, setSelectedVendorFulfilment] = useState<string[]>([]);
  const [selectedHairstylistOwned, setSelectedHairstylistOwned] = useState(false);
  const [selectedHasVerifiedReviews, setSelectedHasVerifiedReviews] = useState(false);
  const [selectedGoogleReviewsOnly, setSelectedGoogleReviewsOnly] = useState(false);
  const [selectedBookingSitesOnly, setSelectedBookingSitesOnly] = useState(false);
  const [selectedPriceBands, setSelectedPriceBands] = useState<PriceRangeFilterId[]>([]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [priceRangesOpen, setPriceRangesOpen] = useState(false);
  const [additionalNeedsOpen, setAdditionalNeedsOpen] = useState(false);
  const [reviewsFilterOpen, setReviewsFilterOpen] = useState(false);
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>("stylists");
  const [vendorFilterOptions, setVendorFilterOptions] = useState<{ productTypes: string[]; fulfilment: string[] }>({
    productTypes: [],
    fulfilment: [],
  });
  const [vendorResults, setVendorResults] = useState<VendorResult[]>([]);
  const [isSearchingVendors, setIsSearchingVendors] = useState(false);
  const [vendorSearchError, setVendorSearchError] = useState<string | null>(null);
  const [hasSearchedVendors, setHasSearchedVendors] = useState(false);
  const [vendorProductTypesOpen, setVendorProductTypesOpen] = useState(false);
  const [vendorFulfilmentOpen, setVendorFulfilmentOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMobileModalEditing = mobileFiltersOpen && !isDesktopViewport;
  const currentSelectedRegions = isMobileModalEditing ? draftSelectedRegions : selectedRegions;
  const currentSelectedCategories = isMobileModalEditing ? draftSelectedCategories : selectedCategories;
  const currentSelectedSubcategories = isMobileModalEditing ? draftSelectedSubcategories : selectedSubcategories;
  const currentSelectedPriceBands = isMobileModalEditing ? draftSelectedPriceBands : selectedPriceBands;
  const currentSelectedHijabiFriendly = isMobileModalEditing ? draftSelectedHijabiFriendly : selectedHijabiFriendly;
  const currentSelectedCanBraidWithoutGel = isMobileModalEditing ? draftSelectedCanBraidWithoutGel : selectedCanBraidWithoutGel;
  const currentSelectedWheelchairAccessible = isMobileModalEditing ? draftSelectedWheelchairAccessible : selectedWheelchairAccessible;
  const currentSelectedSenFriendly = isMobileModalEditing ? draftSelectedSenFriendly : selectedSenFriendly;
  const currentSelectedLgbtqFriendly = isMobileModalEditing ? draftSelectedLgbtqFriendly : selectedLgbtqFriendly;
  const currentSelectedParkingAvailable = isMobileModalEditing ? draftSelectedParkingAvailable : selectedParkingAvailable;
  const currentSelectedSellingHair = isMobileModalEditing ? draftSelectedSellingHair : selectedSellingHair;
  const currentSelectedPriceIncludesHair = isMobileModalEditing ? draftSelectedPriceIncludesHair : selectedPriceIncludesHair;
  const currentSelectedSellsHairSeparately = isMobileModalEditing ? draftSelectedSellsHairSeparately : selectedSellsHairSeparately;
  const currentSelectedSameDayEmergency = isMobileModalEditing ? draftSelectedSameDayEmergency : selectedSameDayEmergency;
  const showSellingHairSubfilters = currentSelectedSellingHair || currentSelectedPriceIncludesHair || currentSelectedSellsHairSeparately;
  const currentSelectedVendorProductTypeGroups = isMobileModalEditing ? draftSelectedVendorProductTypeGroups : selectedVendorProductTypeGroups;
  const currentSelectedVendorProductTypes = isMobileModalEditing ? draftSelectedVendorProductTypes : selectedVendorProductTypes;
  const currentSelectedVendorFulfilment = isMobileModalEditing ? draftSelectedVendorFulfilment : selectedVendorFulfilment;
  const currentSelectedHairstylistOwned = isMobileModalEditing ? draftSelectedHairstylistOwned : selectedHairstylistOwned;
  const currentSelectedHasVerifiedReviews = isMobileModalEditing ? draftSelectedHasVerifiedReviews : selectedHasVerifiedReviews;
  const currentSelectedGoogleReviewsOnly = isMobileModalEditing ? draftSelectedGoogleReviewsOnly : selectedGoogleReviewsOnly;
  const currentSelectedBookingSitesOnly = isMobileModalEditing ? draftSelectedBookingSitesOnly : selectedBookingSitesOnly;
  const currentSelectedCustomFilters = isMobileModalEditing ? draftSelectedCustomFilters : selectedCustomFilters;
  const currentSortOption = isMobileModalEditing ? draftSortOption : sortOption;

  // Runtime filter data from API (falls back to hardcoded values on load)
  const runtimeCategories = filterConfig.categories;
  const runtimeParentGroups = filterConfig.parentGroups;
  const runtimeStandaloneIds = filterConfig.standaloneRegionIds;
  const runtimeRegions = filterConfig.regions;
  const runtimeSortedCategoryEntries: [string, { label: string; subcategories: string[] }][] = [
    ...runtimeCategories.filter((c) => c.id === "all").map((c) => [c.id, { label: c.label, subcategories: ["all", ...c.subcategories] }] as [string, { label: string; subcategories: string[] }]),
    ...runtimeCategories.filter((c) => c.id !== "all").sort((a, b) => a.label.localeCompare(b.label)).map((c) => [c.id, { label: c.label, subcategories: ["all", ...c.subcategories] }] as [string, { label: string; subcategories: string[] }]),
  ];
  const runtimeCategoryServiceMap = Object.fromEntries(
    runtimeCategories.filter((c) => c.id !== "all").map((c) => [c.id, c.subcategories.length ? c.subcategories : [...(categoryServiceMap[c.id as ServiceCategoryId] ?? [])]])
  );
  const submissionServiceGroups = runtimeCategories
    .filter((c) => c.id !== "all")
    .map((c) => ({ id: c.id, label: c.label, services: runtimeCategoryServiceMap[c.id] ?? [] }))
    .filter((group) => group.services.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  const normalizedSubmissionServiceQuery = submissionServiceQuery.trim().toLowerCase();
  const filteredSubmissionServiceGroups = normalizedSubmissionServiceQuery
    ? submissionServiceGroups
        .map((group) => ({ ...group, services: group.services.filter((service) => service.toLowerCase().includes(normalizedSubmissionServiceQuery)) }))
        .filter((group) => group.services.length > 0)
    : submissionServiceGroups;

  function syncDraftFiltersFromApplied() {
    setDraftSelectedRegions(selectedRegions);
    setDraftSelectedCategories(selectedCategories);
    setDraftSelectedSubcategories(selectedSubcategories);
    setDraftSelectedPriceBands(selectedPriceBands);
    setDraftSelectedHijabiFriendly(selectedHijabiFriendly);
    setDraftSelectedCanBraidWithoutGel(selectedCanBraidWithoutGel);
    setDraftSelectedWheelchairAccessible(selectedWheelchairAccessible);
    setDraftSelectedSenFriendly(selectedSenFriendly);
    setDraftSelectedLgbtqFriendly(selectedLgbtqFriendly);
    setDraftSelectedParkingAvailable(selectedParkingAvailable);
    setDraftSelectedSellingHair(selectedSellingHair);
    setDraftSelectedPriceIncludesHair(selectedPriceIncludesHair);
    setDraftSelectedSellsHairSeparately(selectedSellsHairSeparately);
    setDraftSelectedSameDayEmergency(selectedSameDayEmergency);
    setDraftSelectedVendorProductTypeGroups(selectedVendorProductTypeGroups);
    setDraftSelectedVendorProductTypes(selectedVendorProductTypes);
    setDraftSelectedVendorFulfilment(selectedVendorFulfilment);
    setDraftSelectedHairstylistOwned(selectedHairstylistOwned);
    setDraftSelectedHasVerifiedReviews(selectedHasVerifiedReviews);
    setDraftSelectedGoogleReviewsOnly(selectedGoogleReviewsOnly);
    setDraftSelectedBookingSitesOnly(selectedBookingSitesOnly);
    setDraftSelectedCustomFilters(selectedCustomFilters);
    setDraftSortOption(sortOption);
  }

  function copyFooterEmail() {
    navigator.clipboard.writeText("hello@row-k.london").then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  }

  function openSubmissionModal(source: "hero" | "footer" | "zero_results") {
    trackAnalyticsEvent("stylist_submit_opened", { source });
    setSubmissionStatus("idle");
    setSubmissionError(null);
    setSubmissionModalOpen(true);
  }

  function openPrivacyModal() {
    setPrivacyModalOpen(true);
  }

  function closePrivacyModal() {
    setPrivacyModalOpen(false);
  }

  function openSiteDisclaimerModal() {
    setSiteDisclaimerModalOpen(true);
  }

  function closeSiteDisclaimerModal() {
    setSiteDisclaimerModalOpen(false);
  }

  function closeSubmissionModal() {
    setSubmissionModalOpen(false);
    if (submissionStatus === "success") {
      setSubmissionName("");
      setSubmissionIsProvider(false);
      setSubmissionInstagramUrl("");
      setSubmissionInstagramTouched(false);
      setSubmissionBookingUrl("");
      setSubmissionBookingSameAsInstagram(false);
      setSubmissionAreaIds([]);
      setSubmissionNeeds(defaultSubmissionNeeds);
      setSubmissionSellsHair(false);
      setSubmissionCustomFilters({});
      setSubmissionRawServices("");
      setSubmissionServices([]);
      setSubmissionServiceQuery("");
      lastSuggestedLinkRef.current = "";
      setSubmissionStatus("idle");
      setSubmissionError(null);
    }
  }

  function toggleSubmissionAreaId(areaId: string) {
    setSubmissionAreaIds((current) => (current.includes(areaId) ? current.filter((id) => id !== areaId) : [...current, areaId]));
  }

  function toggleSubmissionSellsHair(checked: boolean) {
    setSubmissionSellsHair(checked);
    if (!checked) {
      // Closing the group clears its subfields too, so they don't stay set
      // but hidden behind a collapsed parent.
      setSubmissionNeeds((current) => ({ ...current, sellsHairSeparately: false, priceIncludesHair: false }));
    }
  }

  function toggleSubmissionCustomFilter(filterTypeId: string, optionId: string) {
    setSubmissionCustomFilters((current) => {
      const selected = current[filterTypeId] ?? [];
      const next = selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
      return { ...current, [filterTypeId]: next };
    });
  }

  function toggleSubmissionService(service: string) {
    setSubmissionServices((current) => (current.includes(service) ? current.filter((item) => item !== service) : [...current, service]));
  }

  // A paste containing a comma or newline reads as a whole list rather than
  // one search term — split it, match it against the known service catalog
  // (server-side, pure text matching, see /api/stylists/match-services) and
  // turn every recognized entry straight into a tag. The raw text is kept in
  // submissionRawServices regardless of match success, so anything the
  // matcher can't map still reaches admin review instead of being dropped.
  async function handleSubmissionServiceQueryPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/[\n,]/.test(pasted)) {
      return;
    }
    event.preventDefault();
    setSubmissionRawServices((current) => (current ? `${current}\n${pasted}` : pasted));

    const lines = pasted
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return;
    }

    try {
      const response = await fetch("/api/stylists/match-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawServices: lines }),
      });
      const payload = await response.json().catch(() => null);
      const matched: string[] = Array.isArray(payload?.services) ? payload.services : [];
      if (matched.length) {
        setSubmissionServices((current) => [...new Set([...current, ...matched])]);
      }
    } catch {
      // The raw paste is already preserved in submissionRawServices above.
    }
  }

  function handleSubmissionInstagramUrlChange(value: string) {
    setSubmissionInstagramUrl(value);
    const derived = deriveNameFromInstagramUrl(value);
    setSubmissionName((current) => (current === "" || current === submissionAutoNameRef.current ? derived : current));
    submissionAutoNameRef.current = derived;
  }

  const submissionInstagramIsValid = isInstagramProfileUrl(submissionInstagramUrl);
  const submissionInstagramError =
    submissionInstagramTouched && submissionInstagramUrl.trim() && !submissionInstagramIsValid
      ? "That doesn't look like an Instagram profile link. Check the URL and try again."
      : "";
  const submissionCanSend = submissionInstagramIsValid;

  // Best-effort, free-only service detection from whatever link the visitor
  // has already typed in — see /api/stylists/suggest-services. Fires once
  // per distinct link (debounced), never on every keystroke. Detected
  // services are added straight to the tag list — same as a manual pick, so
  // there's nothing separate to confirm.
  useEffect(() => {
    const instagram = submissionInstagramUrl.trim();
    const booking = (submissionBookingSameAsInstagram ? submissionInstagramUrl : submissionBookingUrl).trim();
    const linkKey = `${instagram}|${booking}`;

    if (!instagram && !booking) {
      lastSuggestedLinkRef.current = "";
      return;
    }

    if (linkKey === lastSuggestedLinkRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      lastSuggestedLinkRef.current = linkKey;
      try {
        const response = await fetch("/api/stylists/suggest-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instagramUrl: instagram, bookingUrl: booking }),
        });
        const payload = await response.json().catch(() => null);
        const services: string[] = Array.isArray(payload?.services) ? payload.services : [];
        if (services.length) {
          setSubmissionServices((current) => [...new Set([...current, ...services])]);
        }
      } catch {
        // Best-effort only — no services found is a normal, silent outcome.
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [submissionInstagramUrl, submissionBookingUrl, submissionBookingSameAsInstagram]);

  async function submitStylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submissionCanSend || submissionStatus === "submitting") {
      return;
    }

    setSubmissionStatus("submitting");
    setSubmissionError(null);

    const normalizedInstagramUrl = normalizeUrlProtocol(submissionInstagramUrl);

    try {
      const response = await fetch("/api/stylists/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: submissionName.trim(),
          isProvider: submissionIsProvider,
          instagramUrl: normalizedInstagramUrl,
          bookingUrl: submissionBookingSameAsInstagram ? normalizedInstagramUrl : submissionBookingUrl.trim(),
          areaIds: submissionAreaIds,
          ...submissionNeeds,
          customFilters: submissionCustomFilters,
          rawServices: submissionRawServices.trim(),
          services: submissionServices,
          website: submissionHoneypot,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() : null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Could not send that just now. Please try again.");
      }

      trackAnalyticsEvent("stylist_submit_success", { area_count: submissionAreaIds.length, service_count: submissionServices.length });
      setSubmissionStatus("success");
    } catch (error) {
      trackAnalyticsEvent("stylist_submit_error", {});
      setSubmissionStatus("error");
      setSubmissionError(error instanceof Error ? error.message : "Could not send that just now. Please try again.");
    }
  }

  function openMobileFilters() {
    syncDraftFiltersFromApplied();
    trackAnalyticsEvent("filter_opened", { source: "results_header" });
    setMobileFiltersOpen(true);
  }

  function cancelMobileFilters() {
    syncDraftFiltersFromApplied();
    setMobileFiltersOpen(false);
  }

  function applyMobileFilters() {
    setSelectedRegions(draftSelectedRegions);
    setSelectedCategories(draftSelectedCategories);
    setSelectedSubcategories(draftSelectedSubcategories);
    setSelectedPriceBands(draftSelectedPriceBands);
    setSelectedHijabiFriendly(draftSelectedHijabiFriendly);
    setSelectedCanBraidWithoutGel(draftSelectedCanBraidWithoutGel);
    setSelectedWheelchairAccessible(draftSelectedWheelchairAccessible);
    setSelectedSenFriendly(draftSelectedSenFriendly);
    setSelectedLgbtqFriendly(draftSelectedLgbtqFriendly);
    setSelectedParkingAvailable(draftSelectedParkingAvailable);
    setSelectedSellingHair(draftSelectedSellingHair);
    setSelectedPriceIncludesHair(draftSelectedPriceIncludesHair);
    setSelectedSellsHairSeparately(draftSelectedSellsHairSeparately);
    setSelectedSameDayEmergency(draftSelectedSameDayEmergency);
    setSelectedVendorProductTypeGroups(draftSelectedVendorProductTypeGroups);
    setSelectedVendorProductTypes(draftSelectedVendorProductTypes);
    setSelectedVendorFulfilment(draftSelectedVendorFulfilment);
    setSelectedHairstylistOwned(draftSelectedHairstylistOwned);
    setSelectedHasVerifiedReviews(draftSelectedHasVerifiedReviews);
    setSelectedGoogleReviewsOnly(draftSelectedGoogleReviewsOnly);
    setSelectedBookingSitesOnly(draftSelectedBookingSitesOnly);
    setSelectedCustomFilters(draftSelectedCustomFilters);
    setSortOption(draftSortOption);
    setVisibleResultCount(RESULTS_BATCH_SIZE);
    setMobileFiltersOpen(false);
  }

  function updateRegions(updater: RegionId[] | ((current: RegionId[]) => RegionId[])) {
    if (isMobileModalEditing) {
      setDraftSelectedRegions(updater);
      return;
    }

    setSelectedRegions(updater);
  }

  function updateCategories(
    updater: ServiceCategoryId[] | ((current: ServiceCategoryId[]) => ServiceCategoryId[]),
  ) {
    if (isMobileModalEditing) {
      setDraftSelectedCategories(updater);
      return;
    }

    setSelectedCategories(updater);
  }

  function updateSubcategories(
    updater: ServiceSubcategoryId[] | ((current: ServiceSubcategoryId[]) => ServiceSubcategoryId[]),
  ) {
    if (isMobileModalEditing) {
      setDraftSelectedSubcategories(updater);
      return;
    }

    setSelectedSubcategories(updater);
  }

  function updatePriceBands(updater: PriceRangeFilterId[] | ((current: PriceRangeFilterId[]) => PriceRangeFilterId[])) {
    if (isMobileModalEditing) {
      setDraftSelectedPriceBands(updater);
      return;
    }

    setSelectedPriceBands(updater);
  }

  function updateHijabiFriendly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedHijabiFriendly(updater);
      return;
    }

    setSelectedHijabiFriendly(updater);
  }

  function updateCanBraidWithoutGel(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedCanBraidWithoutGel(updater);
      return;
    }

    setSelectedCanBraidWithoutGel(updater);
  }

  function updateWheelchairAccessible(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedWheelchairAccessible(updater);
      return;
    }

    setSelectedWheelchairAccessible(updater);
  }

  function updateSenFriendly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedSenFriendly(updater);
      return;
    }

    setSelectedSenFriendly(updater);
  }

  function updateLgbtqFriendly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedLgbtqFriendly(updater);
      return;
    }

    setSelectedLgbtqFriendly(updater);
  }

  function updateParkingAvailable(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedParkingAvailable(updater);
      return;
    }

    setSelectedParkingAvailable(updater);
  }

  function updateSellingHair(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedSellingHair(updater);
      return;
    }

    setSelectedSellingHair(updater);
  }

  function updatePriceIncludesHair(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedPriceIncludesHair(updater);
      return;
    }

    setSelectedPriceIncludesHair(updater);
  }

  function updateSellsHairSeparately(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedSellsHairSeparately(updater);
      return;
    }

    setSelectedSellsHairSeparately(updater);
  }

  function updateSameDayEmergency(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedSameDayEmergency(updater);
      return;
    }

    setSelectedSameDayEmergency(updater);
  }

  function updateVendorProductTypeGroups(updater: string[] | ((current: string[]) => string[])) {
    if (isMobileModalEditing) {
      setDraftSelectedVendorProductTypeGroups(updater);
      return;
    }

    setSelectedVendorProductTypeGroups(updater);
  }

  function updateVendorProductTypes(updater: string[] | ((current: string[]) => string[])) {
    if (isMobileModalEditing) {
      setDraftSelectedVendorProductTypes(updater);
      return;
    }

    setSelectedVendorProductTypes(updater);
  }

  function updateVendorFulfilment(updater: string[] | ((current: string[]) => string[])) {
    if (isMobileModalEditing) {
      setDraftSelectedVendorFulfilment(updater);
      return;
    }

    setSelectedVendorFulfilment(updater);
  }

  function getVendorProductTypeGroupOptions(groupLabel: string): string[] {
    return vendorProductTypeGroupsEffective.find((group) => group.label === groupLabel)?.options ?? [];
  }

  function getVendorProductTypeGroupForOption(productType: string): string | undefined {
    return vendorProductTypeGroupsEffective.find((group) => group.options.includes(productType))?.label;
  }

  function isVendorProductTypeGroupSelected(groupLabel: string) {
    return currentSelectedVendorProductTypeGroups.includes(groupLabel);
  }

  function vendorProductTypeGroupHasSelectedTypes(groupLabel: string) {
    return getVendorProductTypeGroupOptions(groupLabel).some((option) => currentSelectedVendorProductTypes.includes(option));
  }

  function toggleVendorProductTypeGroup(groupLabel: string) {
    const isCurrentlyActive = currentSelectedVendorProductTypeGroups.includes(groupLabel);
    trackAnalyticsEvent("vendor_product_type_selected", { product_type: groupLabel, selected: !isCurrentlyActive, type: "group" });

    updateVendorProductTypeGroups((currentGroups) => {
      const groupOptions = new Set(getVendorProductTypeGroupOptions(groupLabel));

      updateVendorProductTypes((currentTypes) => currentTypes.filter((type) => !groupOptions.has(type)));

      const isActive = currentGroups.includes(groupLabel);
      if (isActive) {
        return currentGroups.filter((label) => label !== groupLabel);
      }
      return [...currentGroups, groupLabel];
    });
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function toggleVendorProductType(productType: string) {
    const nextSelected = !currentSelectedVendorProductTypes.includes(productType);
    trackAnalyticsEvent("vendor_product_type_selected", { product_type: productType, selected: nextSelected, type: "option" });

    const parentGroup = getVendorProductTypeGroupForOption(productType);

    updateVendorProductTypes((currentTypes) => {
      const isCurrentlySelected = currentTypes.includes(productType);
      const nextTypes = isCurrentlySelected
        ? currentTypes.filter((type) => type !== productType)
        : [...currentTypes, productType];

      if (parentGroup) {
        const parentOptions = getVendorProductTypeGroupOptions(parentGroup);
        const hasSelectedSibling = parentOptions.some((option) => nextTypes.includes(option));

        updateVendorProductTypeGroups((currentGroups) => {
          const groupsWithoutParent = currentGroups.filter((label) => label !== parentGroup);
          if (hasSelectedSibling) return groupsWithoutParent;
          return [...groupsWithoutParent, parentGroup];
        });
      }

      return nextTypes;
    });
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function toggleVendorFulfilment(fulfilmentOption: string) {
    const current = currentSelectedVendorFulfilment;
    const nextSelected = !current.includes(fulfilmentOption);
    trackAnalyticsEvent("vendor_fulfilment_selected", { fulfilment: fulfilmentOption, selected: nextSelected });
    updateVendorFulfilment((currentValues) =>
      currentValues.includes(fulfilmentOption) ? currentValues.filter((value) => value !== fulfilmentOption) : [...currentValues, fulfilmentOption],
    );
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function updateHairstylistOwned(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedHairstylistOwned(updater);
      return;
    }

    setSelectedHairstylistOwned(updater);
  }

  function toggleHairstylistOwned() {
    const nextEnabled = !currentSelectedHairstylistOwned;
    trackAnalyticsEvent("vendor_hairstylist_owned_toggle_changed", { enabled: nextEnabled });
    updateHairstylistOwned(nextEnabled);
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function selectDirectoryMode(mode: DirectoryMode) {
    if (mode === directoryMode) return;
    trackAnalyticsEvent("directory_mode_changed", { mode });
    setDirectoryMode(mode);
  }

  function updateHasVerifiedReviews(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedHasVerifiedReviews(updater);
      return;
    }

    setSelectedHasVerifiedReviews(updater);
  }

  function updateGoogleReviewsOnly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedGoogleReviewsOnly(updater);
      return;
    }

    setSelectedGoogleReviewsOnly(updater);
  }

  function updateBookingSitesOnly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedBookingSitesOnly(updater);
      return;
    }

    setSelectedBookingSitesOnly(updater);
  }

  function updateCustomFilters(updater: Record<string, string[]> | ((current: Record<string, string[]>) => Record<string, string[]>)) {
    if (isMobileModalEditing) {
      setDraftSelectedCustomFilters(updater);
      return;
    }

    setSelectedCustomFilters(updater);
  }

  function updateSortOption(nextSort: SortOption) {
    if (isMobileModalEditing) {
      setDraftSortOption(nextSort);
      return;
    }

    setSortOption(nextSort);
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function toggleServicesOpen() {
    setServicesOpen((current) => {
      const nextIsOpen = !current;
      if (nextIsOpen) {
        setLocationsOpen(false);
        setPriceRangesOpen(false);
        setAdditionalNeedsOpen(false);
        setReviewsFilterOpen(false);
        setOpenCustomFilterTypeId(null);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: "services",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function toggleLocationsOpen() {
    setLocationsOpen((current) => {
      const nextIsOpen = !current;
      if (nextIsOpen) {
        setServicesOpen(false);
        setPriceRangesOpen(false);
        setAdditionalNeedsOpen(false);
        setReviewsFilterOpen(false);
        setOpenCustomFilterTypeId(null);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: "locations",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function togglePriceRangesOpen() {
    setPriceRangesOpen((current) => {
      const nextIsOpen = !current;
      if (nextIsOpen) {
        setServicesOpen(false);
        setLocationsOpen(false);
        setAdditionalNeedsOpen(false);
        setReviewsFilterOpen(false);
        setOpenCustomFilterTypeId(null);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: "price_ranges",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function toggleAdditionalNeedsOpen() {
    setAdditionalNeedsOpen((current) => {
      const nextIsOpen = !current;
      if (nextIsOpen) {
        setServicesOpen(false);
        setLocationsOpen(false);
        setPriceRangesOpen(false);
        setReviewsFilterOpen(false);
        setOpenCustomFilterTypeId(null);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: "additional_needs",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function toggleReviewsFilterOpen() {
    setReviewsFilterOpen((current) => {
      const nextIsOpen = !current;
      if (nextIsOpen) {
        setServicesOpen(false);
        setLocationsOpen(false);
        setPriceRangesOpen(false);
        setAdditionalNeedsOpen(false);
        setOpenCustomFilterTypeId(null);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: "reviews",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function toggleCustomFilterTypeOpen(filterTypeId: string) {
    setOpenCustomFilterTypeId((current) => {
      const nextIsOpen = current !== filterTypeId;
      if (nextIsOpen) {
        setServicesOpen(false);
        setLocationsOpen(false);
        setPriceRangesOpen(false);
        setAdditionalNeedsOpen(false);
        setReviewsFilterOpen(false);
      }
      trackAnalyticsEvent("filter_section_toggled", {
        section: `custom_${filterTypeId}`,
        expanded: nextIsOpen,
      });
      return nextIsOpen ? filterTypeId : null;
    });
  }

  function clearFilters() {
    trackAnalyticsEvent("filter_reset", {
      selected_services: currentSelectedCategories.length + currentSelectedSubcategories.length,
      selected_locations: currentSelectedRegions.filter((region) => region !== "all").length,
      selected_price_ranges: currentSelectedPriceBands.length,
      selected_additional_needs: (currentSelectedHijabiFriendly ? 1 : 0) + (currentSelectedCanBraidWithoutGel ? 1 : 0) + (currentSelectedWheelchairAccessible ? 1 : 0) + (currentSelectedSenFriendly ? 1 : 0) + (currentSelectedLgbtqFriendly ? 1 : 0) + (currentSelectedParkingAvailable ? 1 : 0) + (currentSelectedSellingHair ? 1 : 0) + (currentSelectedPriceIncludesHair ? 1 : 0) + (currentSelectedSellsHairSeparately ? 1 : 0) + (currentSelectedSameDayEmergency ? 1 : 0),
      hijabi_friendly: currentSelectedHijabiFriendly,
      can_braid_without_gel: currentSelectedCanBraidWithoutGel,
      wheelchair_accessible: currentSelectedWheelchairAccessible,
      sen_friendly: currentSelectedSenFriendly,
      lgbtq_friendly: currentSelectedLgbtqFriendly,
      parking_available: currentSelectedParkingAvailable,
      selling_hair: currentSelectedSellingHair,
      price_includes_hair: currentSelectedPriceIncludesHair,
      sells_hair_separately: currentSelectedSellsHairSeparately,
      same_day_emergency: currentSelectedSameDayEmergency,
      has_verified_reviews: currentSelectedHasVerifiedReviews,
      google_reviews_only: currentSelectedGoogleReviewsOnly,
      booking_sites_only: currentSelectedBookingSitesOnly,
    });
    updateCategories([]);
    updateSubcategories([]);
    updateRegions(["all"]);
    updatePriceBands([]);
    updateHijabiFriendly(false);
    updateCanBraidWithoutGel(false);
    updateWheelchairAccessible(false);
    updateSenFriendly(false);
    updateLgbtqFriendly(false);
    updateParkingAvailable(false);
    updateSellingHair(false);
    updatePriceIncludesHair(false);
    updateSellsHairSeparately(false);
    updateSameDayEmergency(false);
    updateVendorProductTypeGroups([]);
    updateVendorProductTypes([]);
    updateVendorFulfilment([]);
    updateHairstylistOwned(false);
    updateHasVerifiedReviews(false);
    updateGoogleReviewsOnly(false);
    updateBookingSitesOnly(false);
    updateCustomFilters({});
    updateSortOption("default");
  }

  function isCategorySelected(categoryId: ServiceCategoryId) {
    return currentSelectedCategories.includes(categoryId);
  }

  function getCategorySubcategories(categoryId: string): string[] {
    return runtimeCategories.find((c) => c.id === categoryId)?.subcategories ?? [];
  }

  function getCategoryLabel(categoryId: string): string {
    return runtimeCategories.find((c) => c.id === categoryId)?.label ?? categoryId;
  }

  function categoryHasSelectedSubcategories(categoryId: ServiceCategoryId) {
    const availableSubcategories = getCategorySubcategories(categoryId);
    return availableSubcategories.some((subcategory) => currentSelectedSubcategories.includes(subcategory as ServiceSubcategoryId));
  }

  function toggleCategory(nextCategory: CategoryId) {
    if (nextCategory === "all") {
      trackAnalyticsEvent("service_filter_selected", {
        selection: "all",
        selected: currentSelectedCategories.length > 0 || currentSelectedSubcategories.length > 0,
      });
      updateCategories([]);
      updateSubcategories([]);
      return;
    }

    const nextCategoryLabel = getCategoryLabel(nextCategory);
    const isCurrentlyActive = currentSelectedCategories.includes(nextCategory as ServiceCategoryId);
    trackAnalyticsEvent("service_filter_selected", {
      selection: nextCategoryLabel,
      selected: !isCurrentlyActive,
      type: "category",
    });

    updateCategories((currentCategories) => {
      const isActive = currentCategories.includes(nextCategory);
      const nextSubcategories = new Set(getCategorySubcategories(nextCategory));

      updateSubcategories((currentSubcategories) =>
        currentSubcategories.filter((subcategory) => !nextSubcategories.has(subcategory)),
      );

      if (isActive) {
        return currentCategories.filter((categoryId) => categoryId !== nextCategory);
      }
      return [...currentCategories, nextCategory];
    });
  }

  function toggleSubcategory(nextSubcategory: ServiceSubcategoryId) {
    trackAnalyticsEvent("service_filter_selected", {
      selection: nextSubcategory,
      selected: !currentSelectedSubcategories.includes(nextSubcategory),
      type: "subcategory",
    });

    const parentCategory = runtimeCategories.find(
      (cat) => cat.id !== "all" && cat.subcategories.includes(nextSubcategory),
    )?.id as ServiceCategoryId | undefined;

    updateSubcategories((currentSubcategories) => {
      const isCurrentlySelected = currentSubcategories.includes(nextSubcategory);
      const nextSubcategories = isCurrentlySelected
        ? currentSubcategories.filter((subcategory) => subcategory !== nextSubcategory)
        : [...currentSubcategories, nextSubcategory];

      if (parentCategory) {
        const parentSubcategories = getCategorySubcategories(parentCategory);
        const hasSelectedSiblingSubcategory = parentSubcategories.some((subcategory) => nextSubcategories.includes(subcategory as ServiceSubcategoryId));

        updateCategories((currentCategories) => {
          const categoriesWithoutParent = currentCategories.filter((categoryId) => categoryId !== parentCategory);
          if (hasSelectedSiblingSubcategory) return categoriesWithoutParent;
          return [...categoriesWithoutParent, parentCategory];
        });
      }

      return nextSubcategories;
    });
  }

  function toggleCanBraidWithoutGel() {
    const nextSelected = !currentSelectedCanBraidWithoutGel;
    trackAnalyticsEvent("braiding_preference_selected", {
      selection: "Can braid without gel",
      selected: nextSelected,
    });
    updateCanBraidWithoutGel(nextSelected);
  }

  function toggleHijabiFriendly() {
    trackAnalyticsEvent("hijabi_toggle_changed", {
      enabled: !currentSelectedHijabiFriendly,
    });
    updateHijabiFriendly((current) => !current);
  }

  function toggleWheelchairAccessible() {
    updateWheelchairAccessible((current) => !current);
  }

  function toggleSenFriendly() {
    trackAnalyticsEvent("sen_friendly_toggle_changed", {
      enabled: !currentSelectedSenFriendly,
    });
    updateSenFriendly((current) => !current);
  }

  function toggleLgbtqFriendly() {
    trackAnalyticsEvent("lgbtq_friendly_toggle_changed", {
      enabled: !currentSelectedLgbtqFriendly,
    });
    updateLgbtqFriendly((current) => !current);
  }

  function toggleParkingAvailable() {
    trackAnalyticsEvent("parking_available_toggle_changed", {
      enabled: !currentSelectedParkingAvailable,
    });
    updateParkingAvailable((current) => !current);
  }

  function toggleSellingHair() {
    const nextEnabled = !currentSelectedSellingHair;
    trackAnalyticsEvent("selling_hair_toggle_changed", {
      enabled: nextEnabled,
    });
    updateSellingHair(nextEnabled);
    if (!nextEnabled) {
      // Closing the group clears its subfilters too, so it doesn't stay
      // active-but-hidden behind a collapsed parent — mirrors unchecking a
      // service category clearing its selected subcategories.
      updatePriceIncludesHair(false);
      updateSellsHairSeparately(false);
    }
  }

  function togglePriceIncludesHair() {
    trackAnalyticsEvent("price_includes_hair_toggle_changed", {
      enabled: !currentSelectedPriceIncludesHair,
    });
    updatePriceIncludesHair((current) => !current);
  }

  function toggleSellsHairSeparately() {
    trackAnalyticsEvent("sells_hair_separately_toggle_changed", {
      enabled: !currentSelectedSellsHairSeparately,
    });
    updateSellsHairSeparately((current) => !current);
  }

  function toggleSameDayEmergency() {
    trackAnalyticsEvent("same_day_emergency_toggle_changed", {
      enabled: !currentSelectedSameDayEmergency,
    });
    updateSameDayEmergency((current) => !current);
  }

  function toggleHasVerifiedReviews() {
    const nextEnabled = !currentSelectedHasVerifiedReviews;
    trackAnalyticsEvent("verified_reviews_toggle_changed", {
      enabled: nextEnabled,
    });
    updateHasVerifiedReviews(nextEnabled);
    // "Google" and "Booking sites" are nested under "All reviews", mirroring the
    // location filter's parent/child groups: selecting the parent directly
    // (either direction) always resets any specific-source selection.
    updateGoogleReviewsOnly(false);
    updateBookingSitesOnly(false);
  }

  function toggleGoogleReviewsOnly() {
    const nextEnabled = !currentSelectedGoogleReviewsOnly;
    trackAnalyticsEvent("google_reviews_only_toggle_changed", {
      enabled: nextEnabled,
    });
    updateGoogleReviewsOnly(nextEnabled);
    if (nextEnabled) {
      // Narrowing to a specific source deselects the "All reviews" parent.
      updateHasVerifiedReviews(false);
    } else if (!currentSelectedBookingSitesOnly) {
      // No specific source remains selected — fall back to "All reviews".
      updateHasVerifiedReviews(true);
    }
  }

  function toggleBookingSitesOnly() {
    const nextEnabled = !currentSelectedBookingSitesOnly;
    trackAnalyticsEvent("booking_sites_only_toggle_changed", {
      enabled: nextEnabled,
    });
    updateBookingSitesOnly(nextEnabled);
    if (nextEnabled) {
      // Narrowing to a specific source deselects the "All reviews" parent.
      updateHasVerifiedReviews(false);
    } else if (!currentSelectedGoogleReviewsOnly) {
      // No specific source remains selected — fall back to "All reviews".
      updateHasVerifiedReviews(true);
    }
  }

  function toggleCustomFilterOption(filterTypeId: string, optionId: string) {
    const current = currentSelectedCustomFilters[filterTypeId] ?? [];
    const nextSelected = !current.includes(optionId);
    trackAnalyticsEvent("custom_filter_selected", {
      filter_type: filterTypeId,
      selection: optionId,
      selected: nextSelected,
    });

    updateCustomFilters((currentFilters) => {
      const currentValues = currentFilters[filterTypeId] ?? [];
      const nextValues = currentValues.includes(optionId)
        ? currentValues.filter((value) => value !== optionId)
        : [...currentValues, optionId];
      return { ...currentFilters, [filterTypeId]: nextValues };
    });
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function togglePriceBand(nextPriceBand: PriceRangeFilterId) {
    const nextSelected = !currentSelectedPriceBands.includes(nextPriceBand);
    trackAnalyticsEvent("price_filter_selected", {
      selection: nextPriceBand,
      selected: nextSelected,
    });

    updatePriceBands((currentPriceBands) =>
      currentPriceBands.includes(nextPriceBand)
        ? currentPriceBands.filter((priceBand) => priceBand !== nextPriceBand)
        : [...currentPriceBands, nextPriceBand],
    );
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }

  function isRegionSelected(regionId: RegionId) {
    return currentSelectedRegions.includes(regionId);
  }

  function toggleRegion(nextRegion: RegionId) {
    const regionLabel = regionLabelMap[nextRegion] ?? nextRegion;
    const isCurrentlyActive =
      nextRegion === "all"
        ? currentSelectedRegions.length > 1 || !currentSelectedRegions.includes("all")
        : currentSelectedRegions.includes(nextRegion);

    trackAnalyticsEvent("location_filter_selected", {
      selection: regionLabel,
      selected: !isCurrentlyActive,
    });

    updateRegions((currentRegions) => {
      if (nextRegion === "all") {
        return ["all"];
      }

      const parentGroup = runtimeParentGroups.find((group) => group.id === nextRegion);
      if (parentGroup) {
        return currentRegions.includes(nextRegion) ? ["all"] : [nextRegion];
      }

      const owningGroup = runtimeParentGroups.find((group) => group.childIds.includes(nextRegion));
      if (owningGroup) {
        const currentGroupChildren = currentRegions.filter((regionId) => owningGroup.childIds.includes(regionId));
        const isActive = currentGroupChildren.includes(nextRegion);
        const nextGroupChildren = isActive
          ? currentGroupChildren.filter((regionId) => regionId !== nextRegion)
          : [...currentGroupChildren, nextRegion];

        if (nextGroupChildren.length === 0) {
          return [owningGroup.id];
        }

        const nonGroupRegions = currentRegions.filter(
          (regionId) => regionId !== "all" && regionId !== owningGroup.id && !owningGroup.childIds.includes(regionId),
        );

        return [...nonGroupRegions, ...nextGroupChildren];
      }

      const withoutUmbrellas = currentRegions.filter(
        (regionId) => regionId !== "all" && !runtimeParentGroups.some((group) => group.id === regionId),
      );
      const isActive = withoutUmbrellas.includes(nextRegion);
      const nextRegions = isActive
        ? withoutUmbrellas.filter((regionId) => regionId !== nextRegion)
        : [...withoutUmbrellas, nextRegion];

      return nextRegions.length > 0 ? nextRegions : ["all"];
    });
  }

  function handleToggleKeyDown(event: React.KeyboardEvent, onToggle: () => void) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    onToggle();
  }

  async function handleSearch(options?: { scroll?: boolean }) {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categories: selectedCategories,
          subcategories: selectedSubcategories,
          regions: selectedRegions,
          hijabiFriendly: selectedHijabiFriendly,
          canBraidWithoutGel: selectedCanBraidWithoutGel,
          wheelchairAccessible: selectedWheelchairAccessible,
          senFriendly: selectedSenFriendly,
          lgbtqFriendly: selectedLgbtqFriendly,
          parkingAvailable: selectedParkingAvailable,
          sellingHairAny: selectedSellingHair,
          priceIncludesHair: selectedPriceIncludesHair,
          sellsHairSeparately: selectedSellsHairSeparately,
          sameDayEmergency: selectedSameDayEmergency,
          hasVerifiedReviews: selectedHasVerifiedReviews,
          googleReviewsOnly: selectedGoogleReviewsOnly,
          bookingSitesOnly: selectedBookingSitesOnly,
          customFilters: selectedCustomFilters,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const rawResponse = await response.text();
        const summary = rawResponse.replace(/\s+/g, " ").trim().slice(0, 140);
        throw new Error(
          summary
            ? `Search API returned HTML instead of JSON: ${summary}`
            : "Search API returned HTML instead of JSON.",
        );
      }

      const payload = (await response.json()) as SearchResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Search failed.");
      }

      const resultCount = (payload.results ?? []).length;
      const activeServices = [...selectedCategories, ...selectedSubcategories];

      trackAnalyticsEvent("search_performed", {
        services: activeServices.join(", ") || "none",
        location: selectedRegions.join(", ") || "all",
        result_count: resultCount,
        hijabi_friendly: selectedHijabiFriendly,
        no_gel: selectedCanBraidWithoutGel,
        wheelchair_accessible: selectedWheelchairAccessible,
        sen_friendly: selectedSenFriendly,
        lgbtq_friendly: selectedLgbtqFriendly,
        parking_available: selectedParkingAvailable,
        selling_hair: selectedSellingHair,
        price_includes_hair: selectedPriceIncludesHair,
        sells_hair_separately: selectedSellsHairSeparately,
        same_day_emergency: selectedSameDayEmergency,
        has_verified_reviews: selectedHasVerifiedReviews,
        google_reviews_only: selectedGoogleReviewsOnly,
        booking_sites_only: selectedBookingSitesOnly,
      });

      if (resultCount === 0) {
        trackAnalyticsEvent("search_zero_results", {
          services: activeServices.join(", ") || "none",
          location: selectedRegions.join(", ") || "all",
          hijabi_friendly: selectedHijabiFriendly,
          no_gel: selectedCanBraidWithoutGel,
          wheelchair_accessible: selectedWheelchairAccessible,
          sen_friendly: selectedSenFriendly,
          lgbtq_friendly: selectedLgbtqFriendly,
          parking_available: selectedParkingAvailable,
          selling_hair: selectedSellingHair,
          price_includes_hair: selectedPriceIncludesHair,
          sells_hair_separately: selectedSellsHairSeparately,
          has_verified_reviews: selectedHasVerifiedReviews,
          google_reviews_only: selectedGoogleReviewsOnly,
          booking_sites_only: selectedBookingSitesOnly,
        });
      }

      setVisibleResultCount(RESULTS_BATCH_SIZE);
      setResults(payload.results ?? []);
      if (options?.scroll !== false) {
        document.getElementById("live-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleVendorSearch(options?: { scroll?: boolean }) {
    setIsSearchingVendors(true);
    setVendorSearchError(null);
    setHasSearchedVendors(true);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productTypeGroups: selectedVendorProductTypeGroups,
          productTypes: selectedVendorProductTypes,
          fulfilment: selectedVendorFulfilment,
          hairstylistOwned: selectedHairstylistOwned,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const rawResponse = await response.text();
        const summary = rawResponse.replace(/\s+/g, " ").trim().slice(0, 140);
        throw new Error(
          summary
            ? `Vendor search API returned HTML instead of JSON: ${summary}`
            : "Vendor search API returned HTML instead of JSON.",
        );
      }

      const payload = (await response.json()) as VendorSearchResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Search failed.");
      }

      const resultCount = (payload.results ?? []).length;
      trackAnalyticsEvent("vendor_search_performed", {
        product_type_groups: selectedVendorProductTypeGroups.join(", ") || "none",
        product_types: selectedVendorProductTypes.join(", ") || "none",
        fulfilment: selectedVendorFulfilment.join(", ") || "none",
        hairstylist_owned: selectedHairstylistOwned,
        result_count: resultCount,
      });

      setVendorResults(payload.results ?? []);
      if (options?.scroll !== false) {
        document.getElementById("live-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      setVendorResults([]);
      setVendorSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setIsSearchingVendors(false);
    }
  }

  useEffect(() => {
    if (directoryMode !== "stylists") return;
    void handleSearch({ scroll: false });
  }, [directoryMode, selectedCategories, selectedSubcategories, selectedRegions, selectedHijabiFriendly, selectedCanBraidWithoutGel, selectedWheelchairAccessible, selectedSenFriendly, selectedLgbtqFriendly, selectedParkingAvailable, selectedSellingHair, selectedPriceIncludesHair, selectedSellsHairSeparately, selectedSameDayEmergency, selectedHasVerifiedReviews, selectedGoogleReviewsOnly, selectedBookingSitesOnly, selectedCustomFilters]);

  useEffect(() => {
    if (directoryMode !== "vendors") return;
    void handleVendorSearch({ scroll: false });
  }, [directoryMode, selectedVendorProductTypeGroups, selectedVendorProductTypes, selectedVendorFulfilment, selectedHairstylistOwned]);

  useEffect(() => {
    fetch("/api/filters")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.categories)) {
          setFilterConfig(buildRuntimeConfig(data.categories, data.locations ?? null));
        }
        if (data.ok && Array.isArray(data.priceBands) && data.priceBands.length) {
          priceBandTiersCache = data.priceBands;
          setPriceBandTiers(data.priceBands);
        }
        if (data.ok && Array.isArray(data.customFilterTypes)) {
          setCustomFilterTypes(data.customFilterTypes);
        }
        if (data.ok && data.searchAliases && typeof data.searchAliases === "object") {
          setServiceSearchAliases(data.searchAliases);
        }
        if (data.ok && data.vendorFilterOptions && typeof data.vendorFilterOptions === "object") {
          setVendorFilterOptions({
            productTypes: Array.isArray(data.vendorFilterOptions.productTypes) ? data.vendorFilterOptions.productTypes : [],
            fulfilment: Array.isArray(data.vendorFilterOptions.fulfilment) ? data.vendorFilterOptions.fulfilment : [],
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncDesktopViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    syncDesktopViewport(desktopMediaQuery);

    if (typeof desktopMediaQuery.addEventListener === "function") {
      desktopMediaQuery.addEventListener("change", syncDesktopViewport);
      return () => desktopMediaQuery.removeEventListener("change", syncDesktopViewport);
    }

    desktopMediaQuery.addListener(syncDesktopViewport);
    return () => desktopMediaQuery.removeListener(syncDesktopViewport);
  }, []);

  useEffect(() => {
    if (!mobileFiltersOpen) {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      return;
    }

    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousLeft = document.body.style.left;
    const previousRight = document.body.style.right;
    const previousWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.left = previousLeft;
      document.body.style.right = previousRight;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!submissionModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSubmissionModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [submissionModalOpen]);

  useEffect(() => {
    if (!privacyModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePrivacyModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [privacyModalOpen]);

  useEffect(() => {
    if (!siteDisclaimerModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSiteDisclaimerModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [siteDisclaimerModalOpen]);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubcategories.length > 0 ||
    selectedPriceBands.length > 0 ||
    selectedHijabiFriendly ||
    selectedCanBraidWithoutGel ||
    selectedWheelchairAccessible ||
    selectedSenFriendly ||
    selectedLgbtqFriendly ||
    selectedParkingAvailable ||
    selectedSellingHair ||
    selectedPriceIncludesHair ||
    selectedSellsHairSeparately ||
    selectedSameDayEmergency ||
    selectedHasVerifiedReviews ||
    selectedGoogleReviewsOnly ||
    selectedBookingSitesOnly ||
    Object.values(selectedCustomFilters).some((values) => values.length > 0) ||
    selectedRegions.length !== 1 ||
    selectedRegions[0] !== "all";
  const priceFilteredResults = selectedPriceBands.length
    ? results.filter((result) =>
        comparablePriceBand(result)
          ? selectedPriceBands.includes(comparablePriceBand(result) as PriceBand)
          : selectedPriceBands.includes("not-listed"),
      )
    : results;
  const sortedResults = sortResults(priceFilteredResults, sortOption, hasActiveFilters, selectedCategories, selectedSubcategories, getShuffleKey);
  // A multi-branch brand (e.g. Duck and Dry) contributes one flattened row per
  // branch to `sortedResults`, but renders as a single card (see renderedBrandIds
  // below) — so the count shown to visitors should count each brand once, not
  // once per branch, or it overstates how many distinct businesses matched.
  const distinctResultCount = new Set(sortedResults.map((result) => result.brandId ?? result.id)).size;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleResultCount >= sortedResults.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleResultCount((currentCount) => Math.min(currentCount + RESULTS_BATCH_SIZE, sortedResults.length));
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [sortedResults.length, visibleResultCount]);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 769px)");

    const syncMobileFilterState = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        syncDraftFiltersFromApplied();
        setMobileFiltersOpen(false);
      }
    };

    syncMobileFilterState(desktopMediaQuery);

    if (typeof desktopMediaQuery.addEventListener === "function") {
      desktopMediaQuery.addEventListener("change", syncMobileFilterState);
      return () => desktopMediaQuery.removeEventListener("change", syncMobileFilterState);
    }

    desktopMediaQuery.addListener(syncMobileFilterState);
    return () => desktopMediaQuery.removeListener(syncMobileFilterState);
  }, []);


  const visibleResults = sortedResults.slice(0, visibleResultCount);
  const selectedServiceCount = runtimeSortedCategoryEntries.reduce((count, [id]) => {
    if (id === "all") return count;
    const categoryId = id as ServiceCategoryId;
    return isCategorySelected(categoryId) || categoryHasSelectedSubcategories(categoryId) ? count + 1 : count;
  }, 0);
  const selectedLocationCount = currentSelectedRegions.filter((regionId) => regionId !== "all").length;
  const selectedPriceRangeCount = currentSelectedPriceBands.length;
  const selectedAdditionalNeedsCount =
    (currentSelectedHijabiFriendly ? 1 : 0) + (currentSelectedCanBraidWithoutGel ? 1 : 0) + (currentSelectedWheelchairAccessible ? 1 : 0) + (currentSelectedSenFriendly ? 1 : 0) + (currentSelectedLgbtqFriendly ? 1 : 0) + (currentSelectedParkingAvailable ? 1 : 0) + (currentSelectedSellingHair ? 1 : 0) + (currentSelectedSameDayEmergency ? 1 : 0);
  const selectedReviewsCount = currentSelectedHasVerifiedReviews || currentSelectedGoogleReviewsOnly || currentSelectedBookingSitesOnly ? 1 : 0;
  const selectedCustomFilterCounts = Object.fromEntries(
    customFilterTypes.map((filterType) => [filterType.id, (currentSelectedCustomFilters[filterType.id] ?? []).length]),
  );
  const vendorProductTypeGroupsEffective = (() => {
    const availableProductTypes = new Set(vendorFilterOptions.productTypes);
    const grouped = new Set<string>();
    const groups = vendorProductTypeGroups
      .map((group) => {
        const options = group.options.filter((option) => availableProductTypes.has(option));
        options.forEach((option) => grouped.add(option));
        return { label: group.label, options };
      })
      .filter((group) => group.options.length > 0);
    const ungrouped = vendorFilterOptions.productTypes.filter((option) => !grouped.has(option));
    if (ungrouped.length > 0) {
      groups.push({ label: "Other", options: ungrouped });
    }
    return groups;
  })();
  const selectedVendorProductTypeCount = vendorProductTypeGroupsEffective.reduce((count, group) => {
    return isVendorProductTypeGroupSelected(group.label) || vendorProductTypeGroupHasSelectedTypes(group.label) ? count + 1 : count;
  }, 0);
  const selectedVendorFulfilmentCount = currentSelectedVendorFulfilment.length;
  const vendorResultCount = vendorResults.length;
  const hasActiveVendorFilters =
    selectedVendorProductTypeGroups.length > 0 || selectedVendorProductTypes.length > 0 || selectedVendorFulfilment.length > 0;

  return (
    <div className="min-h-screen bg-stone-100 text-left dark:bg-stone-950">
      <header className="border-b border-stone-300 dark:border-stone-800">
        <div className="mx-auto flex w-full max-w-[1120px] items-start px-4 sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1 pb-7 pt-10 sm:pb-12 sm:pt-12">
            <div className="flex flex-col items-start gap-[4.5rem] px-0">
              <p className="inline-flex items-center bg-stone-200 px-3 py-2 text-left text-[11px] font-bold uppercase leading-none tracking-[0.11em] text-stone-700 dark:bg-stone-700 dark:text-stone-100">
                Row K LDN
              </p>
              <div className="flex w-full flex-col items-start gap-3">
                <h1 className="-ml-[0.045em] w-full text-left text-[38px] italic font-medium leading-[40px] tracking-tight text-stone-950 dark:text-stone-50 sm:text-[56px] sm:leading-[58px] lg:text-[68px] lg:leading-[70px] lg:whitespace-nowrap" style={{ fontFamily: "Junicode" }}>
                  Black hair directory
                </h1>
                <p className="w-full max-w-3xl text-left text-[16px] leading-[1.55] text-stone-700 dark:text-stone-300 sm:text-[19px]">
                  Find afro hair stylists in & around London.
                  <br />
                  <span className="inline-block">Natural or relaxed. Braids, sew-ins, wigs, locs.</span>
                </p>
                <div className="flex w-full flex-col gap-4 pb-1 pt-3 sm:w-auto sm:flex-row sm:items-center sm:pb-0 sm:pt-5">
                  <a
                    href="#live-results"
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById("live-results")?.scrollIntoView({ behavior: "smooth" });
                      trackAnalyticsEvent("find_stylists_click", { source: "hero" });
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-none bg-stone-950 px-5 text-[14px] font-medium text-stone-100 transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
                  >
                    Find a stylist ↓
                  </a>
                  <button
                    type="button"
                    onClick={() => openSubmissionModal("hero")}
                    className="inline-flex h-12 items-center justify-center rounded-none border border-stone-400 bg-transparent px-5 text-[14px] font-medium text-stone-900 transition-colors hover:bg-stone-200 dark:border-stone-600 dark:text-stone-100 dark:hover:bg-stone-800"
                  >
                    Submit a stylist
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden w-72 flex-none border-l border-transparent pl-8 lg:block" />
        </div>
      </header>

      {/* DOM position matters here, not just visual placement: this is a
          `position: fixed` button, so moving it doesn't move it on screen —
          but with a results list that can run into the hundreds of cards
          (each contributing several tab stops of its own), leaving it after
          the list in source order would bury it at the very end of the
          page's tab sequence. Placed right after the header instead, it's
          reachable in a couple of tabs from page load once scrolled state
          makes it focusable, regardless of how far into the list that is. */}
      <div
        className={cn(
          // An explicit height (matching the button) plus a fixed pixel
          // offset — rather than translate-y-full — sidesteps any ambiguity
          // in resolving a percentage translate against an auto-height fixed
          // box: this guarantees the button clears the viewport completely
          // while hidden instead of merely peeking in at the bottom edge.
          "pointer-events-none fixed inset-x-0 bottom-6 z-40 h-11 transition-transform duration-300 ease-out",
          showBackToTop ? "translate-y-0" : "translate-y-24",
        )}
      >
        <div className="mx-auto flex w-full max-w-[1120px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-1 justify-center lg:pr-8">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              aria-hidden={!showBackToTop}
              tabIndex={showBackToTop ? 0 : -1}
              className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-none border border-white/40 bg-white/20 text-stone-900 shadow-[0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md backdrop-saturate-150 transition hover:bg-white/35 dark:border-white/15 dark:bg-white/10 dark:text-white dark:shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:bg-white/20"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="hidden w-72 flex-none lg:block" aria-hidden="true" />
        </div>
      </div>

      {submissionModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-stone-950/40" onClick={closeSubmissionModal} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-stylist-heading"
            className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col overflow-hidden border-l border-stone-300 bg-stone-100 shadow-xl dark:border-stone-700 dark:bg-stone-950"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              <div>
                <h2 id="submit-stylist-heading" className="text-[20px] font-medium text-stone-950 dark:text-stone-50">
                  Submit a stylist
                </h2>
                <p className="mt-1 text-[13px] leading-[1.5] text-stone-600 dark:text-stone-400">
                  This can be a hair stylist or service provider.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSubmissionModal}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              {submissionStatus === "success" ? (
                <div className="flex flex-col items-start gap-3 py-6">
                  <Check className="size-6 text-stone-950 dark:text-stone-50" aria-hidden="true" />
                  <p className="text-[16px] font-medium text-stone-950 dark:text-stone-50">Thanks!</p>
                  <p className="text-[14px] leading-[1.55] text-stone-700 dark:text-stone-300">
                    We&rsquo;ll review each submission before it&rsquo;s listed.
                  </p>
                </div>
              ) : (
                <form id="submit-stylist-form" onSubmit={submitStylist} className="flex flex-col gap-7">
                  <section className="flex flex-col gap-3">
                    <SubmissionLinkField
                      label="Instagram link"
                      value={submissionInstagramUrl}
                      onChange={handleSubmissionInstagramUrlChange}
                      onBlur={() => setSubmissionInstagramTouched(true)}
                      placeholder="https://instagram.com/..."
                      required
                      error={submissionInstagramError}
                    />
                  </section>

                  <section className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-600 dark:text-stone-400">Name</span>
                      <Input value={submissionName} onChange={(event) => setSubmissionName(event.target.value)} placeholder="Stylist or business name" />
                    </label>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-600 dark:text-stone-400">
                        Are you the stylist / service provider?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSubmissionIsProvider(true)}
                          aria-pressed={submissionIsProvider}
                          className={cn(
                            "h-10 flex-1 rounded-none border text-[13px] font-medium transition",
                            submissionIsProvider
                              ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                              : "border-stone-300 bg-transparent text-stone-600 hover:bg-stone-200 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900",
                          )}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubmissionIsProvider(false)}
                          aria-pressed={!submissionIsProvider}
                          className={cn(
                            "h-10 flex-1 rounded-none border text-[13px] font-medium transition",
                            !submissionIsProvider
                              ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                              : "border-stone-300 bg-transparent text-stone-600 hover:bg-stone-200 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900",
                          )}
                        >
                          No
                        </button>
                      </div>
                    </div>

                  </section>

                  <section className="flex flex-col gap-3">
                    <SubmissionLinkField
                      label="Booking link"
                      value={submissionBookingSameAsInstagram ? submissionInstagramUrl : submissionBookingUrl}
                      onChange={setSubmissionBookingUrl}
                      placeholder="https://..."
                      disabled={submissionBookingSameAsInstagram}
                    >
                      <label className="mt-2 flex items-center gap-2 text-[13px] font-medium text-stone-700 dark:text-stone-300">
                        <input
                          type="checkbox"
                          checked={submissionBookingSameAsInstagram}
                          disabled={!submissionInstagramUrl.trim()}
                          onChange={(event) => setSubmissionBookingSameAsInstagram(event.target.checked)}
                          className="size-3.5 rounded-none border-stone-400 accent-stone-950 disabled:opacity-40"
                        />
                        Same as Instagram
                      </label>
                    </SubmissionLinkField>
                  </section>

                  <section className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Location</p>
                    <div className="flex flex-wrap gap-1.5">
                      {submissionRegionOptions.map((region) => {
                        const isSelected = submissionAreaIds.includes(region.id);
                        return (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() => toggleSubmissionAreaId(region.id)}
                            aria-pressed={isSelected}
                            className={cn(
                              "rounded-none border px-2.5 py-1 text-xs font-medium transition",
                              isSelected
                                ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                                : "border-stone-300 bg-transparent text-stone-600 hover:bg-stone-200 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900",
                            )}
                          >
                            {region.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Additional Needs</p>
                    <div className="grid gap-1">
                      {submissionNeedFields
                        .filter((option) => option.field !== "sellsHairSeparately" && option.field !== "priceIncludesHair")
                        .map((option) => (
                          <SubmissionNeedCheckbox
                            key={option.field}
                            label={option.label}
                            description={option.description}
                            checked={submissionNeeds[option.field]}
                            onChange={(checked) => setSubmissionNeeds((current) => ({ ...current, [option.field]: checked }))}
                          />
                        ))}

                      <SubmissionNeedCheckbox
                        label="Sells hair"
                        description="Sells hair or extensions, either separately or as part of a package."
                        checked={submissionSellsHair}
                        onChange={toggleSubmissionSellsHair}
                      />
                      {submissionSellsHair ? (
                        <>
                          <SubmissionNeedCheckbox
                            indent
                            label={submissionSellsHairSeparatelyField.label}
                            description={submissionSellsHairSeparatelyField.description}
                            checked={submissionNeeds.sellsHairSeparately}
                            onChange={(checked) => setSubmissionNeeds((current) => ({ ...current, sellsHairSeparately: checked }))}
                          />
                          <SubmissionNeedCheckbox
                            indent
                            label={submissionPriceIncludesHairField.label}
                            description={submissionPriceIncludesHairField.description}
                            checked={submissionNeeds.priceIncludesHair}
                            onChange={(checked) => setSubmissionNeeds((current) => ({ ...current, priceIncludesHair: checked }))}
                          />
                        </>
                      ) : null}
                    </div>
                  </section>

                  {customFilterTypes.length ? (
                    <section className="flex flex-col gap-4">
                      {customFilterTypes.map((filterType) => {
                        const selected = submissionCustomFilters[filterType.id] ?? [];
                        return (
                          <div key={filterType.id} className="flex flex-col gap-1.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{filterType.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {filterType.options.map((option) => {
                                const isSelected = selected.includes(option.id);
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => toggleSubmissionCustomFilter(filterType.id, option.id)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                      "rounded-none border px-2.5 py-1 text-xs font-medium transition",
                                      isSelected
                                        ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                                        : "border-stone-300 bg-transparent text-stone-600 hover:bg-stone-200 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900",
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ) : null}

                  <section className="flex flex-col gap-3">
                    <label htmlFor={submissionServicesInputId} className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      Services
                    </label>
                    <p id={submissionServicesHintId} className="text-[12px] text-stone-500 dark:text-stone-400">
                      Type to search, or paste a whole list to add several at once.
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 border border-stone-300 bg-stone-50 px-3 py-2 focus-within:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:focus-within:border-stone-100">
                      {submissionServices.map((service) => (
                        <button
                          key={service}
                          type="button"
                          onClick={() => toggleSubmissionService(service)}
                          className="inline-flex items-center gap-1 rounded-none border border-stone-950 bg-stone-950 px-2.5 py-1 text-xs font-medium text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                        >
                          {service}
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      ))}
                      <input
                        id={submissionServicesInputId}
                        value={submissionServiceQuery}
                        onChange={(event) => setSubmissionServiceQuery(event.target.value)}
                        onPaste={handleSubmissionServiceQueryPaste}
                        placeholder={submissionServices.length ? "Add more..." : "Search services..."}
                        aria-describedby={submissionServicesHintId}
                        className="min-w-[140px] flex-1 border-0 bg-transparent py-1.5 text-sm text-stone-950 outline-none placeholder:text-stone-400 dark:text-stone-100 dark:placeholder:text-stone-500"
                      />
                    </div>

                    <div className="max-h-56 space-y-3 overflow-y-auto border border-stone-300 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900">
                      {filteredSubmissionServiceGroups.length ? (
                        filteredSubmissionServiceGroups.map((group) => (
                          <div key={group.id} className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">{group.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.services.map((service) => {
                                const isSelected = submissionServices.includes(service);
                                return (
                                  <button
                                    key={service}
                                    type="button"
                                    onClick={() => toggleSubmissionService(service)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                      "rounded-none border px-2.5 py-1 text-xs font-medium transition",
                                      isSelected
                                        ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                                        : "border-stone-300 bg-white text-stone-600 hover:bg-stone-200 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400 dark:hover:bg-stone-800",
                                    )}
                                  >
                                    {service}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[13px] text-stone-500">No services match that search.</p>
                      )}
                    </div>
                  </section>

                  <div className="h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
                    <label>
                      Leave this field blank
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={submissionHoneypot}
                        onChange={(event) => setSubmissionHoneypot(event.target.value)}
                      />
                    </label>
                  </div>
                </form>
              )}
            </div>

            <div className="relative shrink-0 border-t border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              {submissionStatus === "error" && submissionError ? (
                <div className="absolute inset-x-0 bottom-full bg-rose-100 px-6 py-2.5 text-[13px] leading-[1.4] text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 sm:px-8">
                  {submissionError}
                </div>
              ) : null}
              {submissionStatus === "success" ? (
                <button
                  type="button"
                  onClick={closeSubmissionModal}
                  className="inline-flex h-12 w-full items-center justify-center rounded-none bg-stone-950 px-5 text-[14px] font-medium text-stone-100 transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    form="submit-stylist-form"
                    disabled={!submissionCanSend || submissionStatus === "submitting"}
                    className="inline-flex h-12 w-full items-center justify-center rounded-none bg-stone-950 px-5 text-[14px] font-medium text-stone-100 transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
                  >
                    {submissionStatus === "submitting" ? "Sending..." : "Send"}
                  </button>
                  <p className="mt-2 text-center text-[12px] text-stone-500 dark:text-stone-400">
                    We&rsquo;ll review each submission before it&rsquo;s listed.
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {privacyModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-stone-950/40" onClick={closePrivacyModal} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-heading"
            className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col overflow-hidden border-l border-stone-300 bg-stone-100 shadow-xl dark:border-stone-700 dark:bg-stone-950"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              <div>
                <h2 id="privacy-heading" className="text-[20px] font-medium text-stone-950 dark:text-stone-50">
                  Privacy
                </h2>
                <p className="mt-1 text-[13px] leading-[1.5] text-stone-600 dark:text-stone-400">Last updated 1 September 2026.</p>
              </div>
              <button
                type="button"
                onClick={closePrivacyModal}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-[14px] leading-[1.6] text-stone-700 dark:text-stone-300 sm:px-8">
              <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">What Row K is</h3>
                  <p>
                    Row K is a directory of afro hair stylists and service providers in & around London. We link out to stylists&rsquo;
                    Instagram and booking pages. We don&rsquo;t process bookings or payments ourselves.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">What we collect</h3>
                  <p>When you use the &ldquo;Submit a stylist&rdquo; form, we collect:</p>
                  <ul className="list-disc pl-5">
                    <li>The name, Instagram/booking links, location and service details you enter about the stylist</li>
                  </ul>
                  <p>
                    We also use privacy-focused analytics (PostHog) to see how the site is used: page views and clicks. This runs without
                    cookies or any identifier stored on your device, so it can&rsquo;t recognise you across visits, but it does see your IP
                    address and browser at the time.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">Why we collect it</h3>
                  <p>
                    Submission details are used to review and add a stylist to the directory. Analytics helps us understand which parts
                    of the site are useful and where to improve it.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">Who we share it with</h3>
                  <p>
                    PostHog processes analytics data (page views and clicks) on our behalf, but it never receives anything from the
                    submission form. Submission details aren&rsquo;t shared with anyone else.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">How long we keep it</h3>
                  <p>
                    Submissions are kept for as long as needed to review them and check for duplicates, and once published, for as long
                    as the listing stays in the directory.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-stone-500">Your rights</h3>
                  <p>
                    You can ask us what we hold about you, or ask us to correct or delete it, by emailing hello@row-k.london. The ICO is
                    the UK&rsquo;s independent regulator for this and can also be contacted directly.
                  </p>
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              <button
                type="button"
                onClick={closePrivacyModal}
                className="inline-flex h-12 w-full items-center justify-center rounded-none bg-stone-950 px-5 text-[14px] font-medium text-stone-100 transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {siteDisclaimerModalOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-stone-950/40" onClick={closeSiteDisclaimerModal} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-disclaimer-heading"
            className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col overflow-hidden border-l border-stone-300 bg-stone-100 shadow-xl dark:border-stone-700 dark:bg-stone-950"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              <div>
                <h2 id="site-disclaimer-heading" className="text-[20px] font-medium text-stone-950 dark:text-stone-50">
                  Site disclaimer
                </h2>
              </div>
              <button
                type="button"
                onClick={closeSiteDisclaimerModal}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-[14px] leading-[1.6] text-stone-700 dark:text-stone-300 sm:px-8">
              <div className="flex flex-col gap-2.5">
                <p>Row K is a directory, not a booking platform.</p>
                <p>We don&rsquo;t vet, endorse, or take responsibility for the service providers listed.</p>
                <p>We don&rsquo;t claim ownership of any photos shown. To request removal, contact us.</p>
              </div>
            </div>

            <div className="shrink-0 border-t border-stone-300 px-6 py-5 dark:border-stone-800 sm:px-8">
              <button
                type="button"
                onClick={closeSiteDisclaimerModal}
                className="inline-flex h-12 w-full items-center justify-center rounded-none bg-stone-950 px-5 text-[14px] font-medium text-stone-100 transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1120px] flex-col px-4 sm:px-6 lg:flex-row lg:items-start lg:px-10">
        {mobileFiltersOpen ? <div className="fixed inset-0 z-40 bg-stone-100 dark:bg-stone-950 lg:hidden" aria-hidden="true" /> : null}
        <section id="live-results" className="min-w-0 flex-1 pb-6 pt-2 lg:pb-6 lg:pr-8 lg:pt-0">
          <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-stone-300 bg-stone-100 px-0 pb-3 pt-1 dark:border-stone-800 dark:bg-stone-950 lg:h-16 lg:items-end lg:pb-3 lg:pt-2">
            {directoryMode === "vendors" ? (
              hasSearchedVendors ? (
                <h2 className="text-[14px] font-medium leading-none text-stone-500 dark:text-stone-400">
                  {vendorResultCount} {vendorResultCount === 1 ? "result" : "results"}
                </h2>
              ) : (
                <h2 className="text-[14px] font-medium leading-none text-stone-500 dark:text-stone-400">Results</h2>
              )
            ) : hasSearched ? (
              <h2 className="text-[14px] font-medium leading-none text-stone-500 dark:text-stone-400">
                {distinctResultCount} {distinctResultCount === 1 ? "result" : "results"}
              </h2>
            ) : (
              <h2 className="text-[14px] font-medium leading-none text-stone-500 dark:text-stone-400">Results</h2>
            )}

            <div className="flex items-center gap-2 text-[13px] text-stone-500 dark:text-stone-400 lg:hidden">
              <button
                type="button"
                onClick={openMobileFilters}
                className="min-h-11 px-0 py-2 text-[14px] font-medium text-stone-500 transition hover:text-stone-800 active:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 dark:active:text-stone-100"
              >
                Filter
              </button>
            </div>
          </div>

          {!disclaimerDismissed ? (
            <div
              ref={disclaimerRef}
              className="relative mb-1 mt-0 flex w-full items-center border-b border-[oklch(0.93_0.003_55)] bg-[oklch(0.968_0.007_55)] text-[12px] leading-[1.4] text-[oklch(0.444_0.035_55)] dark:border-[oklch(0.22_0.02_55)] dark:bg-[oklch(0.26_0.025_55)] dark:text-[oklch(0.87_0.02_55)]"
            >
              <span aria-hidden="true" className="h-12 w-12 shrink-0 lg:h-10 lg:w-10" />
              <div className="mx-auto flex items-center gap-2 text-center">
                <span className="font-medium">We don't vet, endorse, or take responsibility for any of the service providers listed</span>
              </div>
              <button
                type="button"
                onClick={dismissDisclaimer}
                aria-label="Dismiss disclaimer"
                className="flex h-12 w-12 shrink-0 items-center justify-center text-[oklch(0.444_0.035_55)] transition hover:text-[oklch(0.374_0.01_55)] dark:text-[oklch(0.87_0.02_55)] dark:hover:text-[oklch(0.78_0.02_55)] lg:h-10 lg:w-10"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.75} />
              </button>
            </div>
          ) : null}

          {directoryMode === "vendors" ? (
            <VendorResultsList
              vendors={vendorResults}
              isSearching={isSearchingVendors}
              searchError={vendorSearchError}
              hasSearched={hasSearchedVendors}
              onResetFilters={clearFilters}
            />
          ) : (
          <>
          {searchError ? (
            <div className="mt-4 bg-rose-100 px-4 py-6 text-left dark:bg-rose-950/30">
              <h3 className="text-[17px] font-semibold text-rose-900 dark:text-rose-200">Something went wrong</h3>
              <p className="mt-2 text-sm leading-7 text-rose-800 dark:text-rose-300">You can:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7 text-rose-800 dark:text-rose-300">
                <li>
                  Refresh or{" "}
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline text-rose-900 underline decoration-current underline-offset-4 transition-colors hover:text-rose-700 dark:text-rose-100 dark:hover:text-rose-200"
                  >
                    Try again
                  </button>
                </li>
                <li>Search elsewhere, for example on salon booking sites, Instagram, or TikTok</li>
              </ul>
            </div>
          ) : null}

          {isSearching ? (
            <ul className="flex w-full list-none flex-col items-start" aria-hidden="true">
              {Array.from({ length: RESULTS_SKELETON_COUNT }, (_, index) => (
                <li
                  key={`skeleton-${index}`}
                  className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-6 text-left last:border-b-0 dark:border-stone-800"
                >
                  <article className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 grow">
                      <div className="h-6 w-48 animate-pulse rounded-[4px] bg-stone-300/70 dark:bg-stone-800/70" />
                      <div className="mt-2 h-5 w-32 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="h-6 w-24 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
                        <span className="h-6 w-28 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
                        <span className="h-6 w-20 animate-pulse rounded-[4px] bg-stone-200/70 dark:bg-stone-900/70" />
                      </div>
                    </div>

                    <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                      <span className="h-11 flex-1 animate-pulse rounded-[8px] bg-stone-300/70 dark:bg-stone-800/70 sm:w-28 sm:flex-none" />
                      <span className="h-11 w-11 animate-pulse rounded-[8px] bg-stone-200/70 dark:bg-stone-900/70" />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : !searchError ? (
            <ul className="flex w-full list-none flex-col items-start">
              {(() => {
                const renderedBrandIds = new Set<string>();
                return visibleResults.map((result) => {
                  if (result.brandId) {
                    if (renderedBrandIds.has(result.brandId)) return null;
                    const brandBranches = results.filter((other) => other.brandId === result.brandId);
                    if (brandBranches.length > 1) {
                      renderedBrandIds.add(result.brandId);
                      const brandOrderedServices = orderServicesBySelection(
                        result.services,
                        selectedCategories,
                        selectedSubcategories,
                        runtimeCategoryServiceMap,
                      );
                      return (
                        <BrandGroupCard
                          key={result.brandId}
                          brandBranches={brandBranches}
                          orderedServices={brandOrderedServices}
                          customFilterTypes={customFilterTypes}
                          preferBookingPlatform={currentSelectedBookingSitesOnly && !currentSelectedGoogleReviewsOnly}
                        />
                      );
                    }
                  }

                  const locationLabels = getLocationLabels(result);
                  const orderedServices = orderServicesBySelection(result.services, selectedCategories, selectedSubcategories, runtimeCategoryServiceMap);

                  const activeServices = [...selectedCategories, ...selectedSubcategories].join(", ") || "none";
                  const reviewsBanner = getReviewsBannerInfo(result, {
                    preferBookingPlatform: currentSelectedBookingSitesOnly && !currentSelectedGoogleReviewsOnly,
                  });
                  const hairShopLink = getHairShopLinkInfo(result);
                  const attributeLabels = [
                    result.wheelchairAccessible ? "wheelchair access" : null,
                    result.hijabiFriendly ? "hijabi-friendly" : null,
                    result.canBraidWithoutGel ? "can braid without gel" : null,
                    result.senFriendly ? "sensory-safe / sen-friendly" : null,
                    result.lgbtqFriendly ? "lgbtqia+-friendly" : null,
                    result.priceIncludesHair ? "hair-inclusive packages" : null,
                    !hairShopLink && result.sellsHairSeparately ? "hair sold separately" : null,
                    result.sameDayEmergency ? "same-day / walk-ins" : null,
                    ...getResultCustomFilterLabels(result, customFilterTypes),
                  ].filter((label): label is string => Boolean(label));
                  const portfolioPhotos = getPortfolioPhotos(result);
                  const hasPortfolioPhotos = portfolioPhotos.length > 0;

                  return (
                    <SalonResultCard
                      key={result.id}
                      result={result}
                      locationLabels={locationLabels}
                      orderedServices={orderedServices}
                      activeServices={activeServices}
                      reviewsBanner={reviewsBanner}
                      hairShopLink={hairShopLink}
                      attributeLabels={attributeLabels}
                      portfolioPhotos={portfolioPhotos}
                      hasPortfolioPhotos={hasPortfolioPhotos}
                    />
                  );
                });
              })()}
            </ul>
          ) : null}

          {!isSearching && !searchError && visibleResultCount < sortedResults.length ? <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" /> : null}

          {!isSearching && !searchError && hasSearched && sortedResults.length === 0 ? (
            <div className="mt-4 bg-stone-200 px-4 py-6 text-left dark:bg-stone-900/60">
              <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">
                No salons or stylists found
              </h3>
              <p className="mt-2 text-sm leading-7 text-stone-700 dark:text-stone-300">You can:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7 text-stone-700 dark:text-stone-300">
                <li>
                  Change your filters, or{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline text-stone-950 underline underline-offset-4 transition-colors hover:text-stone-700 dark:text-stone-100 dark:hover:text-stone-300"
                  >
                    reset
                  </button>
                </li>
                <li>Search elsewhere, for example on salon booking sites, Instagram, or TikTok</li>
              </ul>
              <div className="mt-4 border-t border-stone-300 pt-4 dark:border-stone-700">
                <div className="flex flex-wrap items-center gap-3 text-sm leading-7 text-stone-700 dark:text-stone-300">
                <span>Know someone who meets this criteria?</span>
                <button
                  type="button"
                  onClick={() => openSubmissionModal("zero_results")}
                  className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-stone-950 underline underline-offset-4 transition-colors hover:text-stone-700 dark:text-stone-100 dark:hover:text-stone-300"
                >
                  Submit a stylist
                </button>
                </div>
              </div>
            </div>
          ) : null}
          </>
          )}
        </section>

        <aside
          className={cn(
            "hidden w-full border-t border-stone-300 py-6 dark:border-stone-800",
            "lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-none lg:self-start lg:flex-col lg:border-t-0 lg:border-l lg:pl-8 lg:pr-6 lg:py-0 dark:border-stone-800",
            mobileFiltersOpen &&
              "fixed inset-0 z-50 grid h-dvh min-h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-b-0 bg-stone-100 px-4 py-0 overscroll-contain dark:bg-stone-950 sm:px-6 lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:w-72 lg:bg-transparent lg:flex lg:flex-col",
          )}
        >
          <div className="flex items-center justify-between border-b border-stone-300 px-0 py-4 dark:border-stone-800 lg:hidden">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 px-0 py-2 text-[13px] font-medium text-stone-700 transition hover:text-stone-500 active:text-stone-500 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
              >
                Reset
              </button>
              <h2 className="text-[15px] font-semibold text-stone-950 dark:text-stone-50">Filter / Sort</h2>
              <button
                type="button"
                onClick={cancelMobileFilters}
                className="min-h-11 px-0 py-2 text-[13px] font-medium text-stone-500 transition hover:text-stone-800 active:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 dark:active:text-stone-100"
              >
                Cancel
              </button>
            </div>

          <div className="hidden w-full shrink-0 items-end justify-between border-b border-stone-300 bg-stone-100 pb-3 pt-2 dark:border-stone-800 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-16">
            <h2 className="text-[15px] font-semibold leading-none text-stone-950 dark:text-stone-50">Filter / Sort</h2>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[13px] font-medium leading-none text-stone-700 transition hover:text-stone-500 dark:text-stone-200 dark:hover:text-stone-400"
            >
              Reset
            </button>
          </div>

          <section
            aria-label="Filter options"
            className="mt-0 min-h-0 flex-1 space-y-6 overflow-y-auto px-0 pt-0 pb-6 [scrollbar-gutter:stable_both-edges] lg:min-h-0 lg:flex-1 lg:space-y-6 lg:overflow-y-scroll lg:px-0 lg:pt-0 lg:pb-6"
          >
            {VENDOR_MODE_ENABLED ? (
              <div className="pt-6">
                <div
                  role="tablist"
                  aria-label="Directory mode"
                  className="flex w-full gap-1 rounded-none bg-stone-200 p-1 dark:bg-stone-900"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={directoryMode === "stylists"}
                    onClick={() => selectDirectoryMode("stylists")}
                    className={cn(
                      "min-h-9 flex-1 rounded-none px-4 py-1.5 text-[14px] font-medium transition-colors",
                      directoryMode === "stylists"
                        ? "bg-white text-stone-950 dark:bg-stone-700 dark:text-stone-50"
                        : "bg-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100",
                    )}
                  >
                    Stylists
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={directoryMode === "vendors"}
                    onClick={() => selectDirectoryMode("vendors")}
                    className={cn(
                      "min-h-9 flex-1 rounded-none px-4 py-1.5 text-[14px] font-medium transition-colors",
                      directoryMode === "vendors"
                        ? "bg-white text-stone-950 dark:bg-stone-700 dark:text-stone-50"
                        : "bg-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100",
                    )}
                  >
                    Vendors
                  </button>
                </div>
              </div>
            ) : null}

            {directoryMode === "vendors" ? (
              <>
                <div>
                  <div
                    className={cn(
                      "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-10",
                      vendorProductTypesOpen && "border-b border-stone-300 dark:border-stone-800",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={vendorProductTypesOpen}
                      onClick={() => setVendorProductTypesOpen((current) => !current)}
                      className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                    >
                      <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">
                        Product type
                      </span>
                      <span className="flex items-center gap-2">
                        {selectedVendorProductTypeCount > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                            {selectedVendorProductTypeCount}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-500 dark:group-active:text-stone-500",
                            vendorProductTypesOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </div>

                  <AnimatedCollapsible open={vendorProductTypesOpen}>
                    <div className="space-y-2 pt-3">
                      {vendorProductTypeGroupsEffective.map((group) => {
                        const isGroupActive = isVendorProductTypeGroupSelected(group.label);
                        const showTypes = isGroupActive || vendorProductTypeGroupHasSelectedTypes(group.label);

                        return (
                          <div key={group.label} className="space-y-2">
                            <button
                              type="button"
                              aria-pressed={isGroupActive}
                              onClick={() => toggleVendorProductTypeGroup(group.label)}
                              className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                  isGroupActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                                )}
                              >
                                {isGroupActive ? <Check className="size-3.5" /> : null}
                              </span>
                              <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                {group.label}
                              </span>
                            </button>

                            {showTypes && group.options.length > 0 ? (
                              <div className="space-y-2 pl-8">
                                {group.options.map((productType) => {
                                  const isActive = currentSelectedVendorProductTypes.includes(productType);
                                  return (
                                    <button
                                      type="button"
                                      aria-pressed={isActive}
                                      key={productType}
                                      onClick={() => toggleVendorProductType(productType)}
                                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={cn(
                                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                          isActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                                        )}
                                      >
                                        {isActive ? <Check className="size-3.5" /> : null}
                                      </span>
                                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                        {productType}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </AnimatedCollapsible>
                </div>

                <div>
                  <div
                    className={cn(
                      "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-10",
                      vendorFulfilmentOpen && "border-b border-stone-300 dark:border-stone-800",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={vendorFulfilmentOpen}
                      onClick={() => setVendorFulfilmentOpen((current) => !current)}
                      className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                    >
                      <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">
                        Fulfilment
                      </span>
                      <span className="flex items-center gap-2">
                        {selectedVendorFulfilmentCount > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                            {selectedVendorFulfilmentCount}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-500 dark:group-active:text-stone-500",
                            vendorFulfilmentOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </div>

                  <AnimatedCollapsible open={vendorFulfilmentOpen}>
                    <div className="space-y-2 pt-3">
                      {vendorFilterOptions.fulfilment.map((fulfilmentOption) => {
                        const isActive = currentSelectedVendorFulfilment.includes(fulfilmentOption);
                        return (
                          <button
                            type="button"
                            aria-pressed={isActive}
                            key={fulfilmentOption}
                            onClick={() => toggleVendorFulfilment(fulfilmentOption)}
                            className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                isActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                              )}
                            >
                              {isActive ? <Check className="size-3.5" /> : null}
                            </span>
                            <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                              {fulfilmentOption}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </AnimatedCollapsible>
                </div>

                <button
                  type="button"
                  aria-pressed={currentSelectedHairstylistOwned}
                  onClick={toggleHairstylistOwned}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                      currentSelectedHairstylistOwned && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                    )}
                  >
                    {currentSelectedHairstylistOwned ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                    Hairstylist-owned
                  </span>
                </button>
              </>
            ) : (
              <>
            <div className="pt-6">
              <div className="space-y-2">
                <label htmlFor="sort-results" className="sr-only">
                  Sort results
                </label>
                <div className="relative">
                  <select
                    id="sort-results"
                    aria-label="Sort results"
                    value={currentSortOption}
                    onChange={(event) => {
                      const nextSort = event.target.value as SortOption;
                      trackAnalyticsEvent("sort_changed", { sort: nextSort });
                      updateSortOption(nextSort);
                    }}
                    className="min-h-11 w-full appearance-none rounded-none border border-stone-300 bg-stone-50 pl-4 pr-12 py-2 text-[13px] text-stone-900 outline-none transition-colors hover:border-stone-400 active:border-stone-400 focus:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500 dark:active:border-stone-500 dark:focus:border-stone-100"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-stone-500 dark:text-stone-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>


              <div>
                <div
                  className={cn(
                    "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-10",
                    servicesOpen && "border-b border-stone-300 dark:border-stone-800",
                  )}
                >
                    <button
                      type="button"
                      aria-expanded={servicesOpen}
                      onClick={toggleServicesOpen}
                    className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                    >
                    <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">Services</span>
                    <span className="flex items-center gap-2">
                      {selectedServiceCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                          {selectedServiceCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-500 dark:group-active:text-stone-500", servicesOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </div>

                <AnimatedCollapsible open={servicesOpen}>
                  <div className="space-y-2 pt-3">
                    <div className="relative mb-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        aria-label="Search services"
                        placeholder="Search services"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="h-10 w-full border border-stone-300 bg-white pl-9 pr-9 text-[13px] text-stone-800 placeholder-stone-400 outline-none focus:border-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:placeholder-stone-500 dark:focus:border-stone-400"
                      />
                      {serviceSearch ? (
                        <button
                          type="button"
                          onClick={() => setServiceSearch("")}
                          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
                          aria-label="Clear service search"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                    {runtimeSortedCategoryEntries.filter(([id, item]) => {
                      if (!serviceSearch.trim()) return true;
                      const q = normalizeServiceSearch(serviceSearch);
                      if (normalizeServiceSearch(item.label).includes(q)) return true;
                      if (item.subcategories.some((s) => s !== "all" && normalizeServiceSearch(s).includes(q))) return true;
                      const aliases = serviceSearchAliases[item.label] ?? [];
                      if (aliases.some((alias) => normalizeServiceSearch(alias).includes(q))) return true;
                      return item.subcategories.some((s) => s !== "all" && (serviceSearchAliases[s] ?? []).some((alias) => normalizeServiceSearch(alias).includes(q)));
                    }).map(([id, item]) => {
                      const isAllServices = id === "all";
                      const isActive = isAllServices
                        ? currentSelectedCategories.length === 0 && currentSelectedSubcategories.length === 0
                        : isCategorySelected(id as ServiceCategoryId);
                      const categoryLabelId = makeFilterLabelId("service-category", id);
                      const searchQ = normalizeServiceSearch(serviceSearch);
                      const visibleSubcategories = item.subcategories
                        .filter((subItem) => subItem !== "all")
                        .filter((subItem) => !searchQ || normalizeServiceSearch(subItem).includes(searchQ) || (serviceSearchAliases[subItem] ?? []).some((alias) => normalizeServiceSearch(alias).includes(searchQ)))
                        .sort((left, right) => left.localeCompare(right));
                      const showSubcategories =
                        !isAllServices &&
                        (isCategorySelected(id as ServiceCategoryId) || categoryHasSelectedSubcategories(id as ServiceCategoryId) || (!!searchQ && visibleSubcategories.length > 0));

                      return (
                        <div key={id} className="space-y-2">
                          <button
                            type="button"
                            aria-pressed={isActive}
                            className={cn(
                              "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                            )}
                            onClick={() => toggleCategory(id as CategoryId)}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                isActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                              )}
                            >
                              {isActive ? <Check className="size-3.5" /> : null}
                            </span>
                            <span id={categoryLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                              {item.label}
                            </span>
                          </button>

                          {showSubcategories && visibleSubcategories.length > 0 ? (
                            <div className="space-y-2 pl-8">
                              {visibleSubcategories.map((itemSubcategory) => {
                                const subcategoryLabelId = makeFilterLabelId("service-subcategory", id, itemSubcategory);
                                const isSubcategoryActive = currentSelectedSubcategories.includes(
                                  itemSubcategory as ServiceSubcategoryId,
                                );

                                return (
                                  <button
                                    type="button"
                                    aria-pressed={isSubcategoryActive}
                                    aria-labelledby={subcategoryLabelId}
                                    key={itemSubcategory}
                                    className={cn(
                                      "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                                    )}
                                    onClick={() => toggleSubcategory(itemSubcategory as ServiceSubcategoryId)}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                        isSubcategoryActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                                      )}
                                    >
                                      {isSubcategoryActive ? <Check className="size-3.5" /> : null}
                                    </span>
                                    <span id={subcategoryLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                      {getServiceDisplayName(itemSubcategory)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </AnimatedCollapsible>
              </div>

            <div>
                <div
                  className={cn(
                    "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20",
                    locationsOpen && "border-b border-stone-300 dark:border-stone-800",
                  )}
                >
                  <div>
                    <button
                      type="button"
                      aria-expanded={locationsOpen}
                      onClick={toggleLocationsOpen}
                      className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                    >
                      <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">Locations</span>
                      <span className="flex items-center gap-2">
                        {selectedLocationCount > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                            {selectedLocationCount}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400 dark:group-active:text-stone-400", locationsOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <AnimatedCollapsible open={locationsOpen}>
                  <div className="space-y-2 pt-3">
                    {(() => {
                      const allLocations = runtimeRegions.find((item) => item.id === "all");
                      const allLocationsLabelId = allLocations ? makeFilterLabelId("region", allLocations.id) : "";

                      return allLocations ? (
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={isRegionSelected(allLocations.id)}
                          aria-labelledby={allLocationsLabelId}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                          )}
                          onClick={() => toggleRegion(allLocations.id)}
                          onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(allLocations.id))}
                        >
                          <Checkbox
                            checked={isRegionSelected(allLocations.id)}
                            aria-hidden="true"
                            tabIndex={-1}
                            className="pointer-events-none mt-0.5"
                          />
                          <span id={allLocationsLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            {allLocations.label}
                          </span>
                        </div>
                      ) : null;
                    })()}

                    {runtimeParentGroups.map((group) => {
                      const parent = runtimeRegions.find((item) => item.id === group.id);
                      if (!parent) return null;
                      const groupExpanded = isRegionSelected(group.id) || group.childIds.some((regionId) => isRegionSelected(regionId));
                      const parentLabelId = makeFilterLabelId("region", parent.id);

                      return (
                        <div key={group.id}>
                          <div
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isRegionSelected(parent.id)}
                            aria-labelledby={parentLabelId}
                            className={cn(
                              "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                            )}
                            onClick={() => toggleRegion(parent.id)}
                            onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(parent.id))}
                          >
                            <Checkbox
                              checked={isRegionSelected(parent.id)}
                              aria-hidden="true"
                              tabIndex={-1}
                              className="pointer-events-none mt-0.5"
                            />
                            <span id={parentLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                              {parent.label}
                            </span>
                          </div>

                          {groupExpanded ? (
                            <div className="space-y-2 pl-8">
                              {group.childIds.map((regionId) => {
                                const item = runtimeRegions.find((regionItem) => regionItem.id === regionId);
                                if (!item) return null;
                                const regionLabelId = makeFilterLabelId("region", item.id);

                                return (
                                  <div
                                    role="checkbox"
                                    tabIndex={0}
                                    aria-checked={isRegionSelected(item.id)}
                                    aria-labelledby={regionLabelId}
                                    key={item.id}
                                    className={cn(
                                      "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                                    )}
                                    onClick={() => toggleRegion(item.id)}
                                    onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(item.id))}
                                  >
                                    <Checkbox
                                      checked={isRegionSelected(item.id)}
                                      aria-hidden="true"
                                      tabIndex={-1}
                                      className="pointer-events-none mt-0.5"
                                    />
                                    <span id={regionLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                      {getRegionDisplayLabel(item.id, item.label, { abbreviate: true })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {runtimeStandaloneIds.map((regionId) => {
                      const item = runtimeRegions.find((regionItem) => regionItem.id === regionId);
                      if (!item) return null;
                      const regionLabelId = makeFilterLabelId("region", item.id);

                      return (
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={isRegionSelected(item.id)}
                          aria-labelledby={regionLabelId}
                          key={item.id}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900",
                          )}
                          onClick={() => toggleRegion(item.id)}
                          onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(item.id))}
                        >
                          <Checkbox
                            checked={isRegionSelected(item.id)}
                            aria-hidden="true"
                            tabIndex={-1}
                            className="pointer-events-none mt-0.5"
                          />
                          <span id={regionLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </AnimatedCollapsible>
              </div>

              <div>
                <div
                  className={cn(
                    "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20",
                    priceRangesOpen && "border-b border-stone-300 dark:border-stone-800",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={priceRangesOpen}
                    onClick={togglePriceRangesOpen}
                    className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                  >
                    <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">
                      Average price
                    </span>
                    <span className="flex items-center gap-2">
                      {selectedPriceRangeCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                          {selectedPriceRangeCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400 dark:group-active:text-stone-400", priceRangesOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </div>

                <AnimatedCollapsible open={priceRangesOpen}>
                  <div className="space-y-2 pt-3">
                    <p className="px-2 text-[12px] leading-4 text-stone-500 dark:text-stone-500">
                      The median price of all services on a booking site. Some services may be more or less than this price range. Some providers do not list their prices online.
                    </p>
                    {priceRangeOptions.map((option) => {
                      const isActive = currentSelectedPriceBands.includes(option.id);

                      return (
                        <button
                          type="button"
                          aria-pressed={isActive}
                          key={option.id}
                          onClick={() => togglePriceBand(option.id)}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                              isActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                            )}
                          >
                            {isActive ? <Check className="size-3.5" /> : null}
                          </span>
                          <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </AnimatedCollapsible>
              </div>

            <div>
              <div
                className={cn(
                  "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-10",
                  reviewsFilterOpen && "border-b border-stone-300 dark:border-stone-800",
                )}
              >
                <button
                  type="button"
                  aria-expanded={reviewsFilterOpen}
                  onClick={toggleReviewsFilterOpen}
                  className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                >
                  <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">Reviews</span>
                  <span className="flex items-center gap-2">
                    {selectedReviewsCount > 0 ? (
                      <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                        {selectedReviewsCount}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400 dark:group-active:text-stone-400", reviewsFilterOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </div>

              <AnimatedCollapsible open={reviewsFilterOpen}>
                <div className="space-y-2 pt-3">
                  {(() => {
                    const allReviewsLabelId = makeFilterLabelId("reviews", "all");
                    const googleOnlyLabelId = makeFilterLabelId("reviews", "google-only");
                    const bookingSitesOnlyLabelId = makeFilterLabelId("reviews", "booking-sites-only");

                    return (
                      <>
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={currentSelectedHasVerifiedReviews}
                          aria-labelledby={allReviewsLabelId}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                          onClick={toggleHasVerifiedReviews}
                          onKeyDown={(event) => handleToggleKeyDown(event, toggleHasVerifiedReviews)}
                        >
                          <Checkbox
                            checked={currentSelectedHasVerifiedReviews}
                            aria-hidden="true"
                            tabIndex={-1}
                            className="pointer-events-none mt-0.5"
                          />
                          <span id={allReviewsLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            All reviews
                          </span>
                        </div>

                        {currentSelectedHasVerifiedReviews || currentSelectedGoogleReviewsOnly || currentSelectedBookingSitesOnly ? (
                          <div className="space-y-2 pl-8">
                            <div
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={currentSelectedGoogleReviewsOnly}
                              aria-labelledby={googleOnlyLabelId}
                              className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                              onClick={toggleGoogleReviewsOnly}
                              onKeyDown={(event) => handleToggleKeyDown(event, toggleGoogleReviewsOnly)}
                            >
                              <Checkbox
                                checked={currentSelectedGoogleReviewsOnly}
                                aria-hidden="true"
                                tabIndex={-1}
                                className="pointer-events-none mt-0.5"
                              />
                              <span id={googleOnlyLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                Google
                              </span>
                            </div>

                            <div
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={currentSelectedBookingSitesOnly}
                              aria-labelledby={bookingSitesOnlyLabelId}
                              className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                              onClick={toggleBookingSitesOnly}
                              onKeyDown={(event) => handleToggleKeyDown(event, toggleBookingSitesOnly)}
                            >
                              <Checkbox
                                checked={currentSelectedBookingSitesOnly}
                                aria-hidden="true"
                                tabIndex={-1}
                                className="pointer-events-none mt-0.5"
                              />
                              <span id={bookingSitesOnlyLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                Booking sites (e.g. Fresha, Treatwell)
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </AnimatedCollapsible>
            </div>

              <div>
                <div
                  className={cn(
                    "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20",
                    additionalNeedsOpen && "border-b border-stone-300 dark:border-stone-800",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={additionalNeedsOpen}
                    onClick={toggleAdditionalNeedsOpen}
                    className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                  >
                    <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">
                      Additional needs
                    </span>
                    <span className="flex items-center gap-2">
                      {selectedAdditionalNeedsCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                          {selectedAdditionalNeedsCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400 dark:group-active:text-stone-400", additionalNeedsOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </div>

                <AnimatedCollapsible open={additionalNeedsOpen}>
                  <div className="space-y-2 pt-3">
                    <p className="px-2 text-[12px] leading-4 text-stone-500 dark:text-stone-500">
                      You may need to double-check with the salon or stylist beforehand to confirm the following
                    </p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        aria-pressed={currentSelectedSellingHair}
                        onClick={toggleSellingHair}
                        className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                            currentSelectedSellingHair && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                          )}
                        >
                          {currentSelectedSellingHair ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                          Sells hair
                        </span>
                      </button>

                      {showSellingHairSubfilters ? (
                      <div className="space-y-2 pl-8">
                        <button
                          type="button"
                          aria-pressed={currentSelectedPriceIncludesHair}
                          onClick={togglePriceIncludesHair}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                              currentSelectedPriceIncludesHair && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                            )}
                          >
                            {currentSelectedPriceIncludesHair ? <Check className="size-3.5" /> : null}
                          </span>
                          <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            Hair-inclusive packages available
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-pressed={currentSelectedSellsHairSeparately}
                          onClick={toggleSellsHairSeparately}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                              currentSelectedSellsHairSeparately && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                            )}
                          >
                            {currentSelectedSellsHairSeparately ? <Check className="size-3.5" /> : null}
                          </span>
                          <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                            Hair sold separately
                          </span>
                        </button>
                      </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      aria-pressed={currentSelectedWheelchairAccessible}
                      onClick={toggleWheelchairAccessible}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedWheelchairAccessible && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedWheelchairAccessible ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        Wheelchair accessible entrance
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={currentSelectedHijabiFriendly}
                      onClick={toggleHijabiFriendly}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedHijabiFriendly && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedHijabiFriendly ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        Hijabi-friendly
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={currentSelectedSameDayEmergency}
                      onClick={toggleSameDayEmergency}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedSameDayEmergency && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedSameDayEmergency ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        Same-day / walk-ins
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={currentSelectedLgbtqFriendly}
                      onClick={toggleLgbtqFriendly}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedLgbtqFriendly && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedLgbtqFriendly ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        LGBTQIA+-friendly
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={currentSelectedCanBraidWithoutGel}
                      onClick={toggleCanBraidWithoutGel}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedCanBraidWithoutGel && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedCanBraidWithoutGel ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        Can braid without gel
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={currentSelectedSenFriendly}
                      onClick={toggleSenFriendly}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                          currentSelectedSenFriendly && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                        )}
                      >
                        {currentSelectedSenFriendly ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                        Sensory-safe / SEN-friendly
                      </span>
                    </button>
                  </div>
                </AnimatedCollapsible>
              </div>

              {customFilterTypes.map((filterType) => {
                const isOpen = openCustomFilterTypeId === filterType.id;
                const selectedCount = selectedCustomFilterCounts[filterType.id] ?? 0;
                const selectedValues = currentSelectedCustomFilters[filterType.id] ?? [];
                return (
                  <div key={filterType.id}>
                    <div
                      className={cn(
                        "bg-stone-100 pb-2 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20",
                        isOpen && "border-b border-stone-300 dark:border-stone-800",
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleCustomFilterTypeOpen(filterType.id)}
                        className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent px-0 py-2 text-left"
                      >
                        <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500 dark:group-active:text-stone-500">
                          {filterType.label}
                        </span>
                        <span className="flex items-center gap-2">
                          {selectedCount > 0 ? (
                            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                              {selectedCount}
                            </span>
                          ) : null}
                          <ChevronDown
                            className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 group-active:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400 dark:group-active:text-stone-400", isOpen && "rotate-180")}
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                    </div>

                    <AnimatedCollapsible open={isOpen}>
                      {filterType.behavior === "toggle-group" ? (
                        <div className="space-y-2 pt-3">
                          {filterType.options.map((option) => {
                            const isActive = selectedValues.includes(option.id);
                            return (
                              <button
                                type="button"
                                aria-pressed={isActive}
                                key={option.id}
                                onClick={() => toggleCustomFilterOption(filterType.id, option.id)}
                                className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 active:bg-stone-200 dark:hover:bg-stone-900 dark:active:bg-stone-900"
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-500 bg-white text-white transition dark:border-stone-500 dark:bg-stone-900",
                                    isActive && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950",
                                  )}
                                >
                                  {isActive ? <Check className="size-3.5" /> : null}
                                </span>
                                <span className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-3">
                          {filterType.options.map((option) => {
                            const isActive = selectedValues.includes(option.id);
                            return (
                              <button
                                type="button"
                                aria-pressed={isActive}
                                key={option.id}
                                onClick={() => toggleCustomFilterOption(filterType.id, option.id)}
                                className={cn(
                                  "rounded-none border px-3 py-1.5 text-[13px] font-medium transition-colors",
                                  isActive
                                    ? "border-stone-950 bg-stone-950 text-stone-100 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                                    : "border-stone-400 bg-white text-stone-700 hover:bg-stone-200 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800",
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </AnimatedCollapsible>
                  </div>
                );
              })}
              </>
            )}
          </section>
          {mobileFiltersOpen ? (
            <div className="shrink-0 border-t border-stone-300 bg-stone-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-stone-800 dark:bg-stone-950 sm:px-6 lg:hidden">
              <button
                type="button"
                onClick={applyMobileFilters}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-none bg-stone-950 px-5 py-3 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300"
              >
                Apply
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      <footer className="mt-auto border-t border-stone-300 px-6 pb-4 pt-10 dark:border-stone-800 sm:px-10">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="flex max-w-sm flex-col gap-4">
              <img src="/icon.svg" alt="" className="size-8 shrink-0 border border-stone-300 dark:border-stone-700" />
            </div>
            <div className="flex flex-col gap-10 sm:ml-auto sm:flex-row">
              <div className="flex flex-col items-start gap-3.5">
                <h3 className="text-[14px] font-semibold text-stone-950 dark:text-stone-50">Disclaimers</h3>
                <button
                  type="button"
                  onClick={openPrivacyModal}
                  className="inline-flex items-center gap-1 text-[14px] font-medium text-stone-700 transition-colors hover:text-stone-900 active:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
                >
                  Privacy statement
                </button>
                <button
                  type="button"
                  onClick={openSiteDisclaimerModal}
                  className="inline-flex items-center gap-1 text-[14px] font-medium text-stone-700 transition-colors hover:text-stone-900 active:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
                >
                  Site disclaimer
                </button>
              </div>
              <div className="flex flex-col items-start gap-3.5">
                <h3 className="text-[14px] font-semibold text-stone-950 dark:text-stone-50">Get in touch</h3>
                <button
                  type="button"
                  onClick={copyFooterEmail}
                  className="inline-flex items-center gap-1.5 text-[14px] text-stone-700 transition-colors hover:text-stone-900 active:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
                >
                  hello@row-k.london
                  {emailCopied ? (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="sr-only">{emailCopied ? "Email copied to clipboard" : "Copy email to clipboard"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSubmissionModal("footer")}
                  className="inline-flex items-center gap-1 text-[14px] font-medium text-stone-700 transition-colors hover:text-stone-900 active:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
                >
                  Submit a stylist
                </button>
              </div>
            </div>
          </div>
          <div className="mt-8">
            <span className="text-[14px] text-stone-700 dark:text-stone-300">ROW K 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
