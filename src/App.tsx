import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Globe, Search, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { AdminApp } from "@/AdminApp";
import { trackEvent as trackAnalyticsEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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

type RegionParentGroup = { id: string; label: string; childIds: string[] };
const defaultRegionParentGroups: RegionParentGroup[] = [
  { id: "all-london", label: "London", childIds: ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"] },
];
const standaloneRegionIds = ["kent", "essex", "mobile"] as const;

const DISCLAIMER_DISMISSED_KEY = "rowk_disclaimer_dismissed";

const categoryMap = {
  all: { label: "All services", subcategories: ["all"] },
  "braiding-services": { label: "Braids", subcategories: ["all","Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob"] },
  "colour-services": { label: "Colour", subcategories: ["all","Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"] },
  "bridal-services": { label: "Bridal", subcategories: ["all","Bridal"] },
  "editorial-services": { label: "Editorial / Session styling", subcategories: ["all","Editorial / Session styling"] },
  "kids-teens-services": { label: "Kids & teens styles", subcategories: ["all","Kids & teens styles"] },
  "extension-services": { label: "Extensions", subcategories: ["all","Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"] },
  "locs-services": { label: "Locs", subcategories: ["all","Butterfly locs","Faux locs","Microlocs / sisterlocs","Retwist","Starter locs"] },
  "sew-in-weave": { label: "Sew in / weave", subcategories: ["all","Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"] },
  "styling-services": { label: "Styling (sew in / frontal / relaxer)", subcategories: ["all","Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie cut / finger waves","Sleek ponytail / bun","Updo"] },
  "straightening-treatments": { label: "Treatments", subcategories: ["all","Hair botox","Japanese straightening","K-18 treatment","Keratin treatment","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"] },
  "natural-hair-services": { label: "Natural hair washing & styling", subcategories: ["all","Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Wash & blowdry","Japanese head spa","Scalp detox / treatments"] },
  "natural-hair-scalp-health": { label: "Natural hair health & trichology", subcategories: ["all","Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"] },
  "wig-services": { label: "Wigs", subcategories: ["all","Custom wig","Pixie wig / weave install","U-part wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry"] },
} as const;

const categoryServiceMap = {
  "braiding-services": ["Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob"],
  "colour-services": ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"],
  "bridal-services": ["Bridal"],
  "editorial-services": ["Editorial / Session styling"],
  "kids-teens-services": ["Kids & teens styles"],
  "extension-services": ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"],
  "locs-services": ["Butterfly locs","Faux locs","Microlocs / sisterlocs","Retwist","Starter locs"],
  "sew-in-weave": ["Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"],
  "styling-services": ["Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie cut / finger waves","Sleek ponytail / bun","Updo"],
  "straightening-treatments": ["Hair botox","Japanese straightening","K-18 treatment","Keratin treatment","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"],
  "natural-hair-services": ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Wash & blowdry","Japanese head spa","Scalp detox / treatments"],
  "natural-hair-scalp-health": ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"],
  "wig-services": ["Custom wig","Pixie wig / weave install","U-part wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry"],
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

  services: string[];
  hijabiFriendly?: boolean;
  canBraidWithoutGel?: boolean;
  wheelchairAccessible?: boolean;
  temporarilyClosed?: boolean;
  hasVerifiedReviews?: boolean;
  verifiedReviewCount?: number;
  googleMapsUri?: string;
  googleReviewCount?: number;
  googleMatchConfidence?: "high" | "low" | "no-match";
  customFilters?: Record<string, string[]>;
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: "service-only" | "mixed" | "package-only";
  summary: string;
  source: string;
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

const regionLabelMap = Object.fromEntries(regions.map((region) => [region.id, region.label])) as Record<string, string>;
const resultLocationLabelMap: Record<string, string> = {
  "all-london": "London",
  central: "Central London",
  north: "North London",
  "north-west": "North west London",
  east: "East London",
  "south-east": "South east London",
  "south-west": "South west London",
  west: "West London",
  south: "South London",
};

const serviceDisplayNames: Record<string, string> = {
  "Wig cornrows": "Cornrows / Twists / Wig cornrows",
};

function getServiceDisplayName(service: string) {
  return serviceDisplayNames[service] ?? service;
}

function normalizeServiceSearch(s: string) {
  return s.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

const serviceSearchAliases: Record<string, string[]> = {
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
  "U-part wig install": ["u part", "upart", "u-part", "u part wig", "u-part wig", "v part", "vpart", "v-part"],
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
  "Faux locs": ["faux locs", "invisible locs", "soft locs"],
  "Starter locs": ["starter locs", "start locs", "loc start"],
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

const verifiedReviewPlatformHostnames: [string, string][] = [
  ["fresha.com", "Fresha"],
  ["treatwell.co.uk", "Treatwell"],
  ["booksy.com", "Booksy"],
  ["vagaro.com", "Vagaro"],
  ["styleseat.com", "StyleSeat"],
  ["setmore.com", "Setmore"],
];

function getVerifiedReviewsPlatform(result: SalonResult): string | null {
  const url = (result.bookingUrl || "").toLowerCase();
  return verifiedReviewPlatformHostnames.find(([hostname]) => url.includes(hostname))?.[1] ?? null;
}

function getVerifiedReviewsUrl(result: SalonResult): string {
  const bookingUrl = result.bookingUrl || "";
  const platform = getVerifiedReviewsPlatform(result);
  if (platform !== "Fresha" && platform !== "Treatwell" && platform !== "Setmore") {
    return bookingUrl;
  }

  for (const candidate of [bookingUrl, `https://${bookingUrl}`]) {
    try {
      const url = new URL(candidate);
      if (platform === "Fresha") {
        url.searchParams.set("reviews", "true");
      } else if (platform === "Setmore") {
        // Setmore has a dedicated /reviews route off the booking page root.
        url.pathname = `${url.pathname.replace(/\/+$/, "")}/reviews`;
      } else {
        // widget.treatwell.co.uk is a stripped-down booking embed with no reviews
        // section at all; the same /place/{slug}/ path on the main site has one.
        if (url.hostname === "widget.treatwell.co.uk") {
          url.hostname = "www.treatwell.co.uk";
        }
        // Treatwell's reviews button just scrolls to this in-page section;
        // there's no query param, so a fragment does the same thing.
        url.hash = "reviews";
      }
      return url.toString();
    } catch {
      continue;
    }
  }

  return bookingUrl;
}

function getReviewsBannerInfo(result: SalonResult): { label: string; url: string; accessibleLabel: string } | null {
  if (result.googleMatchConfidence === "high" && Number(result.googleReviewCount) > 0 && result.googleMapsUri) {
    return { label: "Google reviews available", url: result.googleMapsUri, accessibleLabel: `Google reviews for ${result.name} available` };
  }

  const platform = getVerifiedReviewsPlatform(result);
  if (platform && Number(result.verifiedReviewCount) > 0) {
    return { label: `Reviews on ${platform}`, url: getVerifiedReviewsUrl(result), accessibleLabel: `Reviews for ${result.name} on ${platform}` };
  }

  return null;
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
      className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-5 text-left last:border-b-0 dark:border-stone-800"
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
    ? [result.areaLabel || "South"]
    : [...new Set(areaIds.map((areaId) => regionLabelMap[areaId]).filter(Boolean))];

  if (!locationLabels.length && result.areaLabel) {
    locationLabels.push(result.areaLabel);
  }

  return locationLabels.map((label) => resultLocationLabelMap[label.toLowerCase().replace(/\s+/g, "-")] ?? label);
}

function BrandGroupCard({
  brandBranches,
  orderedServices,
  customFilterTypes,
}: {
  brandBranches: SalonResult[];
  orderedServices: string[];
  customFilterTypes: CustomFilterType[];
}) {
  const [expanded, setExpanded] = useState(false);
  const brand = brandBranches[0];
  const brandName = brand.brandName ?? brand.name;
  // Temporarily closed branches are hidden entirely — not worth showing a
  // branch a customer can't currently visit.
  const openBranches = brandBranches.filter((branch) => !branch.temporarilyClosed);
  // Wheelchair access is branch-specific (shown per-row below); these other
  // attributes live on the shared brand record, so they show once here,
  // same position/style as the badge on a regular single-location card.
  const attributeLabels = [
    brand.hijabiFriendly ? "hijabi-friendly" : null,
    brand.canBraidWithoutGel ? "can braid without gel" : null,
    ...getResultCustomFilterLabels(brand, customFilterTypes),
  ].filter((label): label is string => Boolean(label));

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

  return (
    <li
      ref={setRef}
      className="flex w-full flex-col items-start gap-3 border-b border-stone-300 px-0 py-5 text-left last:border-b-0 dark:border-stone-800"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">{brandName}</h3>
            <span className="inline-block rounded-none border border-stone-300 bg-stone-100 px-1.5 py-1 text-[11px] font-semibold leading-none tracking-[0.06em] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
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
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {brand.instagramUrl ? (
            <a
              href={brand.instagramUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAnalyticsEvent("instagram_click", { salon: brandName, placement: "brand-group" })}
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-2 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:min-h-[40px]"
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
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-none bg-stone-950 px-4 py-2 text-[13px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300 sm:min-h-[40px]"
            >
              <span aria-hidden="true">Book</span>
              <span className="sr-only">Book {brandName} - opens in a new tab</span>
            </a>
          ) : null}
        </div>
      </div>

      {orderedServices.length > 0 ? (
        <div className="w-full rounded-none border-l-4 border-stone-300 bg-stone-200/45 pl-2 pr-3 py-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:bg-stone-900/48 dark:text-stone-300">
          <ServicesSummary services={orderedServices} badgeLabel={attributeLabels.length > 0 ? attributeLabels.join(" · ") : null} />
        </div>
      ) : null}

      <div className="w-full divide-y divide-stone-200 border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {visibleBranches.map((branch) => {
          const reviewsBanner = getReviewsBannerInfo(branch);
          const branchLocation = getLocationLabels(branch).join(" · ");
          return (
            <div key={branch.id} className="flex items-start justify-between gap-3 px-3 py-3">
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
                    className="mt-0.5 inline-flex w-fit items-center gap-1 text-[13px] font-medium text-[oklch(0.45_0.11_255)] transition-colors hover:text-[oklch(0.38_0.11_255)] active:text-[oklch(0.38_0.11_255)] dark:text-[oklch(0.72_0.10_255)] dark:hover:text-[oklch(0.80_0.09_255)] dark:active:text-[oklch(0.80_0.09_255)]"
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
              {!sharedBookingUrl && branch.bookingUrl ? (
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

function ServicesSummary({ services, badgeLabel }: { services: string[]; badgeLabel?: string | null }) {
  const lineRef = useRef<HTMLDivElement | null>(null);
  const separatorMeasureRef = useRef<HTMLSpanElement | null>(null);
  const badgeMeasureRef = useRef<HTMLSpanElement | null>(null);
  const serviceMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const suffixMeasureRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const [visibleCount, setVisibleCount] = useState(services.length);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isExpandedOnMobile, setIsExpandedOnMobile] = useState(false);
  const [isHoveredOnDesktop, setIsHoveredOnDesktop] = useState(false);

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
      // The badge is always shown, never part of the truncation count — its width
      // (plus the gap before the first service) just eats into the line's budget.
      const badgeWidth = badgeLabel ? (badgeMeasureRef.current?.offsetWidth ?? 0) + (services.length > 0 ? separatorWidth : 0) : 0;

      let nextVisibleCount = services.length;

      for (let count = services.length; count >= 0; count -= 1) {
        const hiddenCount = services.length - count;
        const visibleServicesWidth = serviceWidths.slice(0, count).reduce((sum, width) => sum + width, 0);
        const visibleSeparatorsWidth = Math.max(0, count - 1) * separatorWidth;
        const suffixWidth =
          hiddenCount > 0 ? (suffixMeasureRefs.current[hiddenCount]?.offsetWidth ?? 0) + (count > 0 ? separatorWidth : 0) : 0;

        if (badgeWidth + visibleServicesWidth + visibleSeparatorsWidth + suffixWidth <= availableWidth - safetyBuffer) {
          nextVisibleCount = count;
          break;
        }
      }

      setVisibleCount(nextVisibleCount);
    };

    measure();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(lineElement);

    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [services, badgeLabel]);

  useEffect(() => {
    setIsExpandedOnMobile(false);
  }, [services]);

  useEffect(() => {
    if (isMobileViewport) {
      setIsHoveredOnDesktop(false);
    }
  }, [isMobileViewport]);

  const hiddenCount = Math.max(0, services.length - visibleCount);
  const fullServicesLabel = services.join(" · ");
  const fullAriaLabel = badgeLabel ? `${badgeLabel} · ${fullServicesLabel}` : fullServicesLabel;
  const isExpandableOnMobile = isMobileViewport && hiddenCount > 0;
  const isExpandableOnDesktop = !isMobileViewport && hiddenCount > 0;
  const showExpandedList = isExpandableOnMobile && isExpandedOnMobile;
  const showExpandedOnDesktop = isExpandableOnDesktop && isHoveredOnDesktop;
  const badgeElement = badgeLabel ? (
    <span
      ref={badgeMeasureRef}
      className="mr-1.5 inline-block rounded-none border border-[oklch(0.72_0.07_86)]/35 bg-[oklch(0.94_0.025_92)] px-1.5 py-1 align-baseline text-[11px] font-semibold leading-none tracking-[0.06em] text-[oklch(0.44_0.08_80)] dark:bg-[oklch(0.44_0.08_80)] dark:text-[oklch(0.94_0.025_92)]"
    >
      {badgeLabel}
    </span>
  ) : null;
  const collapsedSummary = (
    <>
      {badgeElement}
      {services.slice(0, visibleCount).map((service, index) => (
        <Fragment key={`${service}-${index}`}>
          {index > 0 ? <span className="text-stone-500/70 dark:text-stone-500/80"> · </span> : null}
          <span>{getServiceDisplayName(service)}</span>
        </Fragment>
      ))}
      {hiddenCount > 0 ? (
        <>
          {visibleCount > 0 ? <span className="text-stone-500/70 dark:text-stone-500/80"> · </span> : null}
          <span className="text-stone-600 dark:text-stone-400">+ {hiddenCount} {hiddenCount === 1 ? "service" : "services"}</span>
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
            className={cn(showExpandedList ? "whitespace-normal" : "overflow-hidden whitespace-nowrap")}
            aria-label={fullAriaLabel}
          >
            {showExpandedList ? <>{badgeElement}{fullServicesLabel}</> : collapsedSummary}
          </div>
        </>
      ) : showExpandedOnDesktop ? (
        <div ref={lineRef} className="whitespace-normal" aria-label={fullAriaLabel}>
          {badgeElement}
          {fullServicesLabel}
        </div>
      ) : (
        <div ref={lineRef} className="overflow-hidden whitespace-nowrap" aria-label={fullAriaLabel}>
          {collapsedSummary}
        </div>
      )}

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
  const [draftSelectedHasVerifiedReviews, setDraftSelectedHasVerifiedReviews] = useState(false);
  const [draftSelectedGoogleReviewsOnly, setDraftSelectedGoogleReviewsOnly] = useState(false);
  const [draftSortOption, setDraftSortOption] = useState<SortOption>("default");
  const [visibleResultCount, setVisibleResultCount] = useState(RESULTS_BATCH_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const [selectedHasVerifiedReviews, setSelectedHasVerifiedReviews] = useState(false);
  const [selectedGoogleReviewsOnly, setSelectedGoogleReviewsOnly] = useState(false);
  const [selectedPriceBands, setSelectedPriceBands] = useState<PriceRangeFilterId[]>([]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [priceRangesOpen, setPriceRangesOpen] = useState(false);
  const [additionalNeedsOpen, setAdditionalNeedsOpen] = useState(false);
  const [reviewsFilterOpen, setReviewsFilterOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMobileModalEditing = mobileFiltersOpen && !isDesktopViewport;
  const currentSelectedRegions = isMobileModalEditing ? draftSelectedRegions : selectedRegions;
  const currentSelectedCategories = isMobileModalEditing ? draftSelectedCategories : selectedCategories;
  const currentSelectedSubcategories = isMobileModalEditing ? draftSelectedSubcategories : selectedSubcategories;
  const currentSelectedPriceBands = isMobileModalEditing ? draftSelectedPriceBands : selectedPriceBands;
  const currentSelectedHijabiFriendly = isMobileModalEditing ? draftSelectedHijabiFriendly : selectedHijabiFriendly;
  const currentSelectedCanBraidWithoutGel = isMobileModalEditing ? draftSelectedCanBraidWithoutGel : selectedCanBraidWithoutGel;
  const currentSelectedWheelchairAccessible = isMobileModalEditing ? draftSelectedWheelchairAccessible : selectedWheelchairAccessible;
  const currentSelectedHasVerifiedReviews = isMobileModalEditing ? draftSelectedHasVerifiedReviews : selectedHasVerifiedReviews;
  const currentSelectedGoogleReviewsOnly = isMobileModalEditing ? draftSelectedGoogleReviewsOnly : selectedGoogleReviewsOnly;
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

  function syncDraftFiltersFromApplied() {
    setDraftSelectedRegions(selectedRegions);
    setDraftSelectedCategories(selectedCategories);
    setDraftSelectedSubcategories(selectedSubcategories);
    setDraftSelectedPriceBands(selectedPriceBands);
    setDraftSelectedHijabiFriendly(selectedHijabiFriendly);
    setDraftSelectedCanBraidWithoutGel(selectedCanBraidWithoutGel);
    setDraftSelectedWheelchairAccessible(selectedWheelchairAccessible);
    setDraftSelectedHasVerifiedReviews(selectedHasVerifiedReviews);
    setDraftSelectedGoogleReviewsOnly(selectedGoogleReviewsOnly);
    setDraftSelectedCustomFilters(selectedCustomFilters);
    setDraftSortOption(sortOption);
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
    setSelectedHasVerifiedReviews(draftSelectedHasVerifiedReviews);
    setSelectedGoogleReviewsOnly(draftSelectedGoogleReviewsOnly);
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
      selected_additional_needs: (currentSelectedHijabiFriendly ? 1 : 0) + (currentSelectedCanBraidWithoutGel ? 1 : 0) + (currentSelectedWheelchairAccessible ? 1 : 0),
      hijabi_friendly: currentSelectedHijabiFriendly,
      can_braid_without_gel: currentSelectedCanBraidWithoutGel,
      wheelchair_accessible: currentSelectedWheelchairAccessible,
      has_verified_reviews: currentSelectedHasVerifiedReviews,
      google_reviews_only: currentSelectedGoogleReviewsOnly,
    });
    updateCategories([]);
    updateSubcategories([]);
    updateRegions(["all"]);
    updatePriceBands([]);
    updateHijabiFriendly(false);
    updateCanBraidWithoutGel(false);
    updateWheelchairAccessible(false);
    updateHasVerifiedReviews(false);
    updateGoogleReviewsOnly(false);
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

  function toggleHasVerifiedReviews() {
    const nextEnabled = !currentSelectedHasVerifiedReviews;
    trackAnalyticsEvent("verified_reviews_toggle_changed", {
      enabled: nextEnabled,
    });
    updateHasVerifiedReviews(nextEnabled);
    // "Google reviews only" is nested under "All reviews" — hiding the parent
    // clears the child so it can't stay active while hidden.
    if (!nextEnabled) {
      updateGoogleReviewsOnly(false);
    }
  }

  function toggleGoogleReviewsOnly() {
    const nextEnabled = !currentSelectedGoogleReviewsOnly;
    trackAnalyticsEvent("google_reviews_only_toggle_changed", {
      enabled: nextEnabled,
    });
    updateGoogleReviewsOnly(nextEnabled);
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
          hasVerifiedReviews: selectedHasVerifiedReviews,
          googleReviewsOnly: selectedGoogleReviewsOnly,
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
        has_verified_reviews: selectedHasVerifiedReviews,
        google_reviews_only: selectedGoogleReviewsOnly,
      });

      if (resultCount === 0) {
        trackAnalyticsEvent("search_zero_results", {
          services: activeServices.join(", ") || "none",
          location: selectedRegions.join(", ") || "all",
          hijabi_friendly: selectedHijabiFriendly,
          no_gel: selectedCanBraidWithoutGel,
          wheelchair_accessible: selectedWheelchairAccessible,
          has_verified_reviews: selectedHasVerifiedReviews,
          google_reviews_only: selectedGoogleReviewsOnly,
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

  useEffect(() => {
    void handleSearch({ scroll: false });
  }, [selectedCategories, selectedSubcategories, selectedRegions, selectedHijabiFriendly, selectedCanBraidWithoutGel, selectedWheelchairAccessible, selectedHasVerifiedReviews, selectedGoogleReviewsOnly, selectedCustomFilters]);

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

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubcategories.length > 0 ||
    selectedPriceBands.length > 0 ||
    selectedHijabiFriendly ||
    selectedCanBraidWithoutGel ||
    selectedWheelchairAccessible ||
    selectedHasVerifiedReviews ||
    selectedGoogleReviewsOnly ||
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
    (currentSelectedHijabiFriendly ? 1 : 0) + (currentSelectedCanBraidWithoutGel ? 1 : 0) + (currentSelectedWheelchairAccessible ? 1 : 0);
  const selectedReviewsCount = currentSelectedHasVerifiedReviews || currentSelectedGoogleReviewsOnly ? 1 : 0;
  const selectedCustomFilterCounts = Object.fromEntries(
    customFilterTypes.map((filterType) => [filterType.id, (currentSelectedCustomFilters[filterType.id] ?? []).length]),
  );

  return (
    <div className="min-h-screen bg-stone-100 text-left dark:bg-stone-950">
      <header className="border-b border-stone-300 dark:border-stone-800">
        <div className="mx-auto flex w-full max-w-[1120px] items-start px-4 sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1 pb-10 pt-10 sm:pb-16 sm:pt-12">
            <div className="flex flex-col items-start gap-11 px-0">
              <p className="inline-flex items-center bg-stone-200 px-3 py-2 text-left text-[11px] font-bold uppercase leading-none tracking-[0.11em] text-stone-700 dark:bg-stone-700 dark:text-stone-100">
                Row K LDN
              </p>
              <div className="flex flex-col items-start gap-3">
                <h1 className="-ml-[0.045em] w-full text-left text-[38px] italic font-medium leading-[40px] tracking-tight text-stone-950 dark:text-stone-50 sm:text-[56px] sm:leading-[58px] lg:text-[68px] lg:leading-[70px] lg:whitespace-nowrap" style={{ fontFamily: "Junicode" }}>
                  Black hair directory
                </h1>
                <p className="w-full max-w-3xl text-left text-[16px] leading-[1.55] text-stone-700 dark:text-stone-300 sm:text-[19px]">
                  Find afro hair stylists in & around London.
                  <br />
                  <span className="inline-block">Natural or relaxed. Braids, sew-ins, wigs, locs.</span>
                </p>
              </div>
            </div>
          </div>
          <div className="hidden w-72 flex-none border-l border-transparent pl-8 lg:block" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col px-4 sm:px-6 lg:flex-row lg:items-start lg:px-10">
        {mobileFiltersOpen ? <div className="fixed inset-0 z-40 bg-stone-100 dark:bg-stone-950 lg:hidden" aria-hidden="true" /> : null}
        <section id="live-results" className="min-w-0 flex-1 pb-6 pt-4 lg:pb-6 lg:pr-8 lg:pt-0">
          <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-stone-300 bg-stone-100 px-0 pb-3 pt-1 dark:border-stone-800 dark:bg-stone-950 lg:h-20 lg:items-end lg:pb-6 lg:pt-2">
            {hasSearched ? (
              <h2 className="text-[14px] font-medium leading-none text-stone-500 dark:text-stone-400">
                {sortedResults.length} {sortedResults.length === 1 ? "result" : "results"}
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
              className="relative mb-1 mt-0 flex w-full items-center border-b border-stone-150 bg-stone-50 text-[12px] leading-[1.4] text-stone-600 dark:border-stone-900 dark:text-stone-400"
            >
              <span aria-hidden="true" className="h-12 w-12 shrink-0 lg:h-10 lg:w-10" />
              <div className="mx-auto flex items-center gap-2">
                <span>We don't vet, endorse, or take responsibility for any of the service providers listed</span>
              </div>
              <button
                type="button"
                onClick={dismissDisclaimer}
                aria-label="Dismiss disclaimer"
                className="flex h-12 w-12 shrink-0 items-center justify-center text-stone-400 transition hover:text-stone-700 dark:text-stone-700 dark:hover:text-stone-200 lg:h-10 lg:w-10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {searchError ? (
            <div className="mt-4 bg-rose-100 px-4 py-6 text-left dark:bg-rose-950/30">
              <h3 className="text-[17px] font-semibold text-rose-900 dark:text-rose-200">Something went wrong</h3>
              <p className="mt-2 text-sm leading-7 text-rose-800 dark:text-rose-300">You can:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7 text-rose-800 dark:text-rose-300">
                <li>
                  Refresh or 
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
                  className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-5 text-left last:border-b-0 dark:border-stone-800"
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
                        />
                      );
                    }
                  }

                  const locationLabels = getLocationLabels(result);
                  const orderedServices = orderServicesBySelection(result.services, selectedCategories, selectedSubcategories, runtimeCategoryServiceMap);

                  const activeServices = [...selectedCategories, ...selectedSubcategories].join(", ") || "none";
                  const reviewsBanner = getReviewsBannerInfo(result);
                  const attributeLabels = [
                    result.wheelchairAccessible ? "wheelchair access" : null,
                    result.hijabiFriendly ? "hijabi-friendly" : null,
                    result.canBraidWithoutGel ? "can braid without gel" : null,
                    ...getResultCustomFilterLabels(result, customFilterTypes),
                  ].filter((label): label is string => Boolean(label));

                  return (
                  <StylistCardWrapper key={result.id} result={result} services={activeServices}>
                    <article className="flex w-full flex-col gap-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-4 sm:gap-y-2.5">
                      <div className="min-w-0">
                        <div className="min-w-0 grow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="flex items-center gap-1 text-[17px] font-semibold text-stone-950 dark:text-stone-50">
                                {result.name}
                              </h3>
                              {locationLabels.length > 0 || comparablePriceBand(result) ? (
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium text-stone-500 dark:text-stone-400">
                                  {locationLabels.length > 0 ? <span>{locationLabels.join(" · ")}</span> : null}
                                  {locationLabels.length > 0 && comparablePriceBand(result) ? (
                                    <span aria-hidden="true" className="text-stone-400 dark:text-stone-500">·</span>
                                  ) : null}
                                  {comparablePriceBand(result) ? <span>{comparablePriceBand(result)}</span> : null}
                                </div>
                              ) : null}
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
                                  className="mt-1 inline-flex w-fit items-center gap-1 text-[13px] font-medium text-[oklch(0.45_0.11_255)] transition-colors hover:text-[oklch(0.38_0.11_255)] active:text-[oklch(0.38_0.11_255)] dark:text-[oklch(0.72_0.10_255)] dark:hover:text-[oklch(0.80_0.09_255)] dark:active:text-[oklch(0.80_0.09_255)]"
                                >
                                  <span aria-hidden="true">{reviewsBanner.label}</span>
                                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                                </a>
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
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 active:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800 sm:hidden"
                              >
                                <InstagramIcon className="size-4" />
                                <span className="sr-only">Go to {result.name} Instagram - opens in a new tab</span>
                              </a>
                            ) : null}
                          </div>
                        </div>

                      </div>

                      <div className="order-2 my-1 w-full rounded-none border-l-4 border-stone-300 bg-stone-200/45 pl-2 pr-3 py-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:bg-stone-900/48 dark:text-stone-300 sm:order-3 sm:col-span-2 sm:my-0 lg:mt-2">
                        <ServicesSummary services={orderedServices} badgeLabel={attributeLabels.length > 0 ? attributeLabels.join(" · ") : null} />
                      </div>

                      <div className="order-3 mt-2 flex w-full shrink-0 items-center gap-2 sm:order-2 sm:mt-0 sm:w-auto sm:self-start sm:justify-self-end">
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
                                services: [...selectedCategories, ...selectedSubcategories].join(", ") || "none",
                              })
                            }
                            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-none bg-stone-950 px-5 py-2 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 active:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 dark:active:bg-stone-300 sm:min-h-[40px] sm:flex-none sm:px-4"
                          >
                            <span aria-hidden="true">Book</span>
                            <span className="sr-only">Book {result.name} - opens in a new tab</span>
                          </a>
                        ) : null}
                      </div>
                    </article>
                  </StylistCardWrapper>
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
                <a
                  href="https://tally.so/r/VLY10g"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-[14px] font-medium text-stone-950 underline underline-offset-4 transition-colors hover:text-stone-700 dark:text-stone-100 dark:hover:text-stone-300"
                >
                  Submit a stylist
                  <span className="sr-only"> - opens in a new tab</span>
                </a>
                </div>
              </div>
            </div>
          ) : null}
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

          <div className="hidden h-20 w-full shrink-0 border-b border-stone-300 bg-stone-100 pb-4 pt-4 dark:border-stone-800 dark:bg-stone-950 lg:sticky lg:top-0 lg:z-20 lg:block">
            <div className="flex items-end justify-between">
                <div className="inline-flex h-11 items-end pb-2">
                  <h2 className="text-[15px] font-semibold leading-none text-stone-950 dark:text-stone-50">Filter / Sort</h2>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-end self-end px-2 pb-2 pt-0 text-[13px] font-medium leading-none text-stone-700 transition hover:text-stone-500 dark:text-stone-200 dark:hover:text-stone-400"
                >
                  <span>Reset</span>
                </button>
              </div>
          </div>

          <section
            aria-label="Filter options"
            className="mt-0 min-h-0 flex-1 space-y-6 overflow-y-auto px-0 pt-0 pb-6 [scrollbar-gutter:stable_both-edges] lg:min-h-0 lg:flex-1 lg:space-y-6 lg:overflow-y-scroll lg:px-0 lg:pt-0 lg:pb-6"
          >
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
                                      {item.label}
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

                        {currentSelectedHasVerifiedReviews ? (
                          <div className="pl-8">
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
                                Google reviews only
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
                                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
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

      <footer className="mt-auto border-t border-stone-300 px-6 pb-4 pt-8 dark:border-stone-800 sm:px-10">
        <div className="mx-auto w-full max-w-[1280px]">
          <p className="text-[13px] text-stone-700 dark:text-stone-300">
            Row K is not a booking platform.
          </p>
          <p className="text-[13px] text-stone-700 dark:text-stone-300">
            Row K does not vet, endorse, or take responsibility for the service providers listed.
          </p>
          <div className="mt-4 flex flex-col items-start gap-4 border-t border-stone-200 pt-4 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[14px] text-stone-700 dark:text-stone-300">ROW K 2026</span>
            <a
              href="https://tally.so/r/VLY10g"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 py-2 text-[14px] font-medium text-stone-700 transition-colors hover:text-stone-900 active:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50 dark:active:text-stone-50"
            >
              Submit a stylist
              <span className="sr-only"> - opens in a new tab</span>
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
