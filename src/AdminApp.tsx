import { FormEvent, KeyboardEvent, type ComponentType, type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ClockAlert,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Info,
  LayoutDashboard,
  Link2,
  List,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  PoundSterling,
  Pencil,
  RefreshCw,
  Save,
  Search,
  SearchCheck,
  SearchX,
  SlidersHorizontal,
  Tag,
  Trash2,
  Unlink,
  Undo2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { markAsInternalVisitor } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { getVerifiedReviewsPlatform, getVerifiedReviewsUrl } from "@/lib/verifiedReviews";

type RegionOption = {
  id: string;
  label: string;
};

type BranchDraft = {
  id: string;
  branchLabel: string;
  areaId?: string;
  areaIds?: string[];
  areaLabel?: string;
  neighbourhood?: string;
  postcode?: string;
  bookingUrl?: string;
  wheelchairAccessible?: boolean;
  temporarilyClosed?: boolean;
  googlePlaceId?: string;
  googleReviewCount?: number;
  googleMapsUri?: string;
  googleMatchConfidence?: "high" | "low" | "no-match" | "";
  googleDisplayName?: string;
  googleFormattedAddress?: string;
  googleCheckedAt?: string;
  googleMatchError?: string;
};

type StylistDraft = {
  id: string;
  status: string;
  name: string;
  branches?: BranchDraft[];
  areaId: string;
  areaIds?: string[];
  areaLabel: string;
  neighbourhood: string;
  postcode: string;
  bookingPlatform: string;
  bookingUrl: string;
  websiteUrl?: string;
  instagramUrl: string;
  tiktokUrl?: string;
  addedVia?: string;
  discoverySource?: string;
  services: string[];
  rawServices: string[];
  hijabiFriendly?: boolean;
  canBraidWithoutGel?: boolean;
  wheelchairAccessible?: boolean;
  senFriendly?: boolean;
  lgbtqFriendly?: boolean;
  parkingAvailable?: boolean;
  customFilters?: Record<string, string[]>;
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: PriceComparisonMode | "";
  priceSource?: "auto" | "manual" | "";
  priceEvidence?: string[];
  priceCheckedAt?: string;
  priceUpdatedAt?: string;
  priceConfidence?: "high" | "medium" | "low" | "manual" | "";
  summary: string;
  warnings: string[];
  evidence: string[];
  createdAt: string;
  updatedAt: string;
  googleMapsUri?: string;
  googleReviewCount?: number;
  googleMatchConfidence?: "high" | "low" | "no-match" | "";
  googleDisplayName?: string;
  verifiedReviewCount?: number;
};

type PriceBand = string;
type PriceComparisonMode = "service-only" | "mixed" | "package-only";
type CustomFilterBehavior = "toggle-group" | "tag-multiselect";
type CustomFilterOption = { id: string; label: string };
type CustomFilterType = { id: string; label: string; description: string; behavior: CustomFilterBehavior; options: CustomFilterOption[] };
type PriceBandTier = { symbol: string; label: string; maxAmount: number | null };
type AdminView = "overview" | "analytics" | "drafts" | "freshness" | "pricing" | "keyword" | "discovery" | "filters";

type AdminNavItem = { id: AdminView; label: string; icon: ComponentType<{ className?: string }> };

const ADMIN_NAV_GROUPS: { label?: string; items: AdminNavItem[] }[] = [
  {
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Directory",
    items: [
      { id: "drafts", label: "Stylists", icon: Users },
      { id: "filters", label: "Filters", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Checks",
    items: [
      { id: "freshness", label: "Health", icon: Activity },
      { id: "pricing", label: "Pricing", icon: PoundSterling },
    ],
  },
  {
    label: "Discover",
    items: [{ id: "keyword", label: "Keyword search", icon: SearchCheck }],
  },
];

type DraftForm = {
  links: string;
  name: string;
  areaId: string;
  rawServices: string;
  services: string[];
  hijabiFriendly: boolean;
  canBraidWithoutGel: boolean;
  wheelchairAccessible: boolean;
  priceBand: PriceBand | "";
  servicePriceBand: PriceBand | "";
  packagePriceBand: PriceBand | "";
  priceIncludesHair: boolean;
  priceComparisonMode: PriceComparisonMode | "";
  priceEvidence: string[];
  priceCheckedAt: string;
  priceUpdatedAt: string;
  priceConfidence: "manual" | "";
  priceSource: "manual" | "";
};

type DraftEditorStep = "details" | "services" | "review";

type DrawerTab = "basic" | "filters" | "reviews" | "branches";
type StylistSortKey = "name" | "status" | "services" | "pricing" | "location" | "discoverySource";
type StylistSortDirection = "asc" | "desc";
type StylistSort = { key: StylistSortKey; direction: StylistSortDirection } | null;

const addedViaOptions = ["Code edit", "Admin tool", "Submission form", "Bulk import", "Automated"] as const;
const discoverySourceOptions = ["Manual search", "User submission", "Stylist submission"] as const;

type KeywordSearchMatch = {
  keyword: string;
  keywords: string[];
  line: string;
  snippet: string;
  sourceType: string;
  sourceUrl: string;
};

type KeywordSearchResult = {
  id: string;
  name: string;
  areaLabel?: string;
  bookingPlatform?: string;
  bookingUrl?: string;
  instagramUrl?: string;
  status: string;
  reason?: string;
  keywords: string[];
  matches: KeywordSearchMatch[];
  checkedAt: string;
  selectedService?: string;
  selectedServiceAssigned?: boolean;
};

type KeywordSearchProgress = {
  checkedCount: number;
  total: number;
  skippedCount: number;
  nextOffset: number | null;
};

type KeywordSuggestionGroup = {
  service?: string;
  triggers: string[];
  keywords: string[];
};

type RegionParentGroup = { parentId: string; childIds: string[] };
const defaultRegionParentGroups: RegionParentGroup[] = [
  { parentId: "all-london", childIds: ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"] },
];
let regionParentGroupsCache: RegionParentGroup[] = defaultRegionParentGroups;
const regionParentGroupsListeners = new Set<(groups: RegionParentGroup[]) => void>();

function setRegionParentGroupsCache(groups: RegionParentGroup[]) {
  regionParentGroupsCache = groups;
  regionParentGroupsListeners.forEach((listener) => listener(groups));
}

function useRegionParentGroups(): RegionParentGroup[] {
  const [groups, setGroups] = useState<RegionParentGroup[]>(regionParentGroupsCache);
  useEffect(() => {
    regionParentGroupsListeners.add(setGroups);
    return () => {
      regionParentGroupsListeners.delete(setGroups);
    };
  }, []);
  return groups;
}

function findParentGroupForId(id: string): RegionParentGroup | undefined {
  return regionParentGroupsCache.find((group) => group.parentId === id || group.childIds.includes(id));
}

const defaultPriceBandTiers: PriceBandTier[] = [
  { symbol: "£", label: "under £100", maxAmount: 100 },
  { symbol: "££", label: "£100-£200", maxAmount: 200 },
  { symbol: "£££", label: "£200-£300", maxAmount: 300 },
  { symbol: "££££", label: "over £300", maxAmount: null },
];
let priceBandTiersCache: PriceBandTier[] | null = null;
let priceBandTiersPromise: Promise<PriceBandTier[]> | null = null;
const priceBandTiersListeners = new Set<(tiers: PriceBandTier[]) => void>();

function setPriceBandTiersCache(tiers: PriceBandTier[]) {
  priceBandTiersCache = tiers;
  priceBandTiersListeners.forEach((listener) => listener(tiers));
}

function fetchPriceBandTiers(): Promise<PriceBandTier[]> {
  if (priceBandTiersCache) return Promise.resolve(priceBandTiersCache);
  if (!priceBandTiersPromise) {
    priceBandTiersPromise = fetch("/api/admin/price-bands", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const bands = Array.isArray(data.bands) && data.bands.length ? data.bands : defaultPriceBandTiers;
        priceBandTiersCache = bands;
        return bands;
      })
      .catch(() => defaultPriceBandTiers);
  }
  return priceBandTiersPromise;
}

function usePriceBandTiers(): PriceBandTier[] {
  const [tiers, setTiers] = useState<PriceBandTier[]>(priceBandTiersCache ?? defaultPriceBandTiers);
  useEffect(() => {
    let cancelled = false;
    fetchPriceBandTiers().then((bands) => {
      if (!cancelled) setTiers(bands);
    });
    priceBandTiersListeners.add(setTiers);
    return () => {
      cancelled = true;
      priceBandTiersListeners.delete(setTiers);
    };
  }, []);
  return tiers;
}

function priceBandOptionsFromTiers(tiers: PriceBandTier[]): { value: "" | PriceBand; label: string }[] {
  return [{ value: "", label: "Not set" }, ...tiers.map((tier) => ({ value: tier.symbol, label: `${tier.symbol} ${tier.label}` }))];
}
const learnedKeywordSuggestionGroups: KeywordSuggestionGroup[] = [
  {
    triggers: ["kid", "kids", "child", "children", "junior", "teen", "teens"],
    keywords: ["kids", "kid", "children", "child", "junior", "under 12", "under 16", "girls", "boys", "teens"],
  },
  {
    triggers: ["bridal", "bride", "wedding"],
    keywords: ["bridal", "bride", "wedding", "bridesmaid", "occasion", "trial"],
  },
  {
    triggers: ["natural", "silk press", "treatment", "healthy hair", "scalp"],
    keywords: ["natural hair", "silk press", "treatment", "healthy hair", "scalp", "trim", "wash", "blowdry"],
  },
  {
    service: "Bouncy blowout / round brush blow dry",
    triggers: ["bouncy", "bouncy blowout", "bouncy blowdry", "bouncy blow dry", "round brush", "round brush blow dry", "round brush blowdry", "roundbrush blow dry", "curly blow dry", "90s blowout", "dominican blowdry", "dominican blow out", "glamorous blow dry", "volumising blow dry"],
    keywords: [
      "bouncy blowout",
      "bouncy blow out",
      "bouncy blowdry",
      "bouncy blow dry",
      "round brush blow dry",
      "round brush blowdry",
      "roundbrush blow dry",
      "roundbrush blowdry",
      "round brush blow dry style",
      "round brush",
      "curly blow dry",
      "curly blowdry",
      "90s blowout",
      "90s blow out",
      "dominican blowdry",
      "dominican blow dry",
      "dominican blowout",
      "dominican blow out",
      "glamorous blow dry",
      "glamorous blowdry",
      "volumising blow dry",
      "volumising blowdry",
    ],
  },
  {
    service: "Sew in / extensions blowdry",
    triggers: ["extensions blowdry", "extensions blow dry", "extensions blowout", "extensions blow out", "extension blowdry", "extension blow dry", "extension blowout", "extension blow out", "weave blowdry", "weave blow dry", "weave blowout", "weave blow out", "sew in blowdry", "sew in blow dry", "sew-in blowdry", "sew-in blow dry", "sewin blowdry", "sewin blow dry", "sew in blowout", "sew in blow out", "k tips blowdry", "k-tips blowdry", "ktips blowdry", "k tips blow dry", "k-tips blow dry", "ktips blow dry", "wash blow dry with extensions", "blow out on sew in weave"],
    keywords: [
      "extensions blowdry",
      "extensions blow dry",
      "extensions blowout",
      "extensions blow out",
      "blowdry with extensions",
      "blow dry with extensions",
      "blowout with extensions",
      "weave blowdry",
      "weave blow dry",
      "weave blowout",
      "weave blow out",
      "sew in blowdry",
      "sew in blow dry",
      "sew-in blowdry",
      "sew-in blow dry",
      "sewin blowdry",
      "sewin blow dry",
      "sew in blowout",
      "sew in blow out",
      "k tips blowdry",
      "k-tips blowdry",
      "ktips blowdry",
      "k tips blow dry",
      "k-tips blow dry",
      "ktips blow dry",
      "blow out on sew in weave",
      "blowout on sew in weave",
      "wash blow dry with extensions",
      "wash and blow dry with extensions",
      "weave wash",
      "shampoo weave",
      "wash weave",
      "wash set blow dry",
      "wash set and blow dry",
      "wash and style",
      "wash blow dry extensions",
      "extension removal shampoo treatment blowdry",
    ],
  },
  {
    service: "Tracks (+ silk press) / partial / invisible sew-in",
    triggers: ["track", "tracks", "per row", "per track", "weave tracks", "sew in tracks", "tracks sewn", "tracks install", "partial sew in", "invisible sew in"],
    keywords: [
      "tracks",
      "track",
      "weave tracks",
      "sew in tracks",
      "sew-in tracks",
      "tracks sewn",
      "sewing tracks",
      "individual sewn on tracks",
      "tracks install",
      "tracks installation",
      "tracks maintenance",
      "track per row",
      "per track",
      "per row",
      "one row",
      "rows of weave",
      "rows of sew in",
      "weave rows",
      "silk press tracks",
      "silk press add on tracks",
      "partial sew in",
      "partial sewin",
      "invisible sew in",
      "invisible weave",
      "invisible weft",
    ],
  },
  {
    service: "Roller set",
    triggers: ["roller set", "roller sets", "rollers", "wet set", "perm rod", "perm rods", "curlformers", "rod set"],
    keywords: [
      "roller set",
      "roller sets",
      "rollers",
      "wet set",
      "wet roller set",
      "perm rods",
      "perm rod set",
      "curlformers",
      "rod set",
      "flexi rods on wet hair",
    ],
  },
  {
    triggers: ["loc", "locs", "starter", "retwist", "sisterloc"],
    keywords: ["locs", "loc", "retwist", "starter locs", "microlocs", "sisterlocs", "interlock"],
  },
  {
    triggers: ["braid", "braids", "boho", "knotless", "fulani"],
    keywords: ["braids", "braid", "knotless", "boho", "fulani", "cornrows", "stitch"],
  },
] as const;

type DirectoryCheck = {
  id: string;
  name: string;
  areaId?: string;
  areaIds?: string[];
  areaLabel?: string;
  locationReviewIgnored?: boolean;
  bookingUrl?: string;
  instagramUrl?: string;
  hijabiFriendly?: boolean;
  wheelchairAccessible?: boolean;
  senFriendly?: boolean;
  lgbtqFriendly?: boolean;
  parkingAvailable?: boolean;
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: PriceComparisonMode | "";
  priceSource?: "auto" | "manual" | "";
  priceConfidence?: "high" | "medium" | "low" | "manual" | "";
  issues: string[];
  linkChecks: {
    type: string;
    url: string;
    finalUrl: string;
    status: string;
    httpStatus: number | null;
    issues: string[];
  }[];
  serviceCheck: {
    confidence: string;
    rawServices: string[];
    matchedServices: string[];
    areaId?: string;
    areaLabel?: string;
  };
  priceCheck?: {
    source: string;
    confidence: "high" | "medium" | "low" | "manual" | "unknown";
    priceBand: PriceBand | "";
    medianPrice: number | null;
    prices?: number[];
    priceCount: number;
    evidence: string[];
    servicePriceBand?: PriceBand | "";
    serviceMedianPrice?: number | null;
    servicePrices?: number[];
    servicePriceCount?: number;
    packagePriceBand?: PriceBand | "";
    packageMedianPrice?: number | null;
    packagePrices?: number[];
    packagePriceCount?: number;
    priceIncludesHair?: boolean;
    priceComparisonMode?: PriceComparisonMode | "";
  };
  currentServices: string[];
  detectedServices: string[];
  addedServices: string[];
  removedServices: string[];
  attributeSuggestions?: AttributeSuggestion[];
  backfillStatus?: "auto-applied" | "needs-review" | "no-price" | "skipped-social";
  backfillReason?: string;
  checkedAt: string;
};

type AdminPriceCheck = NonNullable<DirectoryCheck["priceCheck"]> & {
  ignoredPrices?: { price: number; line: string; reason: string }[];
};

type BookingPreview = {
  serviceCheck?: DirectoryCheck["serviceCheck"];
  priceCheck?: AdminPriceCheck;
};

type AttributeSuggestion = {
  field: "hijabiFriendly" | "wheelchairAccessible" | "senFriendly" | "lgbtqFriendly" | "parkingAvailable";
  value: true;
  label: string;
  evidence: {
    source: string;
    text: string;
  }[];
};

type FreshnessUpdate = {
  addServices?: string[];
  removeServices?: string[];
  bookingUrl?: string;
  bookingPlatform?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  hijabiFriendly?: boolean;
  wheelchairAccessible?: boolean;
  senFriendly?: boolean;
  lgbtqFriendly?: boolean;
  parkingAvailable?: boolean;
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: PriceComparisonMode | "";
  priceSource?: "auto" | "manual";
  priceEvidence?: string[];
  priceCheckedAt?: string;
  priceConfidence?: "high" | "medium" | "low" | "manual";
  rejectAddedServices?: string[];
  rejectRemovedServices?: string[];
  rejectHijabiFriendly?: boolean;
  rejectWheelchairAccessible?: boolean;
  rejectSenFriendly?: boolean;
  rejectLgbtqFriendly?: boolean;
  rejectParkingAvailable?: boolean;
  rejectPriceBand?: boolean;
  rejectLocation?: boolean;
  areaId?: string;
  areaIds?: string[];
  areaLabel?: string;
  // Free-text explanation captured when ignoring suggestions, so patterns in
  // *why* admins reject things can inform future matcher/heuristic fixes.
  feedbackReason?: string;
  feedbackContext?: string[];
  // The exact evidence phrase(s) behind a rejected attribute or add-service
  // suggestion — the server suppresses this same phrasing on every future
  // check, for any salon, not just this one.
  feedbackRejectedEvidence?: { kind: "attribute" | "add"; field: string; evidenceText: string }[];
};

type ManualPriceParseResult = {
  priceBand: PriceBand | "";
  medianPrice: number | null;
  prices: number[];
  priceCount: number;
  evidence: string[];
  servicePriceBand: PriceBand | "";
  serviceMedianPrice: number | null;
  servicePrices: number[];
  servicePriceCount: number;
  packagePriceBand: PriceBand | "";
  packageMedianPrice: number | null;
  packagePrices: number[];
  packagePriceCount: number;
  priceIncludesHair: boolean;
  priceComparisonMode: PriceComparisonMode | "";
  ignoredPrices: string[];
};

type FreshnessUndoState = {
  check: DirectoryCheck;
  previousServices: string[];
  previousHijabiFriendly?: boolean;
  previousWheelchairAccessible?: boolean;
  previousSenFriendly?: boolean;
  previousLgbtqFriendly?: boolean;
  previousParkingAvailable?: boolean;
  update: FreshnessUpdate;
  label: string;
};

type AdminToast = {
  id: number;
  message: string;
  tone: "success" | "error";
};

type DuplicateMatch = {
  id: string;
  name: string;
  source: "draft" | "published";
  reasons: string[];
};

type DuplicateResult = {
  candidate?: StylistDraft;
  duplicates: DuplicateMatch[];
};

type DiscoverySuggestion = {
  id: string;
  name: string;
  status: string;
  confidence: string;
  sourceUrl: string;
  areaLabel?: string;
  services: string[];
  reason: string;
};

type DashboardMetrics = {
  drafts: {
    total: number;
    needsReview: number;
    readyToApprove: number;
    missingLocation: number;
    missingServices: number;
  };
  freshness: {
    totalIssues: number;
    checkedCount: number;
    total: number;
    brokenLinks: number;
    manualLinks?: number;
    serviceChanges: number;
    updatedAt: string | null;
  };
  discovery: {
    total: number;
    highConfidence: number;
    needsReview: number;
  };
  analytics?: AnalyticsSummary;
  allTime?: { visitors: number; bookingClicks: number; instagramClicks: number };
};

type AnalyticsSummary = {
  granularity?: "hour" | "day";
  visitorsByDay: { date: string; count: number }[];
  bookingClicks: number;
  instagramClicks: number;
  reviewsClicks: number;
  reviewsClicksByPlatform: { platform: string; clicks: number }[];
  filterUsage: { label: string; rows: { label: string; count: number }[] }[];
  zeroResultSearches: { filters: string[]; count: number; lastSeenAt: string }[];
  topStylists: { name: string; areaLabel: string; clicks: number }[];
  deviceBreakdown: { deviceType: string; visitors: number }[];
  countryBreakdown: { country: string; visitors: number }[];
  cityBreakdown: { city: string; visitors: number }[];
};

type ActivityEvent = {
  timestamp: string;
  event: string;
  url: string | null;
  deviceType: string | null;
  ip: string | null;
  isInternal: boolean;
};

const ANALYTICS_RANGES = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
] as const;

type AnalyticsRangeKey = (typeof ANALYTICS_RANGES)[number]["key"];

const emptyForm: DraftForm = {
  links: "",
  name: "",
  areaId: "",
  rawServices: "",
  services: [],
  hijabiFriendly: false,
  canBraidWithoutGel: false,
  wheelchairAccessible: false,
  priceBand: "",
  servicePriceBand: "",
  packagePriceBand: "",
  priceIncludesHair: false,
  priceComparisonMode: "",
  priceEvidence: [],
  priceCheckedAt: "",
  priceUpdatedAt: "",
  priceConfidence: "",
  priceSource: "",
};

const serviceGroups = [
  { label: "Braids", services: ["Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob"] },
  { label: "Colour", services: ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"] },
  { label: "Bridal", services: ["Bridal"] },
  { label: "Editorial / Session styling", services: ["Editorial / Session styling"] },
  { label: "Kids & teens styles", services: ["Kids & teens styles"] },
  { label: "Extensions", services: ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"] },
  { label: "Locs", services: ["Butterfly locs","Faux locs","Microlocs / sisterlocs","Retwist","Starter locs"] },
  { label: "Sew in / weave", services: ["Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"] },
  { label: "Styling (sew in / frontal / relaxer)", services: ["Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie cut / finger waves","Sleek ponytail / bun","Updo"] },
  { label: "Treatments", services: ["Hair botox","Japanese straightening","K-18 treatment","Keratin treatment","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"] },
  { label: "Natural hair washing & styling", services: ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Bantu knots","Wash & blowdry","Japanese head spa","Scalp detox / treatments"] },
  { label: "Natural hair health & trichology", services: ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"] },
  { label: "Wigs", services: ["Custom wig","Pixie wig / weave install","U-part wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry"] },
];

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
};
type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return confirm;
}

function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(value: boolean) {
    pending?.resolve(value);
    setPending(null);
    setIsConfirming(false);
  }

  async function handleConfirmClick() {
    setIsConfirming(true);
    settle(true);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <ConfirmDialog
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.confirmLabel ?? "Confirm"}
          cancelLabel={pending.cancelLabel ?? "Cancel"}
          tone={pending.tone ?? "neutral"}
          isBusy={isConfirming}
          onConfirm={handleConfirmClick}
          onCancel={() => settle(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  isBusy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "neutral";
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/40 px-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="relative w-full max-w-sm border border-stone-200 bg-white p-6 shadow-xl shadow-stone-950/10">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold tracking-tight text-stone-950">
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-600">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy} className="h-10 rounded-none px-4 text-sm">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={cn(
              "h-10 rounded-none px-4 text-sm",
              tone === "danger" ? "bg-red-600 text-white hover:bg-red-700" : "bg-stone-950 text-white hover:bg-stone-900",
            )}
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminApp() {
  return (
    <ConfirmProvider>
      <AdminAppInner />
    </ConfirmProvider>
  );
}

function AdminAppInner() {
  const confirm = useConfirm();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [drafts, setDrafts] = useState<StylistDraft[]>([]);
  const [publishedStylists, setPublishedStylists] = useState<StylistDraft[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<{ id: string; label: string; subcategories: string[] }[]>(serviceGroups.map((g) => ({ id: g.label, label: g.label, subcategories: g.services })));
  const [serviceKeywordSuggestionGroups, setServiceKeywordSuggestionGroups] = useState<KeywordSuggestionGroup[]>([]);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<AdminToast | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [checks, setChecks] = useState<DirectoryCheck[]>([]);
  const [checksLoadedAt, setChecksLoadedAt] = useState("");
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ checkedCount: 0, total: 0, nextOffset: null as number | null });
  const [activeCheckBatch, setActiveCheckBatch] = useState({ from: 0, to: 50 });
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [keywordTerms, setKeywordTerms] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([]);
  const [keywordProgress, setKeywordProgress] = useState<KeywordSearchProgress>({ checkedCount: 0, total: 0, skippedCount: 0, nextOffset: null });
  const [isRunningKeywordSearch, setIsRunningKeywordSearch] = useState(false);
  const [assigningKeywordServiceIds, setAssigningKeywordServiceIds] = useState<string[]>([]);
  const [stylistStatusFilter, setStylistStatusFilter] = useState("all");
  const [stylistSearchTerm, setStylistSearchTerm] = useState("");
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);
  const [freshnessUndoStack, setFreshnessUndoStack] = useState<FreshnessUndoState[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const lastBookingPreviewKeyRef = useRef("");

	  function updateDraftLocations(draft: StylistDraft, nextAreaIds: string[]) {
	    const normalizedAreaIds = normalizeAreaIds(nextAreaIds);
	    const primaryAreaId = normalizedAreaIds[0] || "";
	    const labels = getAreaIdsForLabels(normalizedAreaIds).map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId)).filter(Boolean);
	    updateStylist(draft.id, {
	      areaId: primaryAreaId,
	      areaIds: normalizedAreaIds,
	      areaLabel: labels.join(" / "),
	      neighbourhood: labels.length > 1 ? `${labels.join(" and ")} London` : labels[0] ? `${labels[0]} London` : "",
	    });
	  }

  const allStylists = useMemo(() => [...drafts, ...publishedStylists], [drafts, publishedStylists]);
  const stylistStats = useMemo(() => {
    const stats = { total: allStylists.length, draft: 0, readyToPublish: 0, published: 0 };
    for (const stylist of allStylists) {
      const status = getDraftDisplayStatus(stylist);
      if (status === "ready_to_publish") stats.readyToPublish += 1;
      else if (status === "published") stats.published += 1;
      else stats.draft += 1;
    }
    return stats;
  }, [allStylists]);
  const keywordSuggestionGroups = useMemo(
    () => [...learnedKeywordSuggestionGroups, ...serviceKeywordSuggestionGroups],
    [serviceKeywordSuggestionGroups],
  );

	  const selectedDraft = useMemo(
	    () => (selectedDraftId ? allStylists.find((draft) => draft.id === selectedDraftId) ?? null : allStylists[0] ?? null),
	    [allStylists, selectedDraftId],
	  );

  const filteredStylists = useMemo(() => {
    const searchTerm = stylistSearchTerm.trim();
    return allStylists.filter((draft) => {
      const matchesStatus = stylistStatusFilter === "all" || draft.status === stylistStatusFilter || getDraftDisplayStatus(draft) === stylistStatusFilter;
      return matchesStatus && stylistMatchesSearch(draft, searchTerm);
    });
  }, [allStylists, stylistSearchTerm, stylistStatusFilter]);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthed) {
      loadAdminData();
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isAuthed || !form.rawServices.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const matchedServices = await matchRawServices(form.rawServices);
      if (!matchedServices.length) {
        return;
      }

      setForm((current) => ({
        ...current,
        services: mergeServices(current.services, matchedServices),
      }));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [form.rawServices, isAuthed]);

  const selectedDraftRawServices = selectedDraft?.rawServices?.join("\n") ?? "";

  useEffect(() => {
    if (!isAuthed || !selectedDraft || !selectedDraftRawServices.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const [matchedServices, priceCheck] = await Promise.all([
        matchRawServices(selectedDraftRawServices),
        parsePriceListText(selectedDraftRawServices),
      ]);
      const update: Partial<StylistDraft> = {};
      if (matchedServices.length) {
        update.services = mergeServices(selectedDraft.services, matchedServices);
      }

      // Pasting into the drawer is a deliberate admin action, so it should be
      // allowed to overwrite a previously manually-set price band — unlike the
      // silent background booking-URL auto-check below, which must not.
      const pricingUpdate = buildDraftPricingUpdate(priceCheck, selectedDraft, "auto", { allowOverwriteManual: true });
      Object.assign(update, pricingUpdate);

      if (Object.keys(update).length) {
        updateStylist(selectedDraft.id, update);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraftRawServices, isAuthed]);

  const selectedDraftPriceEvidence = selectedDraft?.priceEvidence?.join("\n") ?? "";

  useEffect(() => {
    if (!isAuthed || !selectedDraft || !selectedDraftPriceEvidence.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const priceCheck = await parsePriceListText(selectedDraftPriceEvidence);
      const pricingUpdate = buildDraftPricingUpdate(priceCheck, selectedDraft, "auto", { allowOverwriteManual: true });

      if (Object.keys(pricingUpdate).length) {
        updateStylist(selectedDraft.id, pricingUpdate);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraftPriceEvidence, isAuthed]);

  useEffect(() => {
    if (!isAuthed || !selectedDraft) {
      return;
    }

    const bookingUrl = selectedDraft.bookingUrl?.trim() || "";
    const previewUrl = bookingUrl;
    if (!looksLikeHttpUrl(previewUrl) || isLikelySocialUrl(previewUrl)) {
      return;
    }

    const previewKey = `${selectedDraft.id}|${bookingUrl}`;
    if (lastBookingPreviewKeyRef.current === previewKey) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      lastBookingPreviewKeyRef.current = previewKey;
      const preview = await fetchBookingPreview(bookingUrl);
      if (!preview) {
        return;
      }

      const update: Partial<StylistDraft> = {};
      const rawServices = preview.serviceCheck?.rawServices || [];
      const matchedServices = preview.serviceCheck?.matchedServices || [];
      if (rawServices.length) {
        update.rawServices = mergeLines(selectedDraft.rawServices || [], rawServices);
      }
      if (matchedServices.length) {
        update.services = mergeServices(selectedDraft.services, matchedServices);
      }

      const pricingUpdate = buildDraftPricingUpdate(preview.priceCheck, selectedDraft, "auto", { allowOverwriteManual: false });
      Object.assign(update, pricingUpdate);

      if (Object.keys(update).length) {
        updateStylist(selectedDraft.id, update);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraft?.bookingUrl, isAuthed]);

  async function checkSession() {
    setIsCheckingSession(true);
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
      const authed = response.ok && payload?.ok === true;
      setIsAuthed(authed);
      if (authed) markAsInternalVisitor();
    } catch {
      setIsAuthed(false);
    } finally {
      setIsCheckingSession(false);
    }
  }

  async function loadAdminData() {
    setIsBusy(true);
    try {
      const [draftResponse, publishedResponse, optionResponse, dashboardResponse, discoveryResponse, savedChecksResponse, filtersResponse] = await Promise.all([
        fetch("/api/admin/stylists/drafts", { credentials: "include" }),
        fetch("/api/admin/stylists/published", { credentials: "include" }),
        fetch("/api/admin/stylists/options", { credentials: "include" }),
        fetch("/api/admin/dashboard", { credentials: "include" }),
        fetch("/api/admin/discovery", { credentials: "include" }),
        fetch("/api/admin/stylists/checks/saved", { credentials: "include" }),
        fetch("/api/admin/filters", { credentials: "include" }),
      ]);
      if (!draftResponse.ok || !optionResponse.ok) {
        setIsAuthed(false);
        return;
      }
      const draftPayload = await draftResponse.json();
      const publishedPayload = publishedResponse.ok ? await publishedResponse.json() : null;
      const optionPayload = await optionResponse.json();
      const dashboardPayload = dashboardResponse.ok ? await dashboardResponse.json() : null;
      const discoveryPayload = discoveryResponse.ok ? await discoveryResponse.json() : null;
      const savedChecksPayload = savedChecksResponse.ok ? await savedChecksResponse.json() : null;
      const filtersPayload = filtersResponse.ok ? await filtersResponse.json() : null;
      setDrafts(draftPayload.drafts ?? []);
      setPublishedStylists(publishedPayload?.stylists ?? []);
      setRegions(optionPayload.regions ?? []);
      if (Array.isArray(optionPayload.regionParentGroups)) {
        setRegionParentGroupsCache(optionPayload.regionParentGroups);
      }
      setServices(optionPayload.services ?? []);
      if (filtersPayload?.ok && Array.isArray(filtersPayload.categories)) {
        setFilterCategories(filtersPayload.categories);
      }
      setServiceKeywordSuggestionGroups(optionPayload.keywordSuggestionGroups ?? []);
      setDashboard(dashboardPayload ?? null);
      setSuggestions(discoveryPayload?.suggestions ?? []);
      setChecks(savedChecksPayload?.checks ?? []);
      setChecksLoadedAt(savedChecksPayload?.checkedAt ?? "");
      if (savedChecksPayload) {
        setCheckProgress({
          checkedCount: savedChecksPayload.checkedCount ?? 0,
          total: savedChecksPayload.total ?? 0,
          nextOffset: savedChecksPayload.nextOffset ?? null,
        });
      }
      setSelectedDraftId((current) => current ?? draftPayload.drafts?.[0]?.id ?? null);
    } finally {
      setIsBusy(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        setLoginError(payload.message || "Login failed.");
        return;
      }
      setPassword("");
      setIsAuthed(true);
      markAsInternalVisitor();
    } finally {
      setIsBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setIsAuthed(false);
    setDrafts([]);
  }

  function notify(messageText: string, tone: AdminToast["tone"] = "success") {
    setMessage(messageText);
    setToast({ id: Date.now(), message: messageText, tone });
  }

  async function createDraft() {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/stylists/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(emptyForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(formatDuplicateResponse(payload) || payload.message || "Could not create draft.", "error");
        return;
      }
      setForm(emptyForm);
      setDrafts((current) => [payload.draft, ...current]);
      setSelectedDraftId(payload.draft.id);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      notify("Draft created.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveDraft(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const isPublished = getDraftDisplayStatus(draft) === "published";
      const response = await fetch(isPublished ? `/api/admin/stylists/published/${draft.id}` : `/api/admin/stylists/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || `Could not save ${isPublished ? "published stylist" : "draft"}.`, "error");
        return;
      }
      if (isPublished) {
        setPublishedStylists((current) => current.map((item) => (item.id === draft.id ? payload.stylist : item)));
        notify("Published stylist saved.");
      } else {
        setDrafts((current) => current.map((item) => (item.id === draft.id ? payload.draft : item)));
        notify("Draft saved.");
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function approveDraft(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.message || "Could not approve draft.", "error");
        return;
      }
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      if (payload.salon) {
        const publishedStylist = publishedSalonToDraft(payload.salon);
        setPublishedStylists((current) => [publishedStylist, ...current.filter((item) => item.id !== publishedStylist.id)]);
      }
      setSelectedDraftId(null);
      setIsDraftEditorOpen(false);
      notify(`${payload.salon.name} was added to the directory.${describeGoogleMatch(payload.googleMatch)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteStylist(draft: StylistDraft) {
    const isPublished = getDraftDisplayStatus(draft) === "published";
    const confirmed = await confirm(
      isPublished
        ? {
            title: "Delete this stylist from the directory?",
            description: "They'll be permanently removed from the live site immediately. This can't be undone.",
            confirmLabel: "Delete",
            tone: "danger",
          }
        : {
            title: "Delete this draft?",
            description: "This permanently removes it. This can't be undone.",
            confirmLabel: "Delete",
            tone: "danger",
          },
    );
    if (!confirmed) return;

    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(isPublished ? `/api/admin/stylists/published/${draft.id}` : `/api/admin/stylists/drafts/${draft.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload.message || `Could not delete ${isPublished ? "published stylist" : "draft"}.`, "error");
        return;
      }
      if (isPublished) {
        setPublishedStylists((current) => current.filter((item) => item.id !== draft.id));
      } else {
        setDrafts((current) => current.filter((item) => item.id !== draft.id));
      }
      setSelectedDraftId(null);
      setIsDraftEditorOpen(false);
      notify(isPublished ? "Published stylist deleted." : "Draft deleted.");
    } finally {
      setIsBusy(false);
    }
  }

  async function unpublishStylist(draft: StylistDraft) {
    if (getDraftDisplayStatus(draft) !== "published") {
      return;
    }

    const confirmed = await confirm({
      title: "Unpublish this stylist?",
      description: "They'll be removed from the live site immediately. You can re-publish anytime from Drafts.",
      confirmLabel: "Unpublish",
      tone: "neutral",
    });
    if (!confirmed) return;

    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/published/${draft.id}/unpublish`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.message || "Could not unpublish stylist.", "error");
        return;
      }

      if (payload.draft) {
        setDrafts((current) => [payload.draft, ...current.filter((item) => item.id !== payload.draft.id)]);
      }
      setPublishedStylists((current) => current.filter((item) => item.id !== draft.id));
      setSelectedDraftId(payload.draft?.id ?? draft.id);
      setIsDraftEditorOpen(true);
      notify("Stylist moved back to complete.");
    } finally {
      setIsBusy(false);
    }
  }

  async function promoteSalon(salonId: string) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/published/${salonId}/promote`, { method: "POST", credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.message || "Could not set up branches.", "error");
        return;
      }
      setPublishedStylists((current) => current.map((item) => (item.id === payload.salon.id ? payload.salon : item)));
      notify("This salon can now have branches.");
    } finally {
      setIsBusy(false);
    }
  }

  async function addBranchToSalon(salonId: string, fields: Partial<BranchDraft>) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/published/${salonId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.message || "Could not add branch.", "error");
        return;
      }
      setPublishedStylists((current) => current.map((item) => (item.id === payload.salon.id ? payload.salon : item)));
      notify("Branch added.");
    } finally {
      setIsBusy(false);
    }
  }

  async function updateBranch(salonId: string, branchId: string, fields: Partial<BranchDraft>) {
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/published/${salonId}/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.message || "Could not update branch.", "error");
        return;
      }
      setPublishedStylists((current) => current.map((item) => (item.id === payload.salon.id ? payload.salon : item)));
      notify("Branch updated.");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteBranch(salonId: string, branchId: string) {
    const confirmed = await confirm({
      title: "Remove this branch?",
      description: "It'll disappear from the live site immediately.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!confirmed) return;

    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/stylists/published/${salonId}/branches/${branchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.message || "Could not remove branch.", "error");
        return;
      }
      setPublishedStylists((current) => current.map((item) => (item.id === payload.salon.id ? payload.salon : item)));
      notify("Branch removed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runChecks(offset = 0, mode: "freshness" | "pricing" = "freshness") {
    setMessage("");
    const isFullRun = offset === 0;
    if (isFullRun) {
      setCheckProgress({
        checkedCount: 0,
        total: dashboard?.freshness.total || checkProgress.total || 0,
        nextOffset: null,
      });
    }
    setIsRunningChecks(true);
    try {
      let nextOffset: number | null = offset;
      let totalUpdates = 0;
      let lastCheckedAt = "";
      let completedChecks: DirectoryCheck[] = [];
      let completedCount = 0;
      let totalCount = 0;

      while (nextOffset !== null) {
        const batchOffset = nextOffset;
        setActiveCheckBatch({ from: batchOffset + 1, to: batchOffset + 50 });
        const params = new URLSearchParams({ offset: String(batchOffset), limit: "50" });
        if (mode === "pricing") {
          params.set("mode", "pricing");
        }
        const response = await fetch(`/api/admin/stylists/checks?${params.toString()}`, { credentials: "include" });
        const payload = await response.json().catch(() => ({ message: "Could not run checks." }));
        if (!response.ok) {
          setMessage(payload.message || "Could not run checks.");
          return;
        }

        const batchChecks = payload.checks ?? [];
        totalUpdates += batchChecks.length;
        lastCheckedAt = payload.checkedAt || lastCheckedAt || new Date().toISOString();
        completedChecks = batchOffset === 0 ? batchChecks : [...completedChecks, ...batchChecks];
        setChecks(completedChecks);
        setChecksLoadedAt(lastCheckedAt);
        setCheckProgress({
          checkedCount: payload.checkedCount ?? 0,
          total: payload.total ?? 0,
          nextOffset: payload.nextOffset ?? null,
        });
        completedCount = payload.checkedCount ?? completedCount;
        totalCount = payload.total ?? totalCount;
        if (mode === "pricing") {
          const summary = summarizeBackfillChecks(completedChecks);
          setMessage(`Checked ${payload.checkedCount ?? 0} of ${payload.total ?? 0} stylists for pricing. Auto-applied ${summary.autoApplied}, review ${summary.needsReview}, none found ${summary.noPrice}, Instagram only ${summary.skippedSocial}.`);
        } else {
          setMessage(`Checked ${payload.checkedCount ?? 0} of ${payload.total ?? 0}. Found ${totalUpdates} update${totalUpdates === 1 ? "" : "s"} so far.`);
        }
        nextOffset = payload.nextOffset ?? null;
      }

      if (mode === "freshness") {
        const saveResponse = await fetch("/api/admin/stylists/checks/saved", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checks: completedChecks,
            checkedAt: lastCheckedAt || new Date().toISOString(),
            checkedCount: completedCount,
            total: totalCount,
          }),
        });
        const savedPayload = await saveResponse.json().catch(() => null);
        if (saveResponse.ok && savedPayload?.checkedAt) {
          lastCheckedAt = savedPayload.checkedAt;
          setChecksLoadedAt(lastCheckedAt);
        }
      }

      if (mode === "pricing") {
        const summary = summarizeBackfillChecks(completedChecks);
        setMessage(`Pricing check complete. Auto-applied ${summary.autoApplied}, review ${summary.needsReview}, none found ${summary.noPrice}, Instagram only ${summary.skippedSocial}.`);
      } else {
        setMessage(`Health check complete. Found ${totalUpdates} update${totalUpdates === 1 ? "" : "s"}.`);
      }
      if (mode === "freshness") {
        setDashboard((current) =>
          current
            ? {
                ...current,
                freshness: {
                  ...current.freshness,
                  totalIssues: completedChecks.length,
                  checkedCount: completedCount || current.freshness.checkedCount,
                  total: totalCount || current.freshness.total,
                  updatedAt: lastCheckedAt || current.freshness.updatedAt,
                  brokenLinks: completedChecks.filter((check) => check.linkChecks?.some(isActionableBrokenLink)).length,
                  manualLinks: completedChecks.filter((check) => check.linkChecks?.some(isManualCheckLink)).length,
                  serviceChanges: completedChecks.filter((check) => check.addedServices?.length || check.removedServices?.length).length,
                },
              }
            : current,
        );
      }
    } finally {
      setIsRunningChecks(false);
    }
  }

  async function generateDiscoverySuggestions() {
    setIsGeneratingSuggestions(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/discovery/generate", { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not generate suggestions.");
        return;
      }
      setSuggestions(payload.suggestions ?? []);
      setMessage(`Generated ${(payload.suggestions ?? []).length} discovery leads.`);
      await loadAdminData();
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }

  async function runKeywordSearch(offset = 0) {
    const typedSuggestions = suggestKeywordSearchTerms(keywordInput, keywordSuggestionGroups);
    const keywords = [...new Set([...keywordTerms, ...typedSuggestions])].map((term) => term.trim()).filter(Boolean);
    setMessage("");
    if (!keywords.length) {
      setMessage("Add at least one keyword.");
      return;
    }
    setKeywordTerms(keywords);
    setKeywordInput("");

    const isFullRun = offset === 0;
    if (isFullRun) {
      setKeywordResults([]);
      setKeywordProgress({ checkedCount: 0, total: publishedStylists.length, skippedCount: 0, nextOffset: null });
    }
    setIsRunningKeywordSearch(true);
    try {
      let nextOffset: number | null = offset;
      let completedResults: KeywordSearchResult[] = isFullRun ? [] : keywordResults;
      let skippedCount = isFullRun ? 0 : keywordProgress.skippedCount;
      let totalCount = keywordProgress.total || publishedStylists.length;

      while (nextOffset !== null) {
        const response = await fetch("/api/admin/stylists/keyword-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ keywords, offset: nextOffset, limit: 50 }),
        });
        const payload = await response.json().catch(() => ({ message: "Could not run keyword search." }));
        if (!response.ok) {
          setMessage(payload.message || "Could not run keyword search.");
          return;
        }

        const batchResults = payload.results ?? [];
        completedResults = nextOffset === 0 ? batchResults : [...completedResults, ...batchResults];
        skippedCount += payload.skippedCount ?? 0;
        totalCount = payload.total ?? totalCount;
        setKeywordResults(completedResults);
        setKeywordProgress({
          checkedCount: payload.checkedCount ?? 0,
          total: totalCount,
          skippedCount,
          nextOffset: payload.nextOffset ?? null,
        });
        setMessage(`Searched ${payload.checkedCount ?? 0} of ${totalCount}. Found ${completedResults.length} matching stylist${completedResults.length === 1 ? "" : "s"}.`);
        nextOffset = payload.nextOffset ?? null;
      }

      setMessage(`Keyword search complete. Found ${completedResults.length} matching stylist${completedResults.length === 1 ? "" : "s"}.`);
    } finally {
      setIsRunningKeywordSearch(false);
    }
  }

  async function assignKeywordService(result: KeywordSearchResult) {
    if (!result.id || !result.selectedService || result.selectedServiceAssigned) {
      return;
    }
    setAssigningKeywordServiceIds((current) => [...new Set([...current, result.id])]);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stylists/${result.id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ service: result.selectedService }),
      });
      const payload = await response.json().catch(() => ({ message: "Could not assign service." }));
      if (!response.ok || payload?.ok !== true) {
        setMessage(payload.message || "Could not assign service.");
        return;
      }
      if (payload.salon) {
        updateStylist(result.id, payload.salon);
      }
      setKeywordResults((current) =>
        current.map((item) =>
          item.id === result.id
            ? {
                ...item,
                selectedServiceAssigned: true,
              }
            : item,
        ),
      );
      setMessage(`Assigned ${payload.service || result.selectedService} to ${result.name}.`);
    } finally {
      setAssigningKeywordServiceIds((current) => current.filter((id) => id !== result.id));
    }
  }

  async function createDraftFromSuggestion(suggestionId: string) {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/discovery/${suggestionId}/create-draft`, { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        notify(formatDuplicateResponse(payload) || payload.message || "Could not create draft from suggestion.", "error");
        return;
      }
      setDrafts((current) => [payload.draft, ...current]);
      setSelectedDraftId(payload.draft.id);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      setMessage("Draft created from suggestion.");
    } finally {
      setIsBusy(false);
    }
  }

  async function applyFreshnessUpdate(check: DirectoryCheck, update: FreshnessUpdate) {
    const undoState: FreshnessUndoState = {
      check: cloneDirectoryCheck(check),
      previousServices: [...check.currentServices],
      previousHijabiFriendly: check.hijabiFriendly === true,
      previousWheelchairAccessible: check.wheelchairAccessible === true,
      previousSenFriendly: check.senFriendly === true,
      previousLgbtqFriendly: check.lgbtqFriendly === true,
      previousParkingAvailable: check.parkingAvailable === true,
      update,
      label: getFreshnessUndoLabel(update),
    };
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stylists/${check.id}/freshness`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...update, check: cloneDirectoryCheck(check) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not update listing.");
        return;
      }
      setChecks((current) =>
        updateChecksAfterFreshnessAction(current, check, update, payload.check, payload.salon),
      );
      if (update.hijabiFriendly === true) {
        setPublishedStylists((current) => current.map((item) => (item.id === check.id ? { ...item, hijabiFriendly: true } : item)));
      }
      if (update.wheelchairAccessible === true) {
        setPublishedStylists((current) => current.map((item) => (item.id === check.id ? { ...item, wheelchairAccessible: true } : item)));
      }
      if (update.senFriendly === true) {
        setPublishedStylists((current) => current.map((item) => (item.id === check.id ? { ...item, senFriendly: true } : item)));
      }
      if (update.lgbtqFriendly === true) {
        setPublishedStylists((current) => current.map((item) => (item.id === check.id ? { ...item, lgbtqFriendly: true } : item)));
      }
      if (update.parkingAvailable === true) {
        setPublishedStylists((current) => current.map((item) => (item.id === check.id ? { ...item, parkingAvailable: true } : item)));
      }
      if (update.priceBand) {
        setPublishedStylists((current) =>
          current.map((item) =>
            item.id === check.id
              ? {
                  ...item,
                  priceBand: update.priceBand,
                  priceSource: update.priceSource || "auto",
                  priceEvidence: update.priceEvidence || [],
                  priceCheckedAt: update.priceCheckedAt || new Date().toISOString(),
                  priceUpdatedAt: new Date().toISOString(),
                  priceConfidence: update.priceConfidence || "medium",
                }
              : item,
          ),
        );
      }
      setFreshnessUndoStack((current) => [...current, undoState]);
      setMessage("Directory listing updated.");
    } finally {
      setIsBusy(false);
    }
  }

  async function undoFreshnessUpdate() {
    const lastFreshnessUndo = freshnessUndoStack[freshnessUndoStack.length - 1];
    if (!lastFreshnessUndo) return;
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stylists/${lastFreshnessUndo.check.id}/freshness/undo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          check: lastFreshnessUndo.check,
          update: lastFreshnessUndo.update,
          previousServices: lastFreshnessUndo.previousServices,
          previousHijabiFriendly: lastFreshnessUndo.previousHijabiFriendly,
          previousWheelchairAccessible: lastFreshnessUndo.previousWheelchairAccessible,
          previousSenFriendly: lastFreshnessUndo.previousSenFriendly,
          previousLgbtqFriendly: lastFreshnessUndo.previousLgbtqFriendly,
          previousParkingAvailable: lastFreshnessUndo.previousParkingAvailable,
          rejectAddedServices: lastFreshnessUndo.update.rejectAddedServices,
          rejectRemovedServices: lastFreshnessUndo.update.rejectRemovedServices,
          rejectHijabiFriendly: lastFreshnessUndo.update.rejectHijabiFriendly,
          rejectWheelchairAccessible: lastFreshnessUndo.update.rejectWheelchairAccessible,
          rejectSenFriendly: lastFreshnessUndo.update.rejectSenFriendly,
          rejectLgbtqFriendly: lastFreshnessUndo.update.rejectLgbtqFriendly,
          rejectParkingAvailable: lastFreshnessUndo.update.rejectParkingAvailable,
          rejectPriceBand: lastFreshnessUndo.update.rejectPriceBand,
          rejectLocation: lastFreshnessUndo.update.rejectLocation,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || "Could not undo health check action.");
        return;
      }
      const restoredCheck = payload.check ?? lastFreshnessUndo.check;
      setChecks((current) => [restoredCheck, ...current.filter((item) => item.id !== restoredCheck.id)]);
      setFreshnessUndoStack((current) => current.slice(0, -1));
      setMessage("Health check action undone.");
      await loadAdminData();
    } finally {
      setIsBusy(false);
    }
  }

  async function matchRawServices(rawServices: string) {
    const response = await fetch("/api/admin/stylists/match-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rawServices }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.services) ? payload.services : [];
  }

  async function parsePriceListText(text: string): Promise<AdminPriceCheck | null> {
    if (!/[£]|(?:\bGBP\b)|(?:British pounds?)/i.test(text)) {
      return null;
    }

    const response = await fetch("/api/admin/stylists/parse-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.ok ? payload : null;
  }

  async function fetchBookingPreview(bookingUrl: string): Promise<BookingPreview | null> {
    const response = await fetch("/api/admin/stylists/booking-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bookingUrl }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.ok ? payload : null;
  }

  function updateStylist(draftId: string, update: Partial<StylistDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === draftId ? { ...draft, ...update } : draft)));
    setPublishedStylists((current) => current.map((draft) => (draft.id === draftId ? { ...draft, ...update } : draft)));
  }

  if (isCheckingSession) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-50">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-50">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
          <form onSubmit={login} className="w-full space-y-5">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-400">ROW K</p>
              <h1 className="mt-3 text-3xl font-semibold">Admin portal</h1>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Admin password"
              className="rounded-none border-stone-700 bg-stone-900 text-stone-50 placeholder:text-stone-500"
            />
            {loginError ? <p className="text-sm text-red-300">{loginError}</p> : null}
            <Button type="submit" disabled={isBusy} className="w-full rounded-none">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Unlock admin
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-ui flex min-h-screen bg-[#f8f8f7] text-stone-950 dark:bg-stone-950 dark:text-stone-50">
      <AdminSidebar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          setIsMobileNavOpen(false);
        }}
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onLogout={logout}
      />

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4 dark:border-stone-800 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex size-9 items-center justify-center border border-stone-200 text-stone-600 dark:border-stone-800 dark:text-stone-300"
          >
            <Menu className="size-4" />
          </button>
          <p className="inline-flex rounded-none bg-stone-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white dark:bg-stone-100 dark:text-stone-950">ROW K ADMIN</p>
          <span className="inline-flex items-center gap-2 text-xs text-stone-500">
            <span className="size-2 rounded-none bg-emerald-500" />
          </span>
        </header>

        {activeView === "overview" ? (
          <DashboardOverview
            dashboard={dashboard}
            publishedCount={publishedStylists.length}
            onOpenView={setActiveView}
          />
        ) : null}

        {activeView === "analytics" ? (
          <AnalyticsPage onOpenView={setActiveView} />
        ) : null}

        {activeView === "drafts" ? (
          <StylistsPage
            drafts={filteredStylists}
            stats={stylistStats}
            statusFilter={stylistStatusFilter}
            searchTerm={stylistSearchTerm}
            isBusy={isBusy}
            selectedDraft={isDraftEditorOpen ? selectedDraft : null}
            regions={regions}
            services={services}
            filterCategories={filterCategories}
            onStatusFilterChange={setStylistStatusFilter}
            onSearchTermChange={setStylistSearchTerm}
            onCreateDraft={createDraft}
            onSelectDraft={(draftId) => {
              setSelectedDraftId(draftId);
              setIsDraftEditorOpen(true);
            }}
            onCloseEditor={() => setIsDraftEditorOpen(false)}
            onChangeDraft={(update) => selectedDraft ? updateStylist(selectedDraft.id, update) : undefined}
            onChangeDraftLocations={(areaIds) => selectedDraft ? updateDraftLocations(selectedDraft, areaIds) : undefined}
            onSaveDraft={() => selectedDraft ? saveDraft(selectedDraft) : undefined}
            onApproveDraft={() => selectedDraft ? approveDraft(selectedDraft) : undefined}
            onDeleteDraft={() => selectedDraft ? deleteStylist(selectedDraft) : undefined}
            onUnpublishDraft={() => selectedDraft ? unpublishStylist(selectedDraft) : undefined}
            onPromoteSalon={() => selectedDraft ? promoteSalon(selectedDraft.id) : undefined}
            onAddBranchToSalon={(fields) => selectedDraft ? addBranchToSalon(selectedDraft.id, fields) : undefined}
            onUpdateBranch={(branchId, fields) => selectedDraft ? updateBranch(selectedDraft.id, branchId, fields) : undefined}
            onDeleteBranch={(branchId) => selectedDraft ? deleteBranch(selectedDraft.id, branchId) : undefined}
          />
        ) : null}

        {activeView === "freshness" ? (
          <FreshnessPage
            dashboard={dashboard}
            checks={checks}
            checksLoadedAt={checksLoadedAt}
            checkProgress={checkProgress}
            activeCheckBatch={activeCheckBatch}
            isRunningChecks={isRunningChecks}
            isBusy={isBusy}
            lastUndo={freshnessUndoStack[freshnessUndoStack.length - 1] ?? null}
            onRunChecks={() => runChecks(0)}
            onApply={applyFreshnessUpdate}
            onUndo={undoFreshnessUpdate}
          />
        ) : null}

        {activeView === "pricing" ? (
          <PricingPage
            dashboard={dashboard}
            checks={checks}
            checksLoadedAt={checksLoadedAt}
            checkProgress={checkProgress}
            activeCheckBatch={activeCheckBatch}
            isRunningChecks={isRunningChecks}
            isBusy={isBusy}
            onRunMissingPrices={() => runChecks(0, "pricing")}
            onApply={applyFreshnessUpdate}
          />
        ) : null}

        {activeView === "keyword" ? (
          <KeywordSearchPage
            keywords={keywordTerms}
            keywordInput={keywordInput}
            suggestionGroups={keywordSuggestionGroups}
            results={keywordResults}
            progress={keywordProgress}
            isRunning={isRunningKeywordSearch}
            assigningServiceIds={assigningKeywordServiceIds}
            onKeywordInputChange={setKeywordInput}
            onKeywordsChange={setKeywordTerms}
            onRun={() => runKeywordSearch(0)}
            onAssignService={assignKeywordService}
          />
        ) : null}

        {activeView === "discovery" ? (
          <DiscoveryPage
            suggestions={suggestions}
            isGenerating={isGeneratingSuggestions}
            isBusy={isBusy}
            onGenerate={generateDiscoverySuggestions}
            onCreateDraft={createDraftFromSuggestion}
          />
        ) : null}

        {activeView === "filters" ? <FiltersPage onCategoriesChange={setFilterCategories} /> : null}
      </div>

      <AdminToastMessage toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function AdminSidebar({
  activeView,
  onSelectView,
  collapsed,
  onToggleCollapsed,
  isMobileOpen,
  onCloseMobile,
  onLogout,
}: {
  activeView: AdminView;
  onSelectView: (view: AdminView) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const navList = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label ?? `group-${groupIndex}`} className="space-y-1">
          {group.label && !collapsed ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">{group.label}</p>
          ) : null}
          {group.label && collapsed ? <div className="mx-2 mb-2 border-t border-stone-200 dark:border-stone-800" /> : null}
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => onSelectView(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-none border-l-2 px-3 py-2 text-sm transition",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "border-stone-950 bg-stone-950/5 font-medium text-stone-950 dark:border-stone-100 dark:bg-stone-100/10 dark:text-stone-50"
                    : "border-transparent text-stone-500 hover:bg-stone-950/5 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-100/5 dark:hover:text-stone-100",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-stone-200 px-3 py-4 dark:border-stone-800">
      <Button
        type="button"
        variant="ghost"
        onClick={onLogout}
        title={collapsed ? "Log out" : undefined}
        className={cn("h-10 w-full rounded-none text-sm", collapsed ? "px-0" : "justify-start gap-2 px-4")}
      >
        <LogOut className="size-4" />
        {collapsed ? null : "Log out"}
      </Button>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-stone-200 bg-white transition-[width] dark:border-stone-800 dark:bg-stone-950 lg:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className={cn("flex items-center border-b border-stone-200 px-4 py-5 dark:border-stone-800", collapsed ? "justify-center px-0" : "justify-between")}>
          {collapsed ? null : (
            <p className="inline-flex rounded-none bg-stone-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white dark:bg-stone-100 dark:text-stone-950">ROW K</p>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex size-8 shrink-0 items-center justify-center text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        {navList}
        {footer}
      </aside>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={onCloseMobile} className="absolute inset-0 bg-stone-950/40" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-5 dark:border-stone-800">
              <p className="inline-flex rounded-none bg-stone-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white dark:bg-stone-100 dark:text-stone-950">ROW K ADMIN</p>
              <button
                type="button"
                onClick={onCloseMobile}
                className="inline-flex size-8 items-center justify-center text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                <X className="size-4" />
              </button>
            </div>
            {navList}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function AdminToastMessage({ toast, onClose }: { toast: AdminToast | null; onClose: () => void }) {
  if (!toast) {
    return null;
  }

  const isError = toast.tone === "error";

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2.5rem)] max-w-sm" role="status" aria-live="polite">
      <div className={cn("flex items-start gap-3 border bg-white p-4 shadow-lg", isError ? "border-red-200" : "border-stone-200")}>
        <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center", isError ? "text-red-700" : "text-emerald-700")}>
          {isError ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium text-stone-900">{toast.message}</p>
        <button type="button" onClick={onClose} className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 hover:text-stone-950">
          Close
        </button>
      </div>
    </div>
  );
}

function StylistsPage({
  drafts,
  stats,
  statusFilter,
  searchTerm,
  isBusy,
  selectedDraft,
  regions,
  services,
  filterCategories,
  onStatusFilterChange,
  onSearchTermChange,
  onCreateDraft,
  onSelectDraft,
  onCloseEditor,
  onChangeDraft,
  onChangeDraftLocations,
  onSaveDraft,
  onApproveDraft,
  onDeleteDraft,
  onUnpublishDraft,
  onPromoteSalon,
  onAddBranchToSalon,
  onUpdateBranch,
  onDeleteBranch,
}: {
  drafts: StylistDraft[];
  stats: { total: number; draft: number; readyToPublish: number; published: number };
  statusFilter: string;
  searchTerm: string;
  isBusy: boolean;
  selectedDraft: StylistDraft | null;
  regions: RegionOption[];
  services: string[];
  filterCategories: { id: string; label: string; subcategories: string[] }[];
  onStatusFilterChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onCreateDraft: () => void;
  onSelectDraft: (draftId: string) => void;
  onCloseEditor: () => void;
  onChangeDraft: (update: Partial<StylistDraft>) => void;
  onChangeDraftLocations: (areaIds: string[]) => void;
  onSaveDraft: () => void;
  onApproveDraft: () => void;
  onDeleteDraft: () => void;
  onUnpublishDraft: () => void;
  onPromoteSalon: () => void;
  onAddBranchToSalon: (fields: Partial<BranchDraft>) => void;
  onUpdateBranch: (branchId: string, fields: Partial<BranchDraft>) => void;
  onDeleteBranch: (branchId: string) => void;
}) {
  const [stylistSort, setStylistSort] = useState<StylistSort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [needsFilter, setNeedsFilter] = useState<string[]>([]);
  const filteredDrafts = useMemo(
    () =>
      drafts.filter((draft) => {
        const matchesCategory = categoryFilter === "all" || draftMatchesCategory(draft, categoryFilter, filterCategories);
        const matchesLocation = locationFilter === "all" || draftMatchesLocation(draft, locationFilter);
        const matchesPrice = priceFilter === "all" || (draft.priceBand || "not-listed") === priceFilter;
        const matchesNeeds = needsFilter.every((need) => Boolean(draft[need as "hijabiFriendly" | "canBraidWithoutGel" | "wheelchairAccessible" | "senFriendly" | "lgbtqFriendly" | "parkingAvailable"]));
        return matchesCategory && matchesLocation && matchesPrice && matchesNeeds;
      }),
    [drafts, categoryFilter, locationFilter, priceFilter, needsFilter, filterCategories],
  );
  const sortedDrafts = useMemo(() => sortStylistDrafts(filteredDrafts, stylistSort, regions), [filteredDrafts, regions, stylistSort]);
  const pageCount = Math.max(Math.ceil(sortedDrafts.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedDrafts = useMemo(
    () => sortedDrafts.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize),
    [sortedDrafts, currentPage, pageSize],
  );

  function changeStylistSort(key: StylistSortKey) {
    setStylistSort((current) =>
      current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );
  }

  useEffect(() => {
    setPage(1);
  }, [drafts, pageSize, categoryFilter, locationFilter, priceFilter, needsFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-12">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Stylists</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCreateDraft}
              disabled={isBusy}
              className="inline-flex h-10 items-center gap-2 rounded-none bg-stone-950 px-4 text-[13px] font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
            >
              <Plus className="size-4" />
              Create
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
          <StylistStatCell
            label="Draft"
            value={stats.draft}
            active={statusFilter === "draft"}
            onClick={() => onStatusFilterChange(statusFilter === "draft" ? "all" : "draft")}
          />
          <StylistStatCell
            label="Complete"
            value={stats.readyToPublish}
            active={statusFilter === "ready_to_publish"}
            onClick={() => onStatusFilterChange(statusFilter === "ready_to_publish" ? "all" : "ready_to_publish")}
          />
          <StylistStatCell
            label="Published"
            value={stats.published}
            active={statusFilter === "published"}
            onClick={() => onStatusFilterChange(statusFilter === "published" ? "all" : "published")}
          />
          <StylistStatCell label="Total" value={stats.total} active={statusFilter === "all"} onClick={() => onStatusFilterChange("all")} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search name or location"
              aria-label="Search stylist entries"
              className="h-10 rounded-none pl-9 pr-9 text-sm"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchTermChange("")}
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
                aria-label="Clear stylist search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <StylistFilterMenu
            statusValue={statusFilter}
            onStatusChange={onStatusFilterChange}
            categoryValue={categoryFilter}
            onCategoryChange={setCategoryFilter}
            locationValue={locationFilter}
            onLocationChange={setLocationFilter}
            priceValue={priceFilter}
            onPriceChange={setPriceFilter}
            needsValue={needsFilter}
            onNeedsChange={setNeedsFilter}
            filterCategories={filterCategories}
            regions={regions}
          />
        </div>

        <div className="border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] md:min-w-[1120px]">
              <thead className="border-b border-stone-200 bg-stone-100 text-[12px] font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800">
                <tr>
                  <StylistSortHeader label="Stylist" sortKey="name" sort={stylistSort} onSort={changeStylistSort} />
                  <StylistSortHeader label="Status" sortKey="status" sort={stylistSort} onSort={changeStylistSort} />
                  <StylistSortHeader label="Services" sortKey="services" sort={stylistSort} onSort={changeStylistSort} className="hidden md:table-cell" />
                  <StylistSortHeader label="Pricing" sortKey="pricing" sort={stylistSort} onSort={changeStylistSort} className="hidden md:table-cell" />
                  <StylistSortHeader label="Location" sortKey="location" sort={stylistSort} onSort={changeStylistSort} className="hidden md:table-cell" />
                  <StylistSortHeader label="Discovery" sortKey="discoverySource" sort={stylistSort} onSort={changeStylistSort} className="hidden w-32 whitespace-nowrap md:table-cell" />
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Open stylist</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedDrafts.length ? (
                  pagedDrafts.map((draft) => {
                    return <StylistTableRow key={draft.id} draft={draft} regions={regions} onSelectDraft={onSelectDraft} />;
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">
                      <div className="flex flex-col items-center gap-2">
                        <SearchX className="size-6 text-stone-300" />
                        No stylists match those filters.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-stone-200 bg-stone-100 px-4 py-3 dark:border-stone-800">
            <StylistTablePagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              totalCount={sortedDrafts.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </section>

      {selectedDraft ? (
        <DraftEditorDrawer
          draft={selectedDraft}
          regions={regions}
          services={services}
          filterCategories={filterCategories}
          isBusy={isBusy}
          onClose={onCloseEditor}
          onChange={onChangeDraft}
          onChangeLocations={onChangeDraftLocations}
          onSave={onSaveDraft}
          onApprove={onApproveDraft}
          onDelete={onDeleteDraft}
          onUnpublish={onUnpublishDraft}
          onPromoteSalon={onPromoteSalon}
          onAddBranchToSalon={onAddBranchToSalon}
          onUpdateBranch={onUpdateBranch}
          onDeleteBranch={onDeleteBranch}
        />
      ) : null}
    </div>
  );
}

function StylistStatCell({
  label,
  value,
  onClick,
  active = false,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  if (!onClick) {
    return (
      <div className="p-5">
        <p className="text-[13px] text-stone-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("p-5 text-left transition-colors hover:bg-stone-50", active && "bg-stone-100 hover:bg-stone-100")}
    >
      <p className="text-[13px] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
    </button>
  );
}

function sortStylistDrafts(drafts: StylistDraft[], sort: StylistSort, regions: RegionOption[]) {
  if (!sort) {
    return drafts;
  }

  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((left, right) => {
      const comparison = compareStylistSortValue(
        getStylistSortValue(left.draft, sort.key, regions),
        getStylistSortValue(right.draft, sort.key, regions),
      );
      return comparison ? comparison * directionMultiplier : left.index - right.index;
    })
    .map(({ draft }) => draft);
}

const stylistStatusSortRank: Record<string, number> = {
  draft: 1,
  ready_to_publish: 2,
  published: 3,
};

function getStylistSortValue(draft: StylistDraft, key: StylistSortKey, regions: RegionOption[]) {
  switch (key) {
    case "name": {
      const name = draft.name || "Untitled stylist";
      return `${/^\d/.test(name) ? 1 : 0}_${name}`;
    }
    case "status": {
      const status = getDraftDisplayStatus(draft);
      return `${stylistStatusSortRank[status] ?? 9}_${getStylistStatusLabel(status)}`;
    }
    case "services":
      return draft.services.join(", ");
    case "pricing":
      return draft.priceBand || "";
    case "location":
      return getDraftLocationLabel(draft, regions) || "";
    case "discoverySource":
      return draft.discoverySource || "";
  }
}

function compareStylistSortValue(left: string, right: string) {
  if (!left && right) {
    return 1;
  }
  if (left && !right) {
    return -1;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function StylistSortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: StylistSortKey;
  sort: StylistSort;
  onSort: (key: StylistSortKey) => void;
  className?: string;
}) {
  const isActive = sort?.key === sortKey;
  const directionLabel = isActive && sort?.direction === "asc" ? "ascending" : "descending";

  return (
    <th scope="col" aria-sort={isActive ? directionLabel : "none"} className={cn("px-4 py-3", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 whitespace-nowrap transition hover:text-stone-950 dark:hover:text-stone-100"
      >
        {label}
        <span className={cn("inline-flex size-3.5 items-center justify-center", isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-400")}>
          {isActive ? sort?.direction === "desc" ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
        </span>
      </button>
    </th>
  );
}

function StylistTableRow({
  draft,
  regions,
  onSelectDraft,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onSelectDraft: (draftId: string) => void;
}) {
  const visibleServices = draft.services.slice(0, 2);
  const hiddenServiceCount = Math.max(draft.services.length - visibleServices.length, 0);

  return (
    <tr
      tabIndex={0}
      onClick={() => onSelectDraft(draft.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectDraft(draft.id);
        }
      }}
      className="group cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 focus:bg-stone-50 focus:outline-none last:border-b-0 dark:border-stone-900 dark:hover:bg-stone-900"
    >
      <td className="max-w-[12rem] px-4 py-3 sm:max-w-none">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-stone-950 dark:text-stone-50">{draft.name || "Untitled stylist"}</span>
          {draft.branches ? (
            <span className="inline-block shrink-0 rounded-none border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none tracking-[0.06em] text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
              {draft.branches.length} {draft.branches.length === 1 ? "branch" : "branches"}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <DraftTableStatusBadge draft={draft} />
      </td>
      <td className="hidden px-4 py-3 text-stone-700 md:table-cell dark:text-stone-300">
        {visibleServices.length ? (
          <div className="flex max-w-[320px] flex-nowrap gap-1 overflow-hidden">
            {visibleServices.map((service) => (
              <span key={service} className="min-w-0 max-w-[140px] shrink truncate rounded-none border border-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-700 dark:border-stone-700 dark:text-stone-300">
                {service}
              </span>
            ))}
            {hiddenServiceCount ? <span className="shrink-0 rounded-none border border-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-500 dark:border-stone-700">+{hiddenServiceCount}</span> : null}
          </div>
        ) : (
          <span className="text-stone-400">-</span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-stone-700 md:table-cell dark:text-stone-300">{draft.priceBand || "-"}</td>
      <td className="hidden px-4 py-3 text-stone-700 md:table-cell dark:text-stone-300">{getDraftLocationLabel(draft, regions) || "-"}</td>
      <td className="hidden w-32 whitespace-nowrap px-4 py-3 text-stone-500 md:table-cell">{draft.discoverySource || "-"}</td>
      <td className="px-4 py-3">
        <span className="inline-flex size-7 items-center justify-center rounded-none text-stone-400 transition group-hover:text-stone-600 dark:group-hover:text-stone-300">
          <ChevronRight className="size-4" />
        </span>
      </td>
    </tr>
  );
}

const stylistPriceFilterOptions = [
  { id: "£", label: "£: under £100" },
  { id: "££", label: "££: £100-£200" },
  { id: "£££", label: "£££: £200-£300" },
  { id: "££££", label: "££££: over £300" },
  { id: "not-listed", label: "Price not listed" },
];

const stylistNeedsFilterOptions = [
  { id: "parkingAvailable", label: "Parking nearby" },
  { id: "wheelchairAccessible", label: "Wheelchair accessible entrance" },
  { id: "hijabiFriendly", label: "Hijabi-friendly" },
  { id: "canBraidWithoutGel", label: "Can braid without gel" },
  { id: "lgbtqFriendly", label: "LGBTQIA+-friendly" },
  { id: "senFriendly", label: "Sensory-safe / SEN-friendly" },
];

const stylistStatusFilterOptions = [
  { id: "draft", label: "Draft" },
  { id: "ready_to_publish", label: "Complete" },
  { id: "published", label: "Published" },
];

function FilterMenuCollapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={!open} className="overflow-hidden" style={{ height: open ? "auto" : 0 }}>
      <div className={cn(open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-0 opacity-0")}>{children}</div>
    </div>
  );
}

function FilterMenuSection({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={cn("border-b border-stone-100 px-3 dark:border-stone-800", open && "pb-3")}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="group flex min-h-11 w-full items-center justify-between rounded-none bg-transparent py-2 text-left">
        <span className="text-[13px] font-semibold text-stone-900 transition-colors group-hover:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-400">{title}</span>
        <span className="flex items-center gap-2">
          {count > 0 ? (
            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-1.5 text-[11px] font-bold leading-none text-stone-100 dark:bg-stone-100 dark:text-stone-950">
              {count}
            </span>
          ) : null}
          <ChevronDown className={cn("size-4 text-stone-500 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      <FilterMenuCollapsible open={open}>{children}</FilterMenuCollapsible>
    </div>
  );
}

function FilterMenuOptionRow({ label, isSelected, onClick, indent = false }: { label: string; isSelected: boolean; onClick: () => void; indent?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-100 active:bg-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-800",
        indent && "pl-8",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-stone-400 bg-white transition dark:border-stone-600 dark:bg-stone-900",
          isSelected && "border-stone-950 bg-stone-950 dark:border-stone-100 dark:bg-stone-100",
        )}
      >
        {isSelected ? <Check className="size-3.5 text-white dark:text-stone-950" /> : null}
      </span>
      <span className="translate-y-[1.5px] text-[13px] text-stone-800 dark:text-stone-200">{label}</span>
    </button>
  );
}

function StylistFilterMenu({
  statusValue,
  onStatusChange,
  categoryValue,
  onCategoryChange,
  locationValue,
  onLocationChange,
  priceValue,
  onPriceChange,
  needsValue,
  onNeedsChange,
  filterCategories,
  regions,
}: {
  statusValue: string;
  onStatusChange: (value: string) => void;
  categoryValue: string;
  onCategoryChange: (value: string) => void;
  locationValue: string;
  onLocationChange: (value: string) => void;
  priceValue: string;
  onPriceChange: (value: string) => void;
  needsValue: string[];
  onNeedsChange: (value: string[]) => void;
  filterCategories: { id: string; label: string; subcategories: string[] }[];
  regions: RegionOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSection, setOpenSection] = useState<"status" | "category" | "location" | "price" | "needs" | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeCount =
    (statusValue !== "all" ? 1 : 0) + (categoryValue !== "all" ? 1 : 0) + (locationValue !== "all" ? 1 : 0) + (priceValue !== "all" ? 1 : 0) + needsValue.length;
  const isActive = activeCount > 0;
  const regionParentGroups = useRegionParentGroups();
  const parentIdSet = new Set(regionParentGroups.map((group) => group.parentId));
  const childIdSet = new Set(regionParentGroups.flatMap((group) => group.childIds));
  const standaloneRegions = regions.filter((region) => !parentIdSet.has(region.id) && !childIdSet.has(region.id));

  function toggleSection(section: "status" | "category" | "location" | "price" | "needs") {
    setOpenSection((current) => (current === section ? null : section));
  }

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggleNeed(id: string) {
    onNeedsChange(needsValue.includes(id) ? needsValue.filter((need) => need !== id) : [...needsValue, id]);
  }

  function clearAll() {
    onStatusChange("all");
    onCategoryChange("all");
    onLocationChange("all");
    onPriceChange("all");
    onNeedsChange([]);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-none border border-solid px-3 text-[13px] font-medium transition",
          isActive
            ? "border-stone-400 bg-stone-200 text-stone-950 hover:border-stone-500 hover:bg-stone-300 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-100 dark:hover:border-stone-400 dark:hover:bg-stone-600"
            : "border-stone-300 bg-stone-100 text-stone-600 hover:border-stone-400 hover:bg-stone-200 hover:text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-100",
        )}
      >
        <SlidersHorizontal className="size-3.5" />
        Filter
        {isActive ? (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-stone-950 text-[10px] font-semibold text-white dark:bg-stone-100 dark:text-stone-950">
            {activeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-20 mt-1 max-h-[75vh] w-80 overflow-y-auto rounded-none border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">Filters</span>
            {isActive ? (
              <button type="button" onClick={clearAll} className="text-[12px] font-medium text-stone-500 transition hover:text-stone-900 dark:hover:text-stone-100">
                Clear all
              </button>
            ) : null}
          </div>

          <FilterMenuSection title="Status" count={statusValue !== "all" ? 1 : 0} open={openSection === "status"} onToggle={() => toggleSection("status")}>
            <div className="space-y-1 pt-1">
              {stylistStatusFilterOptions.map((option) => (
                <FilterMenuOptionRow
                  key={option.id}
                  label={option.label}
                  isSelected={statusValue === option.id}
                  onClick={() => onStatusChange(statusValue === option.id ? "all" : option.id)}
                />
              ))}
            </div>
          </FilterMenuSection>

          <FilterMenuSection title="Category" count={categoryValue !== "all" ? 1 : 0} open={openSection === "category"} onToggle={() => toggleSection("category")}>
            <div className="space-y-1 pt-1">
              {filterCategories.map((category) => (
                <FilterMenuOptionRow
                  key={category.id}
                  label={category.label}
                  isSelected={categoryValue === category.id}
                  onClick={() => onCategoryChange(categoryValue === category.id ? "all" : category.id)}
                />
              ))}
            </div>
          </FilterMenuSection>

          <FilterMenuSection title="Location" count={locationValue !== "all" ? 1 : 0} open={openSection === "location"} onToggle={() => toggleSection("location")}>
            <div className="space-y-1 pt-1">
              {regionParentGroups.map((group) => {
                const parentRegion = regions.find((region) => region.id === group.parentId);
                if (!parentRegion) return null;
                const childRegions = regions.filter((region) => group.childIds.includes(region.id));
                const isExpanded = locationValue === group.parentId || childRegions.some((region) => region.id === locationValue);
                return (
                  <div key={group.parentId}>
                    <FilterMenuOptionRow
                      label={parentRegion.label}
                      isSelected={locationValue === parentRegion.id}
                      onClick={() => onLocationChange(locationValue === parentRegion.id ? "all" : parentRegion.id)}
                    />
                    {isExpanded
                      ? childRegions.map((region) => (
                          <FilterMenuOptionRow
                            key={region.id}
                            label={region.label}
                            isSelected={locationValue === region.id}
                            onClick={() => onLocationChange(locationValue === region.id ? "all" : region.id)}
                            indent
                          />
                        ))
                      : null}
                  </div>
                );
              })}
              {standaloneRegions.map((region) => (
                <FilterMenuOptionRow
                  key={region.id}
                  label={region.label}
                  isSelected={locationValue === region.id}
                  onClick={() => onLocationChange(locationValue === region.id ? "all" : region.id)}
                />
              ))}
            </div>
          </FilterMenuSection>

          <FilterMenuSection title="Price" count={priceValue !== "all" ? 1 : 0} open={openSection === "price"} onToggle={() => toggleSection("price")}>
            <div className="space-y-1 pt-1">
              {stylistPriceFilterOptions.map((option) => (
                <FilterMenuOptionRow
                  key={option.id}
                  label={option.label}
                  isSelected={priceValue === option.id}
                  onClick={() => onPriceChange(priceValue === option.id ? "all" : option.id)}
                />
              ))}
            </div>
          </FilterMenuSection>

          <FilterMenuSection title="Additional needs" count={needsValue.length} open={openSection === "needs"} onToggle={() => toggleSection("needs")}>
            <div className="space-y-1 pt-1">
              {stylistNeedsFilterOptions.map((option) => (
                <FilterMenuOptionRow key={option.id} label={option.label} isSelected={needsValue.includes(option.id)} onClick={() => toggleNeed(option.id)} />
              ))}
            </div>
          </FilterMenuSection>
        </div>
      ) : null}
    </div>
  );
}

const freshnessFilterOptions: { id: "service-changes" | "link-issues" | "location-updates"; label: string }[] = [
  { id: "service-changes", label: "Services incorrect" },
  { id: "link-issues", label: "Link issues" },
  { id: "location-updates", label: "Location updates" },
];

function FreshnessFilterMenu({
  value,
  onChange,
}: {
  value: "all" | "service-changes" | "link-issues" | "location-updates";
  onChange: (value: "all" | "service-changes" | "link-issues" | "location-updates") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isActive = value !== "all";

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-none border border-solid px-3 text-[13px] font-medium transition",
          isActive
            ? "border-stone-400 bg-stone-200 text-stone-950 hover:border-stone-500 hover:bg-stone-300 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-100 dark:hover:border-stone-400 dark:hover:bg-stone-600"
            : "border-stone-300 bg-stone-100 text-stone-600 hover:border-stone-400 hover:bg-stone-200 hover:text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-100",
        )}
      >
        <SlidersHorizontal className="size-3.5" />
        Filter
        {isActive ? (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-stone-950 text-[10px] font-semibold text-white dark:bg-stone-100 dark:text-stone-950">
            1
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-20 mt-1 w-64 overflow-y-auto rounded-none border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">Filters</span>
            {isActive ? (
              <button type="button" onClick={() => onChange("all")} className="text-[12px] font-medium text-stone-500 transition hover:text-stone-900 dark:hover:text-stone-100">
                Clear all
              </button>
            ) : null}
          </div>
          <div className="space-y-1 p-2">
            {freshnessFilterOptions.map((option) => (
              <FilterMenuOptionRow
                key={option.id}
                label={option.label}
                isSelected={value === option.id}
                onClick={() => onChange(value === option.id ? "all" : option.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const pricingFilterOptions: { id: "suggestions" | "instagram" | "missing"; label: string }[] = [
  { id: "suggestions", label: "Suggestions" },
  { id: "instagram", label: "Instagram only" },
  { id: "missing", label: "No pricing found" },
];

function PricingFilterMenu({
  value,
  onChange,
}: {
  value: "all" | "suggestions" | "instagram" | "missing";
  onChange: (value: "all" | "suggestions" | "instagram" | "missing") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isActive = value !== "all";

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-none border border-solid px-3 text-[13px] font-medium transition",
          isActive
            ? "border-stone-400 bg-stone-200 text-stone-950 hover:border-stone-500 hover:bg-stone-300 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-100 dark:hover:border-stone-400 dark:hover:bg-stone-600"
            : "border-stone-300 bg-stone-100 text-stone-600 hover:border-stone-400 hover:bg-stone-200 hover:text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-100",
        )}
      >
        <SlidersHorizontal className="size-3.5" />
        Filter
        {isActive ? (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-stone-950 text-[10px] font-semibold text-white dark:bg-stone-100 dark:text-stone-950">
            1
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-20 mt-1 w-64 overflow-y-auto rounded-none border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">Filters</span>
            {isActive ? (
              <button type="button" onClick={() => onChange("all")} className="text-[12px] font-medium text-stone-500 transition hover:text-stone-900 dark:hover:text-stone-100">
                Clear all
              </button>
            ) : null}
          </div>
          <div className="space-y-1 p-2">
            {pricingFilterOptions.map((option) => (
              <FilterMenuOptionRow
                key={option.id}
                label={option.label}
                isSelected={value === option.id}
                onClick={() => onChange(value === option.id ? "all" : option.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StylistTablePagination({
  page,
  pageCount,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-[13px] text-stone-500">
        <label htmlFor="stylist-page-size" className="whitespace-nowrap">
          Rows per page
        </label>
        <select
          id="stylist-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-none border border-stone-200 bg-white px-2 text-[13px] text-stone-700 outline-none focus-visible:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="hidden whitespace-nowrap sm:inline">{totalCount} total</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="whitespace-nowrap text-[13px] text-stone-500">
          Page {page} of {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="inline-flex size-8 items-center justify-center rounded-none border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-900"
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="inline-flex size-8 items-center justify-center rounded-none border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-900"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(page + 1, pageCount))}
            disabled={page >= pageCount}
            className="inline-flex size-8 items-center justify-center rounded-none border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-900"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount)}
            disabled={page >= pageCount}
            className="inline-flex size-8 items-center justify-center rounded-none border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:hover:bg-stone-900"
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftEditorDrawer({
  draft,
  regions,
  services,
  filterCategories,
  isBusy,
  onClose,
  onChange,
  onChangeLocations,
  onSave,
  onApprove,
  onDelete,
  onUnpublish,
  onPromoteSalon,
  onAddBranchToSalon,
  onUpdateBranch,
  onDeleteBranch,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  filterCategories: { id: string; label: string; subcategories: string[] }[];
  isBusy: boolean;
  onClose: () => void;
  onChange: (update: Partial<StylistDraft>) => void;
  onChangeLocations: (areaIds: string[]) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onUnpublish: () => void;
  onPromoteSalon: () => void;
  onAddBranchToSalon: (fields: Partial<BranchDraft>) => void;
  onUpdateBranch: (branchId: string, fields: Partial<BranchDraft>) => void;
  onDeleteBranch: (branchId: string) => void;
}) {
  const isPublished = getDraftDisplayStatus(draft) === "published";
  const deleteLabel = isPublished ? "Delete published stylist" : "Delete draft";
  const displayStatus = getDraftDisplayStatus(draft);
  const [hasAttemptedPublish, setHasAttemptedPublish] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("basic");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawerTabs: DrawerTab[] = ["basic", "filters", "reviews", ...(isPublished ? (["branches"] as const) : [])];
  const drawerTabLabels: Record<DrawerTab, string> = {
    basic: "Basic info",
    filters: "Filters",
    reviews: "Reviews and recommendations",
    branches: draft.branches ? `Branches (${draft.branches.length})` : "Branches",
  };

  useEffect(() => {
    setHasAttemptedPublish(false);
    setActiveTab("basic");
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [draft.id]);

  function publishDraft() {
    setHasAttemptedPublish(true);
    onApprove();
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/10">
      <button type="button" aria-label="Close editor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col overflow-hidden border-l border-stone-200 bg-white shadow-xl shadow-stone-950/10">
        <div className="shrink-0 px-8 pb-2 pt-5">
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Close editor" title="Close editor">
              <ChevronsRight className="size-4" />
            </button>
            <div className="flex items-center gap-2">
              {isPublished ? (
                <button
                  type="button"
                  onClick={onUnpublish}
                  disabled={isBusy}
                  className="inline-flex size-8 items-center justify-center rounded-md text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Unpublish stylist"
                  title="Unpublish stylist"
                >
                  <Unlink className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                disabled={isBusy}
                className="inline-flex size-8 items-center justify-center rounded-md text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={deleteLabel}
                title={deleteLabel}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3 pb-4 pt-3">
            <Input
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="Untitled stylist"
              className="h-auto rounded-none border-transparent bg-transparent px-0 py-0 text-[32px] font-semibold leading-tight tracking-normal text-stone-950 placeholder:text-stone-300 hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
            />
            {hasAttemptedPublish && getVisibleDraftWarnings(draft).length ? (
              <div className="rounded-none border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{getVisibleDraftWarnings(draft).join(" ")}</div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-b border-stone-200 px-8">
          <div className="flex gap-6">
            {drawerTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "border-b-2 py-3 text-sm font-medium transition-colors",
                  activeTab === tab ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-800",
                )}
              >
                {drawerTabLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-8">
          {activeTab === "branches" && isPublished ? (
            <BranchesTab
              draft={draft}
              regions={regions}
              isBusy={isBusy}
              onPromote={onPromoteSalon}
              onAddBranch={onAddBranchToSalon}
              onUpdateBranch={onUpdateBranch}
              onDeleteBranch={onDeleteBranch}
            />
          ) : (
            <DraftEditor
              draft={draft}
              regions={regions}
              services={services}
              filterCategories={filterCategories}
              isBusy={isBusy}
              onChange={onChange}
              onChangeLocations={onChangeLocations}
              onSave={onSave}
              onApprove={onApprove}
              onDelete={onDelete}
              canDelete={!isPublished}
              showWarnings={hasAttemptedPublish}
              isEmbedded
              embeddedSection={activeTab === "branches" ? "basic" : activeTab}
            />
          )}
        </div>

        {activeTab !== "branches" ? (
          <div className="shrink-0 border-t border-stone-200 bg-white px-8 py-5">
            <div className="flex items-center justify-end gap-4">
              {!isPublished ? (
                <Button type="button" variant="outline" onClick={onSave} disabled={isBusy} className="h-12 w-1/2 min-w-[220px] rounded-none border-stone-950 bg-white px-6 text-base font-medium text-stone-950 hover:bg-stone-50">
                  Save changes
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={isPublished ? onSave : publishDraft}
                disabled={isBusy}
                className="h-12 w-1/2 min-w-[220px] rounded-none bg-stone-950 px-6 text-base font-medium text-white hover:bg-stone-900"
              >
                {isPublished ? "Save changes" : "Publish"}
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function BranchesTab({
  draft,
  regions,
  isBusy,
  onPromote,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  isBusy: boolean;
  onPromote: () => void;
  onAddBranch: (fields: Partial<BranchDraft>) => void;
  onUpdateBranch: (branchId: string, fields: Partial<BranchDraft>) => void;
  onDeleteBranch: (branchId: string) => void;
}) {
  if (!draft.branches) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="max-w-sm text-sm text-stone-600">
          This is a single-location salon today. Turn it into a multi-branch salon to manage several locations under one entry — this one's own
          location moves onto its first branch.
        </p>
        <Button type="button" onClick={onPromote} disabled={isBusy} className="h-11 rounded-none bg-stone-950 px-5 text-sm font-medium text-white hover:bg-stone-900">
          Make this a multi-branch salon
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {draft.branches.map((branch) => (
          <BranchRow
            key={branch.id}
            branch={branch}
            regions={regions}
            isBusy={isBusy}
            onSave={(fields) => onUpdateBranch(branch.id, fields)}
            onDelete={() => onDeleteBranch(branch.id)}
          />
        ))}
      </div>
      <NewBranchForm regions={regions} isBusy={isBusy} onAdd={onAddBranch} />
    </div>
  );
}

function BranchRow({
  branch,
  regions,
  isBusy,
  onSave,
  onDelete,
}: {
  branch: BranchDraft;
  regions: RegionOption[];
  isBusy: boolean;
  onSave: (fields: Partial<BranchDraft>) => void;
  onDelete: () => void;
}) {
  const [branchLabel, setBranchLabel] = useState(branch.branchLabel);
  const [areaId, setAreaId] = useState(branch.areaId || "");
  const [postcode, setPostcode] = useState(branch.postcode || "");
  const [bookingUrl, setBookingUrl] = useState(branch.bookingUrl || "");
  const [wheelchairAccessible, setWheelchairAccessible] = useState(branch.wheelchairAccessible === true);
  const [temporarilyClosed, setTemporarilyClosed] = useState(branch.temporarilyClosed === true);

  const isDirty =
    branchLabel !== branch.branchLabel ||
    areaId !== (branch.areaId || "") ||
    postcode !== (branch.postcode || "") ||
    bookingUrl !== (branch.bookingUrl || "") ||
    wheelchairAccessible !== (branch.wheelchairAccessible === true) ||
    temporarilyClosed !== (branch.temporarilyClosed === true);

  const confidenceColor =
    branch.googleMatchConfidence === "high"
      ? "text-emerald-700"
      : branch.googleMatchConfidence === "low"
        ? "text-amber-700"
        : "text-stone-500";

  return (
    <div className="space-y-4 border border-stone-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Neighbourhood name">
          <Input value={branchLabel} onChange={(event) => setBranchLabel(event.target.value)} className="h-11 rounded-none" />
        </Field>
        <Field label="Location">
          <Select value={areaId} onChange={setAreaId}>
            <option value="">Choose a location</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Postcode">
          <Input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="e.g. SE8" className="h-11 rounded-none" />
        </Field>
        <Field label="Booking link">
          <Input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://…" className="h-11 rounded-none" />
        </Field>
      </div>

      <DraftBooleanOption label="Wheelchair accessible entrance" checked={wheelchairAccessible} onToggle={setWheelchairAccessible} />
      <DraftBooleanOption label="Temporarily closed" checked={temporarilyClosed} onToggle={setTemporarilyClosed} />

      <div className="border-t border-stone-100 pt-3 text-xs text-stone-500">
        {branch.googleDisplayName ? (
          <p>
            Matched to <span className="font-medium text-stone-700">{branch.googleDisplayName}</span> ·{" "}
            <span className={confidenceColor}>{branch.googleMatchConfidence} confidence</span>
            {typeof branch.googleReviewCount === "number" ? ` · ${branch.googleReviewCount} reviews` : ""}
          </p>
        ) : branch.googleMatchError ? (
          <p className="text-red-700">Google match failed: {branch.googleMatchError}</p>
        ) : (
          <p>Not matched to Google yet — save with a postcode to look it up.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          className="text-xs font-semibold uppercase tracking-[0.1em] text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Remove branch
        </button>
        <Button
          type="button"
          disabled={isBusy || !isDirty}
          onClick={() => onSave({ branchLabel, areaId, postcode, bookingUrl, wheelchairAccessible, temporarilyClosed })}
          className="h-10 rounded-none bg-stone-950 px-4 text-sm font-medium text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function NewBranchForm({ regions, isBusy, onAdd }: { regions: RegionOption[]; isBusy: boolean; onAdd: (fields: Partial<BranchDraft>) => void }) {
  const [branchLabel, setBranchLabel] = useState("");
  const [areaId, setAreaId] = useState("");
  const [postcode, setPostcode] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  function submit() {
    if (!branchLabel.trim()) return;
    onAdd({ branchLabel, areaId, postcode, bookingUrl });
    setBranchLabel("");
    setAreaId("");
    setPostcode("");
    setBookingUrl("");
  }

  return (
    <div className="space-y-4 border border-dashed border-stone-300 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Add a branch</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Neighbourhood name">
          <Input value={branchLabel} onChange={(event) => setBranchLabel(event.target.value)} placeholder="e.g. Woolwich" className="h-11 rounded-none" />
        </Field>
        <Field label="Location">
          <Select value={areaId} onChange={setAreaId}>
            <option value="">Choose a location</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Postcode">
          <Input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="e.g. SE18" className="h-11 rounded-none" />
        </Field>
        <Field label="Booking link">
          <Input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="https://…" className="h-11 rounded-none" />
        </Field>
      </div>
      <p className="text-xs text-stone-500">Saving looks this branch up on Google automatically using the postcode above.</p>
      <Button
        type="button"
        disabled={isBusy || !branchLabel.trim()}
        onClick={submit}
        className="h-11 rounded-none bg-stone-950 px-5 text-sm font-medium text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add branch
      </Button>
    </div>
  );
}

function DraftStatusPill({ status }: { status: string }) {
  const label = getStylistStatusLabel(status);
  const colorClass =
    status === "ready_to_publish"
      ? "bg-emerald-100 text-emerald-800"
      : status === "published"
        ? "bg-blue-100 text-blue-800"
        : "bg-stone-100 text-stone-700";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", colorClass)}>
      {status === "ready_to_publish" ? <Check className="size-3.5" /> : null}
      {label}
    </span>
  );
}

function DraftEditorStepper({
  activeStep,
  onStepChange,
}: {
  activeStep: DraftEditorStep;
  onStepChange: (step: DraftEditorStep) => void;
}) {
  const steps = [
    { id: "details" as const, number: 1, label: "Details" },
    { id: "services" as const, number: 2, label: "Services" },
    { id: "review" as const, number: 3, label: "Review" },
  ];

  return (
    <div className="mt-5 border-t border-stone-200 pt-5">
      <div className="mx-auto grid max-w-[440px] grid-cols-[1fr_1fr_1fr] items-start">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 ? <span className="absolute right-1/2 top-4 h-px w-full bg-stone-200" /> : null}
            <button
              type="button"
              onClick={() => onStepChange(step.id)}
              aria-current={step.id === activeStep ? "step" : undefined}
              aria-label={`Go to ${step.label} step`}
              className="group relative z-10 flex flex-col items-center gap-2 rounded-none px-3 text-center outline-none"
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-none border text-sm font-semibold transition",
                  step.id === activeStep
                    ? "border-stone-200 bg-stone-100 text-stone-950 group-hover:border-stone-300 group-hover:bg-stone-200"
                    : "border-transparent bg-stone-100 text-stone-500 group-hover:border-stone-300 group-hover:bg-stone-200 group-hover:text-stone-900",
                )}
              >
                {step.number}
              </span>
              <span className={cn("text-sm transition", step.id === activeStep ? "font-medium text-stone-950" : "text-stone-500 group-hover:text-stone-900")}>{step.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StylistMetricCard({
  title,
  value,
  icon,
  valueClassName,
  isActive,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className={cn("mt-5 text-4xl font-semibold leading-none tracking-tight", valueClassName)}>{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={`Show ${title} stylists`}
      className={cn(
        "rounded-none border bg-white p-6 text-left transition hover:border-stone-400",
        isActive ? "border-stone-300 bg-stone-100 hover:bg-stone-200" : "border-stone-200",
      )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-none border border-stone-200 bg-white p-6">
      {content}
    </div>
  );
}

function CompassDot() {
  return <SearchCheck className="size-4" />;
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

function DraftTableStatusBadge({ draft }: { draft: StylistDraft }) {
  const status = getDraftDisplayStatus(draft);
  const label = getStylistStatusLabel(status);
  const pillClass =
    status === "ready_to_publish"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
      : status === "published"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
        : "border-stone-300 bg-stone-50 text-stone-600 dark:border-stone-700 dark:text-stone-300";

  return <span className={cn("inline-flex items-center rounded-none border px-2 py-0.5 text-xs font-medium", pillClass)}>{label}</span>;
}

function getDraftDisplayStatus(draft: StylistDraft) {
  if (draft.status === "approved") {
    return "published";
  }

  if (draft.status === "ready_to_approve" || getDraftCompleteness(draft) === 100) {
    return "ready_to_publish";
  }

  return "draft";
}

type GoogleMatchSummary = {
  attempted: boolean;
  google: { confidence: string; displayName: string | null; formattedAddress: string | null; reviewCount: number } | null;
  googleError: string | null;
  verified: { reviewCount: number } | null;
  verifiedError: string | null;
} | null;

function describeGoogleMatch(match: GoogleMatchSummary) {
  if (!match || !match.attempted) return "";
  if (match.google) {
    const { confidence, displayName, formattedAddress, reviewCount } = match.google;
    if (confidence === "no-match") return " No matching Google listing was found.";
    const where = displayName ? ` "${displayName}"${formattedAddress ? ` (${formattedAddress})` : ""}` : "";
    const confidenceNote = confidence === "high" ? "" : " — low confidence, worth double-checking";
    return ` Google:${where}, ${reviewCount} reviews${confidenceNote}.`;
  }
  if (match.googleError) return ` Google lookup failed: ${match.googleError}`;
  return "";
}

function getStylistStatusLabel(status: string) {
  if (status === "ready_to_publish") {
    return "Complete";
  }
  if (status === "published") {
    return "Published";
  }
  return "Draft";
}

function stylistMatchesSearch(draft: StylistDraft, searchTerm: string) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    draft.name,
    draft.areaLabel,
    draft.neighbourhood,
    draft.postcode,
    draft.bookingPlatform,
    draft.bookingUrl,
    draft.instagramUrl,
    draft.tiktokUrl,
    getStylistStatusLabel(getDraftDisplayStatus(draft)),
    ...draft.services,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchTerm
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function formatDuplicateResponse(payload: { duplicates?: DuplicateMatch[] | DuplicateResult[]; message?: string }) {
  const duplicates = Array.isArray(payload.duplicates) ? payload.duplicates : [];
  const firstResult = duplicates[0];
  const first = firstResult && "duplicates" in firstResult ? firstResult.duplicates[0] : firstResult;
  if (!first) {
    return "";
  }

  const reason = first.reasons?.length ? ` (${first.reasons.join(", ")})` : "";
  const sourceLabel = first.source === "published" ? "published stylist" : "draft";
  return `Possible duplicate: ${first.name}${reason}. Open the existing ${sourceLabel} instead.`;
}

function getVisibleDraftWarnings(draft: StylistDraft) {
  return (draft.warnings || []).filter((warning) => {
    if (warning === "No booking link identified yet.") {
      return !hasDraftBookingLink(draft);
    }
    if (warning === "No services matched yet.") {
      return draft.services.length === 0;
    }
    return true;
  });
}

function hasDraftBookingLink(draft: StylistDraft) {
  return Boolean(draft.bookingUrl.trim());
}

function urlsMatch(left = "", right = "") {
  const normalize = (value: string) => value.trim().replace(/\/+$/, "").toLowerCase();
  return Boolean(normalize(left) && normalize(left) === normalize(right));
}

function isBookingLikeUrl(url = "") {
  try {
    const parsed = new URL(url);
    const text = `${parsed.pathname} ${parsed.search} ${parsed.hash}`.toLowerCase();
    return /\b(book|booking|appointments?|schedule|calendar|reserve|reservation)\b/.test(text);
  } catch {
    return false;
  }
}

function getStylistStatusCounts(drafts: StylistDraft[]) {
  return drafts.reduce(
    (counts, draft) => {
      const status = getDraftDisplayStatus(draft);
      counts[status] += 1;
      return counts;
    },
    {
      draft: 0,
      published: 0,
      ready_to_publish: 0,
    } as Record<"draft" | "published" | "ready_to_publish", number>,
  );
}

function getDraftCompleteness(draft: StylistDraft) {
  const fields = [
    Boolean(draft.name.trim()),
    Boolean(draft.instagramUrl),
    Boolean(draft.bookingUrl),
    draft.services.length > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function DashboardOverview({
  dashboard,
  publishedCount,
  onOpenView,
}: {
  dashboard: DashboardMetrics | null;
  publishedCount: number;
  onOpenView: (view: AdminView) => void;
}) {
  const isLoading = dashboard === null;
  const analytics = dashboard?.analytics;
  const allTime = dashboard?.allTime;
  const statState = isLoading ? "loading" : allTime ? "loaded" : "empty";

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-11">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Overview</h1>
      </section>

      <div className="grid grid-cols-3 divide-x divide-stone-200 rounded-none border border-stone-200 bg-white">
        <OverviewStatCell
          label="Stylists"
          value={publishedCount}
          onClick={() => onOpenView("drafts")}
          state={isLoading ? "loading" : "loaded"}
        />
        <OverviewStatCell label="Visitors" value={allTime?.visitors ?? 0} onClick={() => onOpenView("analytics")} state={statState} />
        <OverviewStatCell
          label="Clicked book"
          value={allTime?.bookingClicks ?? 0}
          onClick={() => onOpenView("analytics")}
          state={statState}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex h-full flex-col border border-stone-200 bg-white p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-950">Analytics</h2>
              <p className="mt-1 text-xs text-stone-500">Visitors, last 7 days</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenView("analytics")}
              className="text-xs font-medium text-stone-600 underline underline-offset-2 transition hover:text-stone-950"
            >
              View analytics
            </button>
          </div>
          {isLoading ? (
            <VisitorsLineChartSkeleton />
          ) : analytics ? (
            <VisitorsLineChart
              bars={analytics.visitorsByDay.map((day) => ({
                label: formatShortDate(day.date),
                value: day.count,
              }))}
              emptyLabel="No visitor data yet."
            />
          ) : (
            <SkeletonEmptyState label="No data">
              <VisitorsLineChartSkeleton pulse={false} />
            </SkeletonEmptyState>
          )}
        </div>

        <div className="border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-stone-950">Zero-result searches</h2>
          <p className="mt-1 text-xs text-stone-500">Demand signals for Discovery</p>
          {isLoading ? (
            <ZeroResultSearchesSkeleton />
          ) : (
            <ZeroResultSearchesList rows={analytics?.zeroResultSearches ?? []} onOpen={() => onOpenView("discovery")} />
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyticsPage({ onOpenView }: { onOpenView: (view: AdminView) => void }) {
  const [range, setRange] = useState<AnalyticsRangeKey>("7d");
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isRangeLoading, setIsRangeLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsRangeLoading(true);
    fetch(`/api/admin/analytics?range=${range}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        setAnalytics(payload?.analytics ?? null);
        setIsRangeLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAnalytics(null);
        setIsRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const loadActivity = useCallback(() => {
    setIsActivityLoading(true);
    return fetch("/api/admin/analytics/activity", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        setActivity(payload?.activity ?? null);
        setIsActivityLoading(false);
      })
      .catch(() => {
        setActivity(null);
        setIsActivityLoading(false);
      });
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const statState = isRangeLoading ? "loading" : analytics ? "loaded" : "empty";
  const totalVisitors = analytics?.visitorsByDay.reduce((sum, bucket) => sum + bucket.count, 0) ?? 0;
  const rangeLabel = ANALYTICS_RANGES.find((entry) => entry.key === range)?.label ?? "Last 7 days";
  const visitorsChartLabel = analytics?.granularity === "hour" ? "Hourly site visitors" : "Daily site visitors";

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-11">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Analytics</h1>
          <p className="mt-2 text-sm text-stone-500">Visitor activity on the public directory</p>
        </div>
        <div className="relative">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as AnalyticsRangeKey)}
            aria-label="Date range"
            className="min-h-11 w-full appearance-none rounded-none border border-stone-300 bg-stone-50 py-2 pl-4 pr-12 text-[13px] text-stone-900 outline-none transition-colors hover:border-stone-400 active:border-stone-400 focus:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500 dark:active:border-stone-500 dark:focus:border-stone-100"
          >
            {ANALYTICS_RANGES.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-stone-500 dark:text-stone-400"
            aria-hidden="true"
          />
        </div>
      </section>

      <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
        <OverviewStatCell label="Unique visitors" value={totalVisitors} state={statState} />
        <OverviewStatCell label="Booking link clicks" value={analytics?.bookingClicks ?? 0} state={statState} />
        <OverviewStatCell label="Instagram link clicks" value={analytics?.instagramClicks ?? 0} state={statState} />
        <OverviewStatCell label="Reviews link clicks" value={analytics?.reviewsClicks ?? 0} state={statState} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border border-stone-200 bg-white p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-stone-950">Visitors</h2>
          <p className="mt-1 text-xs text-stone-500">
            {visitorsChartLabel}, {rangeLabel.toLowerCase()}
          </p>
          {isRangeLoading ? (
            <VisitorsLineChartSkeleton />
          ) : analytics ? (
            <VisitorsLineChart
              bars={analytics.visitorsByDay.map((bucket) => ({
                label: analytics.granularity === "hour" ? formatShortTime(bucket.date) : formatShortDate(bucket.date),
                value: bucket.count,
              }))}
              emptyLabel="No visitor data yet."
            />
          ) : (
            <SkeletonEmptyState label="No data">
              <VisitorsLineChartSkeleton pulse={false} />
            </SkeletonEmptyState>
          )}
        </div>

        <div className="border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-stone-950">Most popular stylists</h2>
          <p className="mt-1 text-xs text-stone-500">By booking &amp; Instagram clicks</p>
          {isRangeLoading ? <TopStylistsSkeleton /> : <TopStylistsList rows={analytics?.topStylists ?? []} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border border-stone-200 bg-white p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-stone-950">Filters people are selecting</h2>
          <p className="mt-1 text-xs text-stone-500">Most-used filter values across all visitors</p>
          {isRangeLoading ? (
            <FilterUsageSkeleton />
          ) : analytics?.filterUsage.length ? (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
              {analytics.filterUsage.map((group) => (
                <FilterUsageGroup key={group.label} label={group.label} rows={group.rows} />
              ))}
            </div>
          ) : (
            <SkeletonEmptyState label="No data">
              <FilterUsageSkeleton pulse={false} />
            </SkeletonEmptyState>
          )}
        </div>

        <div className="border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-stone-950">Zero-result searches</h2>
          <p className="mt-1 text-xs text-stone-500">Filter combinations that returned nothing</p>
          {isRangeLoading ? (
            <ZeroResultSearchesSkeleton />
          ) : (
            <ZeroResultSearchesList rows={analytics?.zeroResultSearches ?? []} onOpen={() => onOpenView("discovery")} />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-stone-950">Reviews clicks by platform</h2>
          <p className="mt-1 text-xs text-stone-500">Which review source people click through to</p>
          {isRangeLoading ? (
            <FilterUsageSkeleton />
          ) : analytics?.reviewsClicksByPlatform.length ? (
            <div className="mt-5">
              <FilterUsageGroup label="Platform" rows={analytics.reviewsClicksByPlatform.map((row) => ({ label: row.platform, count: row.clicks }))} />
            </div>
          ) : (
            <SkeletonEmptyState label="No data">
              <FilterUsageSkeleton pulse={false} />
            </SkeletonEmptyState>
          )}
        </div>

        <div className="border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-stone-950">Visitors by device</h2>
          <p className="mt-1 text-xs text-stone-500">Desktop vs mobile vs tablet</p>
          {isRangeLoading ? (
            <FilterUsageSkeleton />
          ) : analytics?.deviceBreakdown.length ? (
            <div className="mt-5">
              <FilterUsageGroup label="Device" rows={analytics.deviceBreakdown.map((row) => ({ label: row.deviceType, count: row.visitors }))} />
            </div>
          ) : (
            <SkeletonEmptyState label="No data">
              <FilterUsageSkeleton pulse={false} />
            </SkeletonEmptyState>
          )}
        </div>
      </div>

      <div className="border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-stone-950">Visitors by location</h2>
        <p className="mt-1 text-xs text-stone-500">Where visitors are browsing from</p>
        {isRangeLoading ? (
          <FilterUsageSkeleton />
        ) : analytics?.countryBreakdown.length || analytics?.cityBreakdown.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
            <FilterUsageGroup label="Country" rows={(analytics?.countryBreakdown ?? []).map((row) => ({ label: row.country, count: row.visitors }))} />
            <FilterUsageGroup label="City" rows={(analytics?.cityBreakdown ?? []).map((row) => ({ label: row.city, count: row.visitors }))} />
          </div>
        ) : (
          <SkeletonEmptyState label="No data">
            <FilterUsageSkeleton pulse={false} />
          </SkeletonEmptyState>
        )}
      </div>

      <div className="border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-950">Recent activity</h2>
            <p className="mt-1 text-xs text-stone-500">
              Last {RECENT_ACTIVITY_LIMIT} raw events, most recent first — dimmed rows matched an IP in{" "}
              <code className="text-[11px]">POSTHOG_INTERNAL_IPS</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadActivity()}
            disabled={isActivityLoading}
            className="text-xs font-medium text-stone-600 underline underline-offset-2 transition hover:text-stone-950 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {isActivityLoading ? (
          <RecentActivitySkeleton />
        ) : activity ? (
          <RecentActivityList rows={activity} />
        ) : (
          <SkeletonEmptyState label="No data">
            <RecentActivitySkeleton pulse={false} />
          </SkeletonEmptyState>
        )}
      </div>
    </div>
  );
}

const RECENT_ACTIVITY_LIMIT = 50;

function RecentActivitySkeleton({ pulse = true }: { pulse?: boolean }) {
  const bar = pulse ? "animate-pulse bg-stone-200" : "bg-stone-100";
  return (
    <ul className="mt-5 space-y-3">
      {[0, 1, 2, 3, 4].map((index) => (
        <li key={index} className={cn("h-4 w-full rounded-none", bar)} />
      ))}
    </ul>
  );
}

function RecentActivityList({ rows }: { rows: ActivityEvent[] }) {
  if (!rows.length) {
    return (
      <SkeletonEmptyState label="No data">
        <RecentActivitySkeleton pulse={false} />
      </SkeletonEmptyState>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs font-medium uppercase tracking-[0.1em] text-stone-400">
            <th className="pb-2 pr-4 font-medium">Time</th>
            <th className="pb-2 pr-4 font-medium">Event</th>
            <th className="pb-2 pr-4 font-medium">Page</th>
            <th className="pb-2 pr-4 font-medium">Device</th>
            <th className="pb-2 pr-4 font-medium">IP</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, index) => (
            <tr key={`${row.timestamp}-${index}`} className={row.isInternal ? "opacity-50" : undefined}>
              <td className="whitespace-nowrap py-2 pr-4 text-stone-500">{formatDateTime(row.timestamp)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-stone-900">{humanizeEventName(row.event)}</td>
              <td className="max-w-[220px] truncate py-2 pr-4 text-stone-700">{getUrlPath(row.url)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-stone-500">{row.deviceType ?? "—"}</td>
              <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-stone-500">{row.ip ?? "—"}</td>
              <td className="whitespace-nowrap py-2">
                {row.isInternal ? (
                  <Badge variant="secondary" className="text-[11px]">
                    Internal
                  </Badge>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function humanizeEventName(event: string) {
  if (event === "$pageview") return "Pageview";
  return event.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function getUrlPath(url: string | null) {
  if (!url) return "—";
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function FilterUsageGroup({ label, rows }: { label: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-stone-400">{label}</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-stone-700">{row.label}</span>
              <span className="shrink-0 font-medium text-stone-950">{row.count}</span>
            </div>
            <div className="mt-1 h-1 w-full bg-stone-100">
              <div className="h-1 bg-stone-950" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonEmptyState({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
        <span className="text-xs font-medium text-stone-400">{label}</span>
      </div>
    </div>
  );
}

function FilterUsageSkeleton({ pulse = true }: { pulse?: boolean }) {
  const bar = pulse ? "animate-pulse bg-stone-200" : "bg-stone-100";
  const barLight = pulse ? "animate-pulse bg-stone-100" : "bg-stone-50";

  return (
    <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
      {[0, 1, 2, 3].map((groupIndex) => (
        <div key={groupIndex}>
          <span className={cn("block h-3 w-16 rounded-none", bar)} />
          <ul className="mt-3 space-y-2.5">
            {[0, 1, 2].map((rowIndex) => (
              <li key={rowIndex}>
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("h-3.5 w-24 rounded-none", barLight)} />
                  <span className={cn("h-3.5 w-6 shrink-0 rounded-none", bar)} />
                </div>
                <div className={cn("mt-1 h-1 w-full", barLight)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TopStylistsList({ rows }: { rows: { name: string; areaLabel: string; clicks: number }[] }) {
  if (!rows.length) {
    return (
      <SkeletonEmptyState label="No data">
        <TopStylistsSkeleton pulse={false} />
      </SkeletonEmptyState>
    );
  }

  return (
    <ul className="mt-5 space-y-4">
      {rows.map((row) => (
        <li key={row.name} className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center bg-stone-100 text-xs font-semibold text-stone-600">
            {getInitials(row.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-stone-950">{row.name}</span>
            <span className="block truncate text-xs text-stone-500">{row.areaLabel || "Unknown area"}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-stone-950">
            {row.clicks} click{row.clicks === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TopStylistsSkeleton({ pulse = true }: { pulse?: boolean }) {
  const bar = pulse ? "animate-pulse bg-stone-200" : "bg-stone-100";
  const barLight = pulse ? "animate-pulse bg-stone-100" : "bg-stone-50";

  return (
    <ul className="mt-5 space-y-4">
      {[0, 1, 2, 3, 4].map((index) => (
        <li key={index} className="flex items-center gap-3">
          <span className={cn("size-9 shrink-0 rounded-none", bar)} />
          <span className="min-w-0 flex-1">
            <span className={cn("block h-3.5 w-32 rounded-none", bar)} />
            <span className={cn("mt-1.5 block h-3 w-20 rounded-none", barLight)} />
          </span>
          <span className={cn("h-3 w-12 shrink-0 rounded-none", bar)} />
        </li>
      ))}
    </ul>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}


function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("en-GB", { hour: "numeric" });
}

function formatStatValue(value: number) {
  if (value < 10000) return value.toLocaleString("en-GB");
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function OverviewStatCell({
  label,
  value,
  onClick,
  state = "loaded",
}: {
  label: string;
  value: number;
  onClick?: () => void;
  state?: "loading" | "empty" | "loaded";
}) {
  const valueContent =
    state === "loading" ? (
      <span className="mt-2 block h-7 w-16 animate-pulse rounded-none bg-stone-200" />
    ) : state === "empty" ? (
      <SkeletonEmptyState label="No data">
        <span className="mt-2 block h-7 w-20 rounded-none bg-stone-100" />
      </SkeletonEmptyState>
    ) : (
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950" title={value.toLocaleString("en-GB")}>
        {formatStatValue(value)}
      </p>
    );

  const content = (
    <>
      <p className="text-[13px] text-stone-500">{label}</p>
      {valueContent}
    </>
  );

  if (!onClick) {
    return <div className="p-5">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${label}`}
      className="cursor-pointer p-5 text-left transition hover:bg-stone-50 active:bg-stone-100"
    >
      {content}
    </button>
  );
}

function VisitorsLineChartSkeleton({ pulse = true }: { pulse?: boolean }) {
  return <div className={cn("mt-6 h-56 w-full rounded-none", pulse ? "animate-pulse bg-stone-200" : "bg-stone-100")} />;
}

function VisitorsLineChart({ bars, emptyLabel }: { bars: { label: string; value: number }[]; emptyLabel: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!bars.length) {
    return <p className="mt-8 text-sm text-stone-400">{emptyLabel}</p>;
  }

  const width = 700;
  const height = 220;
  const paddingX = 4;
  const paddingTop = 28;
  const paddingBottom = 4;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  const points = bars.map((bar, index) => ({
    x: bars.length === 1 ? paddingX + plotWidth / 2 : paddingX + (index / (bars.length - 1)) * plotWidth,
    y: paddingTop + plotHeight - (bar.value / max) * plotHeight,
    bar,
  }));

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${paddingTop + plotHeight} L${points[0].x.toFixed(2)},${paddingTop + plotHeight} Z`;
  const lastPoint = points[points.length - 1];
  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  // Cap the number of x-axis labels shown so they never overlap, whether the series has 7 points or 90.
  // Evenly spaced by rounded position (not a fixed step) so the last label never crowds the one before it.
  const maxLabels = 8;
  const labelCount = Math.min(maxLabels, points.length);
  const labelIndices = new Set(
    Array.from({ length: labelCount }, (_, i) => (labelCount === 1 ? 0 : Math.round((i * (points.length - 1)) / (labelCount - 1)))),
  );

  return (
    <div className="mt-6 flex-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-0 top-0 text-[11px] font-medium text-stone-400">peak {max}</span>
        {!hovered ? (
          <span
            className="pointer-events-none absolute whitespace-nowrap text-xs font-semibold text-stone-950"
            style={{ left: `${(lastPoint.x / width) * 100}%`, top: `${(lastPoint.y / height) * 100}%`, transform: "translate(-100%, -160%)" }}
          >
            {lastPoint.bar.value}
          </span>
        ) : null}
        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap border border-stone-200 bg-white px-2 py-1 text-xs shadow-sm"
            style={{
              left: `${(hovered.x / width) * 100}%`,
              top: `${(hovered.y / height) * 100}%`,
              transform: `translate(${hoveredIndex === 0 ? "0%" : hoveredIndex === points.length - 1 ? "-100%" : "-50%"}, -135%)`,
            }}
          >
            <span className="text-stone-500">{hovered.bar.label}</span>{" "}
            <span className="font-semibold text-stone-950">{hovered.bar.value}</span>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-56 w-full overflow-visible"
          role="img"
          aria-label="Visitors over time"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <path d={areaPath} fill="rgba(28,25,23,0.08)" stroke="none" />
          <path d={linePath} fill="none" stroke="#1c1917" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === index ? 4 : 2.5}
              fill="#1c1917"
              className="transition-[r]"
            />
          ))}
          {points.map((point, index) => (
            <circle
              key={`hit-${index}`}
              cx={point.x}
              cy={point.y}
              r={10}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-stone-500">
        {points.map((point, index) => {
          if (!labelIndices.has(index)) return null;
          const percent = (point.x / width) * 100;
          const isFirst = index === 0;
          const isLast = index === points.length - 1;
          return (
            <span
              key={index}
              className="absolute whitespace-nowrap"
              style={{
                left: `${percent}%`,
                transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {point.bar.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ZeroResultSearchesSkeleton({ pulse = true }: { pulse?: boolean }) {
  const bar = pulse ? "animate-pulse bg-stone-200" : "bg-stone-100";
  const barLight = pulse ? "animate-pulse bg-stone-100" : "bg-stone-50";

  return (
    <ul className="mt-5 space-y-4">
      {[0, 1, 2].map((index) => (
        <li key={index} className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap gap-1.5">
              <span className={cn("h-5 w-20 rounded-none", bar)} />
              <span className={cn("h-5 w-16 rounded-none", barLight)} />
            </span>
            <span className={cn("mt-1.5 block h-3 w-24 rounded-none", barLight)} />
          </span>
          <span className={cn("h-3 w-14 shrink-0 rounded-none", bar)} />
        </li>
      ))}
    </ul>
  );
}

function ZeroResultSearchesList({
  rows,
  onOpen,
}: {
  rows: { filters: string[]; count: number; lastSeenAt: string }[];
  onOpen: () => void;
}) {
  if (!rows.length) {
    return (
      <SkeletonEmptyState label="No data">
        <ZeroResultSearchesSkeleton pulse={false} />
      </SkeletonEmptyState>
    );
  }

  return (
    <ul className="mt-5 space-y-4">
      {rows.map((row) => (
        <li key={row.filters.join("|")}>
          <button type="button" onClick={onOpen} className="flex w-full items-start justify-between gap-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap gap-1.5">
                {row.filters.map((filter) => (
                  <Badge key={filter} variant="outline" className="bg-white text-[11px]">
                    {filter}
                  </Badge>
                ))}
              </span>
              <span className="mt-1.5 block truncate text-xs text-stone-500">Last seen {formatRelativeTime(row.lastSeenAt)}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-stone-950">
              {row.count} search{row.count === 1 ? "" : "es"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type FreshnessPageApplyHandler = (
  check: DirectoryCheck,
  update: FreshnessUpdate,
) => void;

function FreshnessPage({
  dashboard,
  checks,
  checksLoadedAt,
  checkProgress,
  activeCheckBatch,
  isRunningChecks,
  isBusy,
  lastUndo,
  onRunChecks,
  onApply,
  onUndo,
}: {
  dashboard: DashboardMetrics | null;
  checks: DirectoryCheck[];
  checksLoadedAt: string | null;
  checkProgress: { checkedCount: number; total: number; nextOffset: number | null };
  activeCheckBatch: { from: number; to: number };
  isRunningChecks: boolean;
  isBusy: boolean;
  lastUndo: FreshnessUndoState | null;
  onRunChecks: () => void;
  onApply: FreshnessPageApplyHandler;
  onUndo: () => void;
}) {
  const total = checkProgress.total || dashboard?.freshness.total || 0;
  const checkedCount = checkProgress.checkedCount || dashboard?.freshness.checkedCount || 0;
  const [freshnessFilter, setFreshnessFilter] = useState<"all" | "service-changes" | "link-issues" | "location-updates">("all");
  const [freshnessSearchTerm, setFreshnessSearchTerm] = useState("");
	  const rows = buildFreshnessRecommendationGroups(checks);
  const healthRows = filterFreshnessRowsByDetail(rows, (detail) => detail.kind !== "price" && detail.kind !== "price-info" && detail.kind !== "manual-price");
	  const recommendationCount = healthRows.length;
		  const lastCompletedAt = checksLoadedAt || dashboard?.freshness.updatedAt;
		  const hasCompletedCheck = Boolean(lastCompletedAt || checkedCount > 0 || rows.length > 0);
  const isWaitingForResults = isRunningChecks && rows.length === 0;
  const activeBatchTo = total ? Math.min(activeCheckBatch.to, total) : activeCheckBatch.to;
  const runButtonLabel = isRunningChecks
    ? `Checking ${activeCheckBatch.from} - ${activeBatchTo}`
    : "Run";
  const serviceChanges = healthRows.filter((row) => row.details.some((detail) => detail.kind === "add" || detail.kind === "remove")).length;
  const linkIssues = healthRows.filter((row) => row.details.some((detail) => detail.kind === "fix" || detail.kind === "manual")).length;
  const locationUpdates = healthRows.filter((row) => row.details.some((detail) => detail.kind === "location")).length;
  const filteredRows = freshnessFilter === "service-changes"
    ? healthRows.filter((row) => row.details.some((d) => d.kind === "add" || d.kind === "remove"))
    : freshnessFilter === "link-issues"
      ? healthRows.filter((row) => row.details.some((d) => d.kind === "fix" || d.kind === "manual"))
      : freshnessFilter === "location-updates"
          ? healthRows.filter((row) => row.details.some((d) => d.kind === "location"))
          : healthRows;
  const normalizedFreshnessSearch = freshnessSearchTerm.trim().toLowerCase();
  const visibleRows = normalizedFreshnessSearch
    ? filteredRows.filter((row) => row.stylist.toLowerCase().includes(normalizedFreshnessSearch))
    : filteredRows;

	  return (
	    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
	      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
	        <div>
	          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Health check</h1>
	          <p className="mt-2 text-sm text-stone-500">
	            {lastCompletedAt ? `Last updated ${formatRelativeTime(lastCompletedAt)}` : "Not run yet"}
	          </p>
	        </div>
	        <div className="flex items-center gap-2">
	          {lastUndo ? (
	            <button
	              type="button"
	              onClick={onUndo}
	              disabled={isBusy}
	              title={`Undo ${lastUndo.label}`}
	              className="inline-flex size-10 items-center justify-center rounded-none border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
	            >
	              <Undo2 className="size-4" />
	              <span className="sr-only">Undo {lastUndo.label}</span>
	            </button>
	          ) : null}
	          <Button type="button" onClick={onRunChecks} disabled={isRunningChecks} className="h-10 rounded-none bg-stone-950 px-4 text-sm">
	            {isRunningChecks ? <Loader2 className="size-4 animate-spin" /> : <PlayIcon />}
	            {runButtonLabel}
	          </Button>
	        </div>
	      </section>

	      {isWaitingForResults ? (
          <FreshnessMetricSkeleton />
        ) : (
          <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
            <StylistStatCell label="Services incorrect" value={serviceChanges} />
            <StylistStatCell label="Link issues" value={linkIssues} />
            <StylistStatCell label="Location updates" value={locationUpdates} />
            <StylistStatCell label="Total" value={recommendationCount} />
          </div>
        )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={freshnessSearchTerm}
            onChange={(event) => setFreshnessSearchTerm(event.target.value)}
            placeholder="Search stylist name"
            aria-label="Search health check entries"
            className="h-10 rounded-none pl-9 pr-9 text-sm"
          />
          {freshnessSearchTerm ? (
            <button
              type="button"
              onClick={() => setFreshnessSearchTerm("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
              aria-label="Clear health check search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <FreshnessFilterMenu value={freshnessFilter} onChange={setFreshnessFilter} />
      </div>

      <FreshnessInboxLayout
        rows={visibleRows}
        hasUnfilteredRows={healthRows.length > 0}
        isBusy={isBusy}
        isWaitingForResults={isWaitingForResults}
        onApply={onApply}
        onRunChecks={onRunChecks}
        onClearFilters={() => {
          setFreshnessSearchTerm("");
          setFreshnessFilter("all");
        }}
        isRunningChecks={isRunningChecks}
      />
	    </div>
	  );
	}

function FreshnessInboxLayout({
  rows,
  hasUnfilteredRows,
  isBusy,
  isWaitingForResults,
  onApply,
  onRunChecks,
  onClearFilters,
  isRunningChecks,
}: {
  rows: FreshnessRecommendationGroup[];
  hasUnfilteredRows: boolean;
  isBusy: boolean;
  isWaitingForResults: boolean;
  onApply: FreshnessPageApplyHandler;
  onRunChecks: () => void;
  onClearFilters: () => void;
  isRunningChecks: boolean;
}) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(rows[0]?.id ?? null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (!rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(rows[0]?.id ?? null);
    }
  }, [rows, selectedRowId]);

  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;

  if (isWaitingForResults) {
    return (
      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        <FreshnessSkeleton />
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        {hasUnfilteredRows ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
            <SearchX className="mb-4 size-8 text-stone-300" />
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">No matches</h2>
            <p className="mt-3 max-w-xl text-base text-stone-500">No health issues match your search or filter.</p>
            <Button type="button" variant="outline" onClick={onClearFilters} className="mt-8 h-11 rounded-none bg-white px-4 text-sm">
              <X className="size-4" />
              Clear search & filter
            </Button>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
            <SearchX className="mb-4 size-8 text-stone-300" />
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">All clear</h2>
            <p className="mt-3 max-w-xl text-base text-stone-500">No health issues found. Everything is running smoothly.</p>
            <Button type="button" variant="outline" onClick={onRunChecks} disabled={isRunningChecks} className="mt-8 h-11 rounded-none bg-white px-4 text-sm">
              <RefreshCw className="size-4" />
              Run check again
            </Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="grid overflow-hidden rounded-none border border-stone-200 bg-white lg:grid-cols-4">
      <div className={cn("max-h-[75vh] overflow-y-auto border-stone-200 lg:col-span-1 lg:block lg:border-r", mobileDetailOpen ? "hidden" : "block")}>
        <FreshnessInboxList
          rows={rows}
          selectedRowId={selectedRowId}
          onSelect={(rowId) => {
            setSelectedRowId(rowId);
            setMobileDetailOpen(true);
          }}
        />
      </div>
      <div className={cn("max-h-[75vh] overflow-y-auto lg:col-span-3", mobileDetailOpen ? "block" : "hidden lg:block")}>
        <FreshnessInboxDetail
          row={selectedRow}
          isBusy={isBusy}
          onApply={onApply}
          onBack={() => setMobileDetailOpen(false)}
        />
      </div>
    </section>
  );
}

function FreshnessInboxList({
  rows,
  selectedRowId,
  onSelect,
}: {
  rows: FreshnessRecommendationGroup[];
  selectedRowId: string | null;
  onSelect: (rowId: string) => void;
}) {
  return (
    <div>
      {rows.map((row) => (
        <FreshnessInboxListItem key={row.id} row={row} isActive={row.id === selectedRowId} onSelect={() => onSelect(row.id)} />
      ))}
    </div>
  );
}

function FreshnessInboxListItem({
  row,
  isActive,
  onSelect,
}: {
  row: FreshnessRecommendationGroup;
  isActive: boolean;
  onSelect: () => void;
}) {
  const preview = summarizeFreshnessDetailsAsText(row.details) || row.recommendation;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border-b border-stone-100 px-4 py-4 text-left transition last:border-b-0",
        isActive ? "bg-stone-100" : "hover:bg-stone-50",
      )}
    >
      <FreshnessInboxAvatar name={row.stylist} tone={row.typeTone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-stone-950">{row.stylist}</p>
          <span className="shrink-0 text-xs text-stone-400">{row.detected}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-stone-500">{preview}</p>
      </div>
    </button>
  );
}

function FreshnessInboxAvatar({ name, tone }: { name: string; tone: FreshnessRecommendationGroup["typeTone"] }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const toneClass =
    tone === "critical"
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        : tone === "info"
          ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
          : "bg-stone-150 text-stone-600 dark:bg-stone-800 dark:text-stone-300";

  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-none text-sm font-semibold", toneClass)}>
      {initial}
    </span>
  );
}

function FreshnessInboxDetail({
  row,
  isBusy,
  onApply,
  onBack,
}: {
  row: FreshnessRecommendationGroup | null;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
  onBack: () => void;
}) {
  if (!row) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm text-stone-500">Select a salon to see what needs attention.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-stone-200 px-6 py-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-none text-stone-500 hover:bg-stone-100 hover:text-stone-950 lg:hidden"
          aria-label="Back to list"
        >
          <ChevronLeft className="size-4" />
        </button>
        <FreshnessInboxAvatar name={row.stylist} tone={row.typeTone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-stone-950">{row.stylist}</p>
          <p className="truncate text-sm text-stone-500">{row.check.areaLabel || row.recommendation}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-stone-700">
          <FreshnessLinkButtons row={row} />
        </div>
      </div>
      <div className="px-6 py-6">
        <FreshnessRecommendationBody key={row.id} row={row} isBusy={isBusy} onApply={onApply} />
      </div>
    </div>
  );
}

function PlayIcon() {
  return <span className="ml-0.5 inline-block size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />;
}

function PricingPage({
  dashboard,
  checks,
  checksLoadedAt,
  checkProgress,
  activeCheckBatch,
  isRunningChecks,
  isBusy,
  onRunMissingPrices,
  onApply,
}: {
  dashboard: DashboardMetrics | null;
  checks: DirectoryCheck[];
  checksLoadedAt: string | null;
  checkProgress: { checkedCount: number; total: number; nextOffset: number | null };
  activeCheckBatch: { from: number; to: number };
  isRunningChecks: boolean;
  isBusy: boolean;
  onRunMissingPrices: () => void;
  onApply: FreshnessPageApplyHandler;
}) {
  const total = checkProgress.total || dashboard?.freshness.total || 0;
  const activeBatchTo = total ? Math.min(activeCheckBatch.to, total) : activeCheckBatch.to;
  const [pricingFilter, setPricingFilter] = useState<"all" | "suggestions" | "instagram" | "missing">("all");
  const [pricingSearchTerm, setPricingSearchTerm] = useState("");
  const rows = buildFreshnessRecommendationGroups(checks);
  const suggestionRows = filterFreshnessRowsByDetail(rows, (detail) => detail.kind === "price" && detail.priceAutoApplied !== true);
  const instagramRows = filterFreshnessRowsByDetail(rows, (detail, row) => detail.kind === "manual-price" && detail.manualPriceReason === "social-only" && !hasSavedPriceBand(row.check));
  const missingRows = filterFreshnessRowsByDetail(rows, (detail, row) => detail.kind === "manual-price" && detail.manualPriceReason === "no-price" && !hasSavedPriceBand(row.check));
  const allPricingRows = Array.from(new Map([...suggestionRows, ...instagramRows, ...missingRows].map((row) => [row.id, row])).values());
  const filteredPricingRows = pricingFilter === "suggestions"
    ? suggestionRows
    : pricingFilter === "instagram"
      ? instagramRows
      : pricingFilter === "missing"
        ? missingRows
        : allPricingRows;
  const normalizedPricingSearch = pricingSearchTerm.trim().toLowerCase();
  const visibleRows = normalizedPricingSearch
    ? filteredPricingRows.filter((row) => row.stylist.toLowerCase().includes(normalizedPricingSearch))
    : filteredPricingRows;
  const lastCompletedAt = checksLoadedAt || dashboard?.freshness.updatedAt;

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Pricing</h1>
          <p className="mt-2 text-sm text-stone-500">
            {lastCompletedAt ? `Last checked ${formatRelativeTime(lastCompletedAt)}` : "Run a pricing check to begin"}
          </p>
        </div>
        <Button type="button" onClick={onRunMissingPrices} disabled={isRunningChecks} className="h-10 rounded-none bg-stone-950 px-4 text-sm">
          {isRunningChecks ? <Loader2 className="size-4 animate-spin" /> : <PoundSterling className="size-4" />}
          {isRunningChecks ? `Checking ${activeCheckBatch.from} - ${activeBatchTo}` : "Run pricing check"}
        </Button>
      </section>

      <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
        <StylistStatCell label="Suggestions" value={suggestionRows.length} />
        <StylistStatCell label="Instagram only" value={instagramRows.length} />
        <StylistStatCell label="No pricing found" value={missingRows.length} />
        <StylistStatCell label="Total" value={allPricingRows.length} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={pricingSearchTerm}
            onChange={(event) => setPricingSearchTerm(event.target.value)}
            placeholder="Search stylist name"
            aria-label="Search pricing check entries"
            className="h-10 rounded-none pl-9 pr-9 text-sm"
          />
          {pricingSearchTerm ? (
            <button
              type="button"
              onClick={() => setPricingSearchTerm("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
              aria-label="Clear pricing check search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <PricingFilterMenu value={pricingFilter} onChange={setPricingFilter} />
      </div>

      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        {isRunningChecks && !visibleRows.length ? (
          <FreshnessSkeleton />
        ) : visibleRows.length ? (
          visibleRows.map((row, index) => (
            <FreshnessRecommendationCard key={row.id} row={row} defaultOpen={index === 0} isBusy={isBusy} onApply={onApply} />
          ))
        ) : allPricingRows.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
            <SearchX className="mb-4 size-8 text-stone-300" />
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">No matches</h2>
            <p className="mt-3 max-w-xl text-base text-stone-500">No pricing checks match your search or filter.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPricingSearchTerm("");
                setPricingFilter("all");
              }}
              className="mt-8 h-11 rounded-none bg-white px-4 text-sm"
            >
              <X className="size-4" />
              Clear search & filter
            </Button>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
            <SearchX className="mb-4 size-8 text-stone-300" />
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">No pricing checks</h2>
            <p className="mt-3 max-w-xl text-base text-stone-500">No price suggestions, Instagram-only checks, or missing prices need review.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function FreshnessRecommendationCard({
  row,
  defaultOpen,
  isBusy,
  onApply,
}: {
  row: FreshnessRecommendationGroup;
  defaultOpen: boolean;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4 px-7 py-5">
        <button type="button" onClick={() => setIsOpen((current) => !current)} className="min-w-0 flex-1 text-left">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-stone-950">{row.stylist}</span>
            <FreshnessDetailSummary details={row.details} />
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 text-stone-700">
          <FreshnessLinkButtons row={row} />
          <IconActionDivider />
          <button type="button" onClick={() => setIsOpen((current) => !current)} className="inline-flex size-8 items-center justify-center rounded-none hover:bg-stone-100" aria-label={isOpen ? "Collapse recommendations" : "Expand recommendations"}>
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="px-7 pb-6">
          <FreshnessRecommendationBody row={row} isBusy={isBusy} onApply={onApply} />
        </div>
      ) : null}
    </div>
  );
}

function FreshnessRecommendationBody({
  row,
  isBusy,
  onApply,
}: {
  row: FreshnessRecommendationGroup;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
}) {
  const hasWebsiteLinkIssue = row.check.linkChecks.some((linkCheck) => linkCheck.type === "website" && linkCheck.status !== "ok");
  const primaryLinkLabel = hasWebsiteLinkIssue ? "Website URL" : "Booking URL";
  const primaryLinkValue = row.bookingUrl || "";
  const [primaryLinkUrl, setPrimaryLinkUrl] = useState(primaryLinkValue);
  const [instagramUrl, setInstagramUrl] = useState(row.instagramUrl || "");
  const [linkSaveState, setLinkSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [ignoreReasonPrompt, setIgnoreReasonPrompt] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");
  const hasLinkIssues = row.details.some((d) => d.kind === "fix" || d.kind === "manual");
  const selectableIndexes = row.details.map((_, index) => index).filter((index) => isDetailBulkSelectable(row.details[index], row));
  const allSelected = selectableIndexes.length > 0 && selectableIndexes.every((index) => selectedIndexes.has(index));
  const someSelected = selectableIndexes.some((index) => selectedIndexes.has(index));
  // Same "default to Instagram as the booking link" escape hatch the stylist
  // drafts drawer offers (toggleBookingSameAsInstagram) — useful here when a
  // salon's real booking link has gone dead and Instagram is the best fallback.
  const bookingLinkMatchesInstagram = !hasWebsiteLinkIssue && urlsMatch(primaryLinkUrl, instagramUrl);

  function toggleUseInstagramAsBooking(checked: boolean) {
    setPrimaryLinkUrl(checked ? instagramUrl : bookingLinkMatchesInstagram ? "" : primaryLinkUrl);
  }

  async function handleSaveLinks() {
    setLinkSaveState("saving");
    try {
      const linkUpdate: FreshnessUpdate = {
        bookingUrl: primaryLinkUrl,
        ...(bookingLinkMatchesInstagram ? { bookingPlatform: "Instagram" } : {}),
      };
      await Promise.resolve(onApply(row.check, { ...linkUpdate, instagramUrl }));
      setLinkSaveState("saved");
      setTimeout(() => setLinkSaveState("idle"), 2500);
    } catch {
      setLinkSaveState("idle");
    }
  }

  async function handleBulkAccept() {
    const selectedDetails = Array.from(selectedIndexes).map((index) => row.details[index]).filter(Boolean);
    const merged = mergeFreshnessAcceptUpdates(selectedDetails, row);
    if (!merged) {
      return;
    }
    await Promise.resolve(onApply(row.check, merged));
    setSelectedIndexes(new Set());
  }

  async function handleBulkIgnore() {
    const selectedDetails = Array.from(selectedIndexes).map((index) => row.details[index]).filter(Boolean);
    const merged = mergeFreshnessRejectUpdates(selectedDetails, row);
    if (!merged) {
      return;
    }
    const reason = ignoreReason.trim();
    // Attribute evidence strings are prefixed "Booking: ..." / "Website: ..." /
    // "Instagram: ..." for display — strip that back off so it matches the raw
    // text the server's evidence-finders produced. Add-service evidence is
    // already raw (no prefix). Remove/price/location rejections aren't
    // included here — see loadLearnedExclusions() server-side for why those
    // need a different kind of learning than "ignore this evidence phrase".
    const rejectedEvidence = selectedDetails.flatMap((detail) => {
      if (detail.kind === "attribute" && detail.attributeField) {
        return (detail.evidence || []).map((line) => ({
          kind: "attribute" as const,
          field: detail.attributeField as string,
          evidenceText: line.replace(/^[A-Za-z]+:\s*/, ""),
        }));
      }
      if (detail.kind === "add" && detail.service) {
        return (detail.evidence || []).map((line) => ({
          kind: "add" as const,
          field: detail.service as string,
          evidenceText: line,
        }));
      }
      return [];
    });
    await Promise.resolve(onApply(row.check, {
      ...merged,
      ...(reason ? {
        feedbackReason: reason,
        feedbackContext: selectedDetails.map((detail) => detail.label),
        ...(rejectedEvidence.length ? { feedbackRejectedEvidence: rejectedEvidence } : {}),
      } : {}),
    }));
    setSelectedIndexes(new Set());
    setIgnoreReasonPrompt(false);
    setIgnoreReason("");
  }

  function toggleSelected(index: number) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIndexes(allSelected ? new Set() : new Set(selectableIndexes));
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-none border border-stone-200">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[13px] font-semibold text-stone-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={!selectableIndexes.length}
                  aria-label="Select all suggestions"
                />
              </th>
              <th className="w-28 px-4 py-3">Type</th>
              <th className="w-64 px-4 py-3">Suggestion</th>
              <th className="px-4 py-3">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {row.details.map((detail, index) => (
              <FreshnessRecommendationTableRow
                key={`${row.id}-${detail.label}-${index}`}
                detail={detail}
                row={row}
                isBusy={isBusy}
                onApply={onApply}
                selectable={isDetailBulkSelectable(detail, row)}
                isSelected={selectedIndexes.has(index)}
                onToggleSelected={() => toggleSelected(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {someSelected && ignoreReasonPrompt ? (
        <div className="sticky bottom-4 z-10 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-none bg-stone-950 px-5 py-3 text-sm font-medium text-white shadow-lg">
            <span className="whitespace-nowrap text-stone-300">Why? (optional)</span>
            <input
              type="text"
              autoFocus
              value={ignoreReason}
              onChange={(event) => setIgnoreReason(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleBulkIgnore();
                if (event.key === "Escape") setIgnoreReasonPrompt(false);
              }}
              placeholder="e.g. it's still on their booking page as..."
              className="h-8 w-64 rounded-none border border-stone-700 bg-stone-900 px-2 text-sm text-white placeholder:text-stone-500 focus:border-stone-400 focus:outline-none"
            />
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              disabled={isBusy}
              onClick={handleBulkIgnore}
              className="inline-flex items-center gap-1.5 whitespace-nowrap transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ban className="size-4" />
              Confirm ignore
            </button>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={() => {
                setIgnoreReasonPrompt(false);
                setIgnoreReason("");
              }}
              aria-label="Cancel"
              className="inline-flex items-center justify-center text-stone-300 transition hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : someSelected ? (
        <div className="sticky bottom-4 z-10 flex justify-center">
          <div className="inline-flex items-center gap-4 rounded-none bg-stone-950 px-5 py-3 text-sm font-medium text-white shadow-lg">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-none bg-white/15 text-xs font-semibold">{selectedIndexes.size}</span>
              selected
            </span>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              disabled={isBusy}
              onClick={handleBulkAccept}
              className="inline-flex items-center gap-1.5 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="size-4" />
              Accept
            </button>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIgnoreReasonPrompt(true)}
              className="inline-flex items-center gap-1.5 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ban className="size-4" />
              Ignore
            </button>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={() => setSelectedIndexes(new Set())}
              aria-label="Clear selection"
              className="inline-flex items-center justify-center text-stone-300 transition hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      {hasLinkIssues ? (
        <div className="space-y-3 rounded-none border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Links</p>
            <button
              type="button"
              disabled={isBusy || linkSaveState === "saving"}
              onClick={handleSaveLinks}
              className={cn(
                "inline-flex items-center gap-2 rounded-none border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
                linkSaveState === "saved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-stone-950 bg-stone-950 text-white hover:bg-stone-800 active:bg-stone-700",
              )}
            >
              {linkSaveState === "saving" ? (
                <><Loader2 className="size-3.5 animate-spin" /> Updating</>
              ) : linkSaveState === "saved" ? (
                <><Check className="size-3.5" /> Updated</>
              ) : (
                "Update"
              )}
            </button>
          </div>
          <div className="h-px bg-stone-200" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={primaryLinkLabel}>
              <Input value={primaryLinkUrl} onChange={(event) => setPrimaryLinkUrl(event.target.value)} placeholder="https://..." className="h-9 rounded-none" />
            </Field>
            <Field label="Instagram URL">
              <Input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="https://www.instagram.com/..." className="h-9 rounded-none" />
            </Field>
          </div>
          {!hasWebsiteLinkIssue ? (
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={bookingLinkMatchesInstagram}
                disabled={!instagramUrl}
                onChange={(event) => toggleUseInstagramAsBooking(event.target.checked)}
                className="size-3.5 rounded-none border-stone-300 accent-stone-950 disabled:opacity-40"
              />
              Use Instagram as booking link
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FreshnessRecommendationTableRow({
  detail,
  row,
  isBusy,
  onApply,
  selectable,
  isSelected,
  onToggleSelected,
}: {
  detail: FreshnessRecommendationDetail;
  row: FreshnessRecommendationGroup;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
  selectable: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
}) {
  const isAdd = detail.kind === "add";
  const isRemove = detail.kind === "remove";
  const isAttribute = detail.kind === "attribute";
  const isPrice = detail.kind === "price";
  const isManualPrice = detail.kind === "manual-price";
  const isAutoAppliedPrice = isPrice && detail.priceAutoApplied === true;
  const [selectedPriceBand, setSelectedPriceBand] = useState<PriceBand | "">(detail.priceBand || "");
  const [manualPriceResult, setManualPriceResult] = useState<ManualPriceParseResult | null>(null);
  const visual = getFreshnessDetailVisual(detail);
  const acceptUpdate = getFreshnessDetailAcceptUpdate(detail, row, selectedPriceBand, manualPriceResult);
  const primaryActionLabel = isAdd ? "Add service" : isRemove ? "Remove" : isAttribute ? getAttributeActionLabel(detail.attributeField) : isPrice || isManualPrice ? "Set band" : detail.kind === "location" ? "Update location" : detail.kind === "fix" ? "Save" : "Resolve";
  const sortedPriceValues = [...(detail.priceValues || [])].sort((left, right) => left - right);
  const showCalculator = (isPrice && !isAutoAppliedPrice) || isManualPrice;
  const showDescription = detail.kind === "fix" || detail.kind === "manual" || detail.kind === "price" || detail.kind === "price-info" || detail.kind === "manual-price";
  const suggestionSubtext = [
    showDescription ? detail.description : "",
    sortedPriceValues.length ? sortedPriceValues.map(formatDetectedPrice).join(", ") : "",
  ].filter(Boolean).join(" · ");

  return (
    <>
      <tr className={cn("border-b border-stone-100 last:border-b-0", isSelected ? "bg-emerald-50/40" : "")}>
        <td className="w-10 px-4 py-4">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelected} disabled={!selectable || isBusy} aria-label={`Select ${detail.label}`} />
        </td>
        <td className="w-28 px-4 py-4">
          <span className={cn("inline-flex items-center rounded-none px-3 py-1 text-xs font-semibold", visual.pillClass)}>
            {visual.label}
          </span>
        </td>
        <td className="min-w-0 px-4 py-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className={cn("truncate font-semibold text-stone-950", suggestionSubtext ? "max-w-[50%] shrink-0" : "min-w-0 flex-1")}>{detail.label}</p>
            {suggestionSubtext ? <p className="min-w-0 flex-1 truncate text-sm font-medium text-stone-500">{suggestionSubtext}</p> : null}
          </div>
        </td>
        <td className="min-w-0 px-4 py-4">
          {detail.evidence?.length ? (
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
              {detail.evidence.slice(0, 3).map((line) => (
                <span key={line} title={line} className="min-w-0 max-w-[220px] shrink truncate rounded-none border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-500">
                  {line}
                </span>
              ))}
              {detail.evidence.length > 3 ? (
                <span title={detail.evidence.slice(3).join(", ")} className="shrink-0 rounded-none border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-500">
                  +{detail.evidence.length - 3}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-sm text-stone-400">—</span>
          )}
        </td>
      </tr>
      {showCalculator ? (() => {
        const linkUrl = detail.manualPriceReason === "social-only"
          ? (row.check.instagramUrl || row.check.bookingUrl)
          : (row.check.bookingUrl || row.check.instagramUrl);
        return (
          <tr className="border-b border-stone-100 last:border-b-0">
            <td colSpan={4} className="bg-stone-50 px-4 py-3">
              <ManualPriceCalculator
                detail={detail}
                selectedPriceBand={selectedPriceBand}
                onSelectedPriceBandChange={setSelectedPriceBand}
                onManualPriceResult={setManualPriceResult}
              />
              <div className="mt-3 flex items-center gap-2">
                {linkUrl ? (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-none border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                  >
                    <ExternalLink className="size-4" />
                    Open link
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={isBusy || !acceptUpdate || !selectedPriceBand}
                  onClick={() => acceptUpdate ? onApply(row.check, acceptUpdate) : undefined}
                  className="inline-flex items-center gap-2 rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Check className="size-4" />
                  {primaryActionLabel}
                </button>
              </div>
            </td>
          </tr>
        );
      })() : null}
    </>
  );
}

function ManualPriceCalculator({
  detail,
  initialText = "",
  selectedPriceBand,
  onSelectedPriceBandChange,
  onManualPriceResult,
}: {
  detail?: FreshnessRecommendationDetail;
  initialText?: string;
  selectedPriceBand: PriceBand | "";
  onSelectedPriceBandChange: (value: PriceBand | "") => void;
  onManualPriceResult: (result: ManualPriceParseResult | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [priceText, setPriceText] = useState(initialText || (detail?.priceEvidence || detail?.evidence || []).join("\n"));
  const [parseResult, setParseResult] = useState<ManualPriceParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [parseMessage, setParseMessage] = useState("");
  const sortedPriceValues = parseResult?.prices?.length ? parseResult.prices : detail?.priceValues || [];
  const priceBandTiers = usePriceBandTiers();
  const priceBandOptions = priceBandOptionsFromTiers(priceBandTiers);

  async function parseText(nextText = priceText) {
    setIsParsing(true);
    setParseMessage("");
    try {
      const response = await fetch("/api/admin/stylists/parse-prices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nextText }),
      });
      const payload = await response.json().catch(() => ({ message: "Could not calculate prices." }));
      if (!response.ok) {
        setParseMessage(payload.message || "Could not calculate prices.");
        return;
      }
      const result: ManualPriceParseResult = {
        priceBand: payload.priceBand || "",
        medianPrice: typeof payload.medianPrice === "number" ? payload.medianPrice : null,
        prices: Array.isArray(payload.prices) ? payload.prices : [],
        priceCount: Number(payload.priceCount) || 0,
        evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
        servicePriceBand: payload.servicePriceBand || "",
        serviceMedianPrice: typeof payload.serviceMedianPrice === "number" ? payload.serviceMedianPrice : null,
        servicePrices: Array.isArray(payload.servicePrices) ? payload.servicePrices : [],
        servicePriceCount: Number(payload.servicePriceCount) || 0,
        packagePriceBand: payload.packagePriceBand || "",
        packageMedianPrice: typeof payload.packageMedianPrice === "number" ? payload.packageMedianPrice : null,
        packagePrices: Array.isArray(payload.packagePrices) ? payload.packagePrices : [],
        packagePriceCount: Number(payload.packagePriceCount) || 0,
        priceIncludesHair: payload.priceIncludesHair === true,
        priceComparisonMode: payload.priceComparisonMode || "",
        ignoredPrices: Array.isArray(payload.ignoredPrices) ? payload.ignoredPrices : [],
      };
      setParseResult(result);
      onManualPriceResult(result);
      if (result.priceBand) {
        onSelectedPriceBandChange(result.priceBand);
      }
      setParseMessage(result.priceBand ? `Suggested ${result.priceBand} from comparable median ${formatDetectedPrice(result.serviceMedianPrice ?? result.medianPrice ?? 0)}.` : "No usable service prices found.");
    } finally {
      setIsParsing(false);
    }
  }

  async function runOcr(file: File) {
    if (!file.type.startsWith("image/")) {
      setParseMessage("Upload an image file.");
      return;
    }
    setIsOcrRunning(true);
    setParseMessage("");
    try {
      const tesseract = await import("tesseract.js");
      const result = await tesseract.recognize(file, "eng");
      const extractedText = result.data.text.trim();
      setPriceText(extractedText);
      await parseText(extractedText);
      setParseMessage(extractedText ? "OCR text extracted. Review it before saving." : "OCR did not find readable text.");
    } catch {
      setParseMessage("Could not read that image. Try pasting the price list text instead.");
    } finally {
      setIsOcrRunning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      void runOcr(imageFile);
    }
  }

  return (
    <div className="mt-4 grid gap-3 rounded-none border border-stone-200 bg-white p-3" onPaste={handlePaste}>
      <Field label="Paste price list">
        <Textarea
          value={priceText}
          onChange={(value) => {
            setPriceText(value);
            setParseResult(null);
            onManualPriceResult(null);
          }}
          placeholder="Paste services and prices, or paste/upload a price-list image."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={isParsing || isOcrRunning || !priceText.trim()} onClick={() => parseText()} className="h-9 rounded-none bg-white px-3 text-sm">
          {isParsing ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
          Calculate median
        </Button>
        <Button type="button" variant="outline" disabled={isOcrRunning} onClick={() => fileInputRef.current?.click()} className="h-9 rounded-none bg-white px-3 text-sm">
          {isOcrRunning ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Upload image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void runOcr(file);
            }
          }}
        />
        <div className="min-w-48">
          <Select value={selectedPriceBand} onChange={(value) => onSelectedPriceBandChange(value as PriceBand | "")}>
            {priceBandOptions.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {sortedPriceValues.length ? (
        <p className="text-sm font-semibold text-stone-700">
          {sortedPriceValues.slice().sort((left, right) => left - right).map(formatDetectedPrice).join(", ")}
        </p>
      ) : null}
      {parseResult?.medianPrice != null ? (
        <p className="text-sm text-stone-500">Median: <span className="font-semibold text-stone-950">{formatDetectedPrice(parseResult.medianPrice)}</span></p>
      ) : null}
      {parseResult?.serviceMedianPrice != null || parseResult?.packageMedianPrice != null ? (
        <div className="grid gap-1 text-sm text-stone-500">
          {parseResult.serviceMedianPrice != null ? (
            <p>Service-only median: <span className="font-semibold text-stone-950">{formatDetectedPrice(parseResult.serviceMedianPrice)}</span>{parseResult.servicePriceBand ? ` (${parseResult.servicePriceBand})` : ""}</p>
          ) : null}
          {parseResult.packageMedianPrice != null ? (
            <p>Hair-included package median: <span className="font-semibold text-stone-950">{formatDetectedPrice(parseResult.packageMedianPrice)}</span>{parseResult.packagePriceBand ? ` (${parseResult.packagePriceBand})` : ""}</p>
          ) : null}
        </div>
      ) : null}
      {parseMessage ? <p className="text-sm text-stone-500">{parseMessage}</p> : null}
    </div>
  );
}

function getFreshnessDetailAcceptUpdate(detail: FreshnessRecommendationDetail, row: FreshnessRecommendationGroup, selectedPriceBand?: PriceBand | "", manualPriceResult?: ManualPriceParseResult | null): FreshnessUpdate | FreshnessRecommendationGroup["acceptUpdate"] {
  if (detail.kind === "add" && detail.service) {
    return { addServices: [detail.service] };
  }
  if (detail.kind === "remove" && detail.service) {
    return { removeServices: [detail.service] };
  }
  if (detail.kind === "attribute" && detail.attributeField) {
    return getAttributeAcceptUpdate(detail.attributeField);
  }
  if ((detail.kind === "price" || detail.kind === "manual-price") && (selectedPriceBand || detail.priceBand)) {
    return {
      priceBand: selectedPriceBand || detail.priceBand,
      servicePriceBand: manualPriceResult?.servicePriceBand || detail.servicePriceBand || selectedPriceBand || detail.priceBand,
      packagePriceBand: manualPriceResult?.packagePriceBand || detail.packagePriceBand || "",
      priceIncludesHair: manualPriceResult?.priceIncludesHair === true || detail.priceIncludesHair === true,
      priceComparisonMode: manualPriceResult?.priceComparisonMode || detail.priceComparisonMode || (manualPriceResult?.packagePriceBand || detail.packagePriceBand ? "mixed" : "service-only"),
      priceSource: "manual" as const,
      priceEvidence: manualPriceResult?.evidence?.length ? manualPriceResult.evidence : detail.priceEvidence || detail.evidence || [],
      priceCheckedAt: row.check.checkedAt,
      priceConfidence: manualPriceResult ? "manual" : detail.priceConfidence || "manual",
    };
  }
  if (detail.kind === "location" && row.check.serviceCheck.areaId) {
    return {
      areaId: row.check.serviceCheck.areaId,
      areaIds: [row.check.serviceCheck.areaId],
      areaLabel: row.check.serviceCheck.areaLabel || areaLabelFromId(row.check.serviceCheck.areaId),
    };
  }
  return row.acceptUpdate;
}

function isDetailBulkSelectable(detail: FreshnessRecommendationDetail, row: FreshnessRecommendationGroup) {
  if (detail.kind === "manual" || detail.kind === "fix" || detail.kind === "price" || detail.kind === "manual-price" || detail.kind === "price-info") {
    return false;
  }
  return Boolean(getFreshnessDetailAcceptUpdate(detail, row));
}

function mergeFreshnessAcceptUpdates(details: FreshnessRecommendationDetail[], row: FreshnessRecommendationGroup): FreshnessUpdate | undefined {
  const merged: FreshnessUpdate = {};
  for (const detail of details) {
    const update = getFreshnessDetailAcceptUpdate(detail, row);
    if (!update) {
      continue;
    }
    if (update.addServices?.length) {
      merged.addServices = [...(merged.addServices || []), ...update.addServices];
    }
    if (update.removeServices?.length) {
      merged.removeServices = [...(merged.removeServices || []), ...update.removeServices];
    }
    if (update.hijabiFriendly) {
      merged.hijabiFriendly = true;
    }
    if (update.wheelchairAccessible) {
      merged.wheelchairAccessible = true;
    }
    if (update.senFriendly) {
      merged.senFriendly = true;
    }
    if (update.lgbtqFriendly) {
      merged.lgbtqFriendly = true;
    }
    if (update.parkingAvailable) {
      merged.parkingAvailable = true;
    }
    if (update.areaId) {
      merged.areaId = update.areaId;
      merged.areaIds = update.areaIds;
      merged.areaLabel = update.areaLabel;
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}

function getFreshnessDetailRejectUpdate(detail: FreshnessRecommendationDetail, row: FreshnessRecommendationGroup): FreshnessUpdate | undefined {
  if (detail.kind === "add" && detail.service) {
    return { rejectAddedServices: [detail.service] };
  }
  if (detail.kind === "remove" && detail.service) {
    return { rejectRemovedServices: [detail.service] };
  }
  if (detail.kind === "attribute" && detail.attributeField) {
    return getAttributeRejectUpdate(detail.attributeField);
  }
  if (detail.kind === "price" || detail.kind === "manual-price") {
    return { rejectPriceBand: true };
  }
  if (detail.kind === "location") {
    return { rejectLocation: true };
  }
  return row.rejectUpdate;
}

function mergeFreshnessRejectUpdates(details: FreshnessRecommendationDetail[], row: FreshnessRecommendationGroup): FreshnessUpdate | undefined {
  const merged: FreshnessUpdate = {};
  for (const detail of details) {
    const update = getFreshnessDetailRejectUpdate(detail, row);
    if (!update) {
      continue;
    }
    if (update.rejectAddedServices?.length) {
      merged.rejectAddedServices = [...(merged.rejectAddedServices || []), ...update.rejectAddedServices];
    }
    if (update.rejectRemovedServices?.length) {
      merged.rejectRemovedServices = [...(merged.rejectRemovedServices || []), ...update.rejectRemovedServices];
    }
    if (update.rejectHijabiFriendly) {
      merged.rejectHijabiFriendly = true;
    }
    if (update.rejectWheelchairAccessible) {
      merged.rejectWheelchairAccessible = true;
    }
    if (update.rejectSenFriendly) {
      merged.rejectSenFriendly = true;
    }
    if (update.rejectLgbtqFriendly) {
      merged.rejectLgbtqFriendly = true;
    }
    if (update.rejectParkingAvailable) {
      merged.rejectParkingAvailable = true;
    }
    if (update.rejectLocation) {
      merged.rejectLocation = true;
    }
    if (update.rejectPriceBand) {
      merged.rejectPriceBand = true;
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}

const attributeFieldConfig: Record<AttributeSuggestion["field"], { acceptUpdate: FreshnessUpdate; rejectUpdate: FreshnessUpdate; actionLabel: string }> = {
  hijabiFriendly: { acceptUpdate: { hijabiFriendly: true }, rejectUpdate: { rejectHijabiFriendly: true }, actionLabel: "Mark hijabi-friendly" },
  wheelchairAccessible: { acceptUpdate: { wheelchairAccessible: true }, rejectUpdate: { rejectWheelchairAccessible: true }, actionLabel: "Mark wheelchair accessible entrance" },
  senFriendly: { acceptUpdate: { senFriendly: true }, rejectUpdate: { rejectSenFriendly: true }, actionLabel: "Mark sensory-safe / SEN-friendly" },
  lgbtqFriendly: { acceptUpdate: { lgbtqFriendly: true }, rejectUpdate: { rejectLgbtqFriendly: true }, actionLabel: "Mark LGBTQIA+-friendly" },
  parkingAvailable: { acceptUpdate: { parkingAvailable: true }, rejectUpdate: { rejectParkingAvailable: true }, actionLabel: "Mark parking nearby" },
};

function getAttributeAcceptUpdate(field: AttributeSuggestion["field"]): FreshnessUpdate {
  return attributeFieldConfig[field]?.acceptUpdate ?? {};
}

function getAttributeRejectUpdate(field: AttributeSuggestion["field"]): FreshnessUpdate {
  return attributeFieldConfig[field]?.rejectUpdate ?? {};
}

function getAttributeActionLabel(field?: AttributeSuggestion["field"]) {
  return field ? attributeFieldConfig[field]?.actionLabel ?? "" : "";
}

function formatDetectedPrice(value: number) {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

function summarizeBackfillChecks(checks: DirectoryCheck[]) {
  return checks.reduce(
    (summary, check) => ({
      autoApplied: summary.autoApplied + (check.backfillStatus === "auto-applied" ? 1 : 0),
      needsReview: summary.needsReview + (check.backfillStatus === "needs-review" ? 1 : 0),
      noPrice: summary.noPrice + (check.backfillStatus === "no-price" && !hasSavedPriceBand(check) ? 1 : 0),
      skippedSocial: summary.skippedSocial + (check.backfillStatus === "skipped-social" && !hasSavedPriceBand(check) ? 1 : 0),
    }),
    { autoApplied: 0, needsReview: 0, noPrice: 0, skippedSocial: 0 },
  );
}

function hasSavedPriceBand(check?: Pick<DirectoryCheck, "priceBand"> | null) {
  return Boolean(check?.priceBand);
}

type FreshnessRecommendationGroup = {
  id: string;
  check: DirectoryCheck;
  stylist: string;
  recommendation: string;
  typeTone: "critical" | "warning" | "info" | "neutral";
  details: FreshnessRecommendationDetail[];
  detected: string;
  status: "Open" | "Resolved";
  bookingUrl?: string;
  instagramUrl?: string;
  acceptUpdate?: {
    addServices?: string[];
    removeServices?: string[];
    hijabiFriendly?: boolean;
    wheelchairAccessible?: boolean;
    priceBand?: PriceBand;
    servicePriceBand?: PriceBand;
    packagePriceBand?: PriceBand;
    priceIncludesHair?: boolean;
    priceComparisonMode?: PriceComparisonMode | "";
    priceSource?: "auto" | "manual";
    priceEvidence?: string[];
    priceCheckedAt?: string;
    priceConfidence?: "high" | "medium" | "low" | "manual";
  };
  rejectUpdate?: FreshnessUpdate;
};

type FreshnessRecommendationDetail = {
  kind: "add" | "remove" | "fix" | "manual" | "attribute" | "price" | "price-info" | "location" | "manual-price";
  label: string;
  description: string;
  service?: string;
  attributeField?: AttributeSuggestion["field"];
  priceBand?: PriceBand;
  servicePriceBand?: PriceBand;
  packagePriceBand?: PriceBand;
  priceIncludesHair?: boolean;
  priceComparisonMode?: PriceComparisonMode | "";
  priceEvidence?: string[];
  priceValues?: number[];
  priceConfidence?: "high" | "medium" | "low" | "manual";
  priceAutoApplied?: boolean;
  evidence?: string[];
  evidenceLabel?: string;
  manualPriceReason?: "social-only" | "no-price";
};

function getFreshnessDetailVisual(detail: FreshnessRecommendationDetail) {
  if (detail.kind === "add") {
    return { label: "Add", dotClass: "bg-emerald-500", textClass: "text-emerald-700", pillClass: "bg-emerald-100 text-emerald-700" };
  }
  if (detail.kind === "fix") {
    return { label: "Fix", dotClass: "bg-red-500", textClass: "text-red-700", pillClass: "bg-red-100 text-red-700" };
  }
  if (detail.kind === "remove") {
    return { label: "Remove", dotClass: "bg-red-500", textClass: "text-red-700", pillClass: "bg-red-100 text-red-700" };
  }
  if (detail.kind === "manual") {
    return { label: "Verify", dotClass: "bg-amber-500", textClass: "text-amber-700", pillClass: "bg-amber-100 text-amber-700" };
  }
  if (detail.kind === "attribute") {
    return { label: "Mark", dotClass: "bg-emerald-500", textClass: "text-emerald-700", pillClass: "bg-emerald-100 text-emerald-700" };
  }
  if (detail.kind === "price") {
    return { label: "Price", dotClass: "bg-sky-500", textClass: "text-sky-700", pillClass: "bg-sky-100 text-sky-700" };
  }
  if (detail.kind === "price-info") {
    return { label: "Price", dotClass: "bg-stone-400", textClass: "text-stone-600", pillClass: "bg-stone-100 text-stone-600" };
  }
  if (detail.kind === "location") {
    return { label: "Location", dotClass: "bg-violet-500", textClass: "text-violet-700", pillClass: "bg-violet-100 text-violet-700" };
  }
  if (detail.kind === "manual-price") {
    return { label: "Price", dotClass: "bg-amber-500", textClass: "text-amber-700", pillClass: "bg-amber-100 text-amber-700" };
  }
  return { label: "Review", dotClass: "bg-sky-500", textClass: "text-sky-700", pillClass: "bg-sky-100 text-sky-700" };
}

function getFreshnessDetailCounts(details: FreshnessRecommendationDetail[]) {
  return details.reduce(
    (summary, detail) => ({
      ...summary,
      [detail.kind]: summary[detail.kind] + 1,
    }),
    { add: 0, remove: 0, fix: 0, manual: 0, attribute: 0, price: 0, "price-info": 0, location: 0, "manual-price": 0 } as Record<FreshnessRecommendationDetail["kind"], number>,
  );
}

function getFreshnessDetailSummaryParts(details: FreshnessRecommendationDetail[]) {
  const counts = getFreshnessDetailCounts(details);
  return [
    { count: counts.add, label: "add", className: "bg-emerald-100 text-emerald-700" },
    { count: counts.remove, label: "remove", className: "bg-red-100 text-red-700" },
    { count: counts.fix, label: "link fix", className: "bg-red-100 text-red-700" },
    { count: counts.manual, label: "verify", className: "bg-amber-100 text-amber-700" },
    { count: counts.attribute, label: "profile", className: "bg-emerald-100 text-emerald-700" },
    { count: counts.price, label: "price", className: "bg-sky-100 text-sky-700" },
    { count: counts["price-info"], label: "price check", className: "bg-stone-100 text-stone-600" },
    { count: counts.location, label: "location", className: "bg-violet-100 text-violet-700" },
    { count: counts["manual-price"], label: "price", className: "bg-amber-100 text-amber-700" },
  ].filter((part) => part.count);
}

function summarizeFreshnessDetailsAsText(details: FreshnessRecommendationDetail[]) {
  return getFreshnessDetailSummaryParts(details)
    .map((part) => `${part.count} ${part.label}`)
    .join(" · ");
}

function FreshnessDetailSummary({ details }: { details: FreshnessRecommendationDetail[] }) {
  const parts = getFreshnessDetailSummaryParts(details);

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm text-stone-500">
      {parts.length
        ? parts.map((part) => (
            <span key={part.label} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex size-5 items-center justify-center rounded-none text-[11px] font-semibold tabular-nums ${part.className}`}>{part.count}</span>
              <span>{part.label}</span>
            </span>
          ))
        : null}
    </span>
  );
}

function buildFreshnessRecommendationGroups(checks: DirectoryCheck[]): FreshnessRecommendationGroup[] {
  return checks.flatMap((check) => {
    const detected = check.checkedAt ? formatRelativeTime(check.checkedAt) : "Just now";
    const brokenLinks = check.linkChecks.filter(isActionableBrokenLink);
    const manualLinks = check.linkChecks.filter(isManualCheckLink);
    const addedServices = getActionableAddedServices(check);
    const removedServices = getActionableRemovedServices(check);
    const attributeSuggestions = check.attributeSuggestions || [];
    const priceCheck = check.priceCheck;
    const hasLocationRecommendation = hasDetectedLocationUpdate(check);
    const hasPriceRecommendation = Boolean(priceCheck?.priceBand && priceCheck.confidence !== "high" && check.issues.some((issue) => issue.toLowerCase() === "possible pricing band found"));
    const details: FreshnessRecommendationDetail[] = [
      ...brokenLinks.map((linkCheck) => ({
        kind: "fix" as const,
        label: `${titleCase(linkCheck.type)} link`,
        description: linkCheck.issues[0] || "Link not loading",
      })),
      ...manualLinks.map((linkCheck) => ({
        kind: "manual" as const,
        label: `${titleCase(linkCheck.type)} link`,
        description: getManualCheckDescription(linkCheck),
      })),
      ...removedServices.map((service) => {
        const possibleEvidence = getRemovalReviewEvidence(check.serviceCheck.rawServices, service);
        return {
          kind: "remove" as const,
          label: service,
          description: possibleEvidence.length ? "Possible evidence it still exists" : "Service no longer listed",
          service,
          evidence: possibleEvidence,
          evidenceLabel: possibleEvidence.length ? "Evidence it still exists" : undefined,
        };
      }),
      ...addedServices.map((service) => ({
        kind: "add" as const,
        label: service,
        description: "New service detected",
        service,
        evidence: getServiceEvidence(check.serviceCheck.rawServices, service),
      })),
      ...attributeSuggestions.map((suggestion) => ({
        kind: "attribute" as const,
        label: getAttributeActionLabel(suggestion.field),
        description: `Explicit ${suggestion.label.toLowerCase()} wording found`,
        attributeField: suggestion.field,
        evidence: suggestion.evidence.map((item) => `${titleCase(item.source)}: ${item.text}`),
      })),
      ...(hasPriceRecommendation && priceCheck?.priceBand ? [{
        kind: "price" as const,
        label: `Set ${priceCheck.priceBand}`,
        description: `${titleCase(priceCheck.confidence)} confidence from ${priceCheck.priceCount} price${priceCheck.priceCount === 1 ? "" : "s"}`,
        priceBand: priceCheck.priceBand,
        servicePriceBand: priceCheck.servicePriceBand || priceCheck.priceBand,
        packagePriceBand: priceCheck.packagePriceBand || "",
        priceIncludesHair: priceCheck.priceIncludesHair === true,
        priceComparisonMode: priceCheck.priceComparisonMode || (priceCheck.packagePriceBand ? "mixed" : "service-only"),
        priceEvidence: priceCheck.evidence || [],
        priceValues: priceCheck.prices || [],
        priceConfidence: priceCheck.confidence === "unknown" ? "low" as const : priceCheck.confidence,
        evidence: priceCheck.evidence || [],
      }] : []),
      ...(hasLocationRecommendation ? [{
        kind: "location" as const,
        label: "Review location",
        description: `Booking data suggests ${check.serviceCheck.areaLabel}`,
        evidence: [
          `Saved: ${check.areaLabel || "Location unknown"}`,
          `Detected: ${check.serviceCheck.areaLabel}`,
        ],
      }] : []),
      ...(!hasSavedPriceBand(check) && (check.backfillStatus === "no-price" || check.backfillStatus === "skipped-social") ? [{
        kind: "manual-price" as const,
        label: "Set price manually",
        description: check.backfillStatus === "skipped-social"
          ? "Instagram / social-only — no booking page to scan"
          : "Booking page found but no pricing detected",
        manualPriceReason: (check.backfillStatus === "skipped-social" ? "social-only" : "no-price") as "social-only" | "no-price",
      }] : []),
    ];

    if (!details.length) {
      return [];
    }

    const hasServiceRecommendations = addedServices.length > 0 || removedServices.length > 0;
    const recommendedAttributeFields = [...new Set(attributeSuggestions.map((suggestion) => suggestion.field))];
    const hasAttributeRecommendations = recommendedAttributeFields.length > 0;
    const attributeAcceptUpdate = recommendedAttributeFields.reduce((acc, field) => ({ ...acc, ...getAttributeAcceptUpdate(field) }), {});
    const attributeRejectUpdate = recommendedAttributeFields.reduce((acc, field) => ({ ...acc, ...getAttributeRejectUpdate(field) }), {});
    const linkDismissUpdate = getLinkDismissUpdate(check);
    const acceptUpdate = hasServiceRecommendations || hasAttributeRecommendations || hasPriceRecommendation
      ? {
          ...(addedServices.length ? { addServices: addedServices } : {}),
          ...(removedServices.length ? { removeServices: removedServices } : {}),
          ...attributeAcceptUpdate,
          ...(hasPriceRecommendation && priceCheck?.priceBand ? {
            priceBand: priceCheck.priceBand,
            servicePriceBand: priceCheck.servicePriceBand || priceCheck.priceBand,
            packagePriceBand: priceCheck.packagePriceBand || "",
            priceIncludesHair: priceCheck.priceIncludesHair === true,
            priceComparisonMode: priceCheck.priceComparisonMode || (priceCheck.packagePriceBand ? "mixed" : "service-only"),
            priceSource: "auto" as const,
            priceEvidence: priceCheck.evidence || [],
            priceCheckedAt: check.checkedAt,
            priceConfidence: priceCheck.confidence === "unknown" ? "low" as const : priceCheck.confidence,
          } : {}),
        }
      : undefined;
    const rejectUpdate = hasServiceRecommendations || hasAttributeRecommendations || linkDismissUpdate || hasPriceRecommendation
      ? {
          ...(addedServices.length ? { rejectAddedServices: addedServices } : {}),
          ...(removedServices.length ? { rejectRemovedServices: removedServices } : {}),
          ...attributeRejectUpdate,
          ...(hasPriceRecommendation ? { rejectPriceBand: true } : {}),
          ...linkDismissUpdate,
        }
      : undefined;

    return [{
      check,
      stylist: check.name,
      detected,
      status: "Open" as const,
      bookingUrl: check.bookingUrl,
      instagramUrl: check.instagramUrl,
      id: `${check.id}-recommendations`,
      recommendation: getFreshnessGroupRecommendation(check, brokenLinks.length, manualLinks.length, addedServices, removedServices, attributeSuggestions, hasLocationRecommendation),
      typeTone: brokenLinks.length ? "critical" : manualLinks.length ? "warning" : addedServices.length ? "info" : "neutral",
      details,
      acceptUpdate,
      rejectUpdate,
    }];
  }).sort(compareFreshnessRecommendationGroups);
}

function compareFreshnessRecommendationGroups(left: FreshnessRecommendationGroup, right: FreshnessRecommendationGroup) {
  return freshnessGroupSeverity(right) - freshnessGroupSeverity(left) || left.stylist.localeCompare(right.stylist);
}

function filterFreshnessRowsByDetail(rows: FreshnessRecommendationGroup[], predicate: (detail: FreshnessRecommendationDetail, row: FreshnessRecommendationGroup) => boolean) {
  return rows
    .map((row) => ({
      ...row,
      details: row.details.filter((detail) => predicate(detail, row)),
    }))
    .filter((row) => row.details.length > 0);
}

function freshnessGroupSeverity(row: FreshnessRecommendationGroup) {
  if (row.details.some((detail) => detail.kind === "fix")) {
    return 4;
  }
  if (row.details.some((detail) => detail.kind === "manual")) {
    return 3;
  }
  if (row.details.some((detail) => detail.kind === "remove" || detail.kind === "add")) {
    return 2;
  }
  if (row.details.some((detail) => detail.kind === "attribute")) {
    return 2;
  }
  return 1;
}

function isActionableBrokenLink(linkCheck: DirectoryCheck["linkChecks"][number]) {
  return linkCheck.status === "broken" && (linkCheck.httpStatus === 404 || linkCheck.httpStatus === 410);
}

function getActionableAddedServices(check: DirectoryCheck) {
  return check.addedServices.filter((service) => hasSupportedFreshnessEvidence(check, service) && getServiceEvidence(check.serviceCheck.rawServices, service).length > 0);
}

function getActionableRemovedServices(check: DirectoryCheck) {
  return check.removedServices.filter((service) => !hasSupportedFreshnessEvidence(check, service));
}

function hasSupportedFreshnessEvidence(check: DirectoryCheck, service: string) {
  if (service === "U-part wig install") {
    return check.serviceCheck.rawServices.some((line) => hasExplicitUPartWigEvidence(line));
  }
  if (service === "Closure sew-in") {
    return check.serviceCheck.rawServices.some((line) => hasClosureSewInEvidence(line));
  }
  if (service === "Pixie wig / weave install") {
    return check.serviceCheck.rawServices.some((line) => hasPixieInstallEvidence(line));
  }
  if (service === "Wig install (frontal / closure)") {
    return hasWigInstallEvidence(check.serviceCheck.rawServices);
  }
  if (service === "Custom wig") {
    return hasCustomWigEvidence(check.serviceCheck.rawServices);
  }
  if (service === "Pixie cut / finger waves") {
    return hasRawEvidenceForService(check.serviceCheck.rawServices, service);
  }
  if (service === "Feed-in braids") {
    return !check.serviceCheck.rawServices.some((line) => hasHalfBraidsHalfSewInEvidence(line));
  }
  if (service === "Sleek ponytail / bun") {
    return !check.serviceCheck.rawServices.some((line) => hasFrontalPonytailEvidence(line) || hasBraidedPonytailEvidence(line));
  }
  if (service === "Natural hair coaches / educators") {
    return check.serviceCheck.rawServices.some((line) => hasNaturalHairEducationEvidence(line));
  }
  if (service === "Keratin treatment") {
    return !check.serviceCheck.rawServices.some((line) => hasKeratinTipEvidence(line));
  }
  if (service === "Starter locs") {
    return check.serviceCheck.rawServices.some((line) => hasStarterLocsEvidence(line));
  }
  if (service === "Twists (with extensions)") {
    return check.serviceCheck.rawServices.some((line) => hasTwistsWithExtensionsEvidence(line));
  }
  if (service === "Tracks (+ silk press) / partial / invisible sew-in") {
    return check.serviceCheck.rawServices.some((line) => hasTracksEvidence(line));
  }
  if (service === "Wash & blowdry") {
    return check.serviceCheck.rawServices.some((line) => hasWashBlowdryEvidence(line));
  }
  if (service === "Bouncy blowout / round brush blow dry") {
    return check.serviceCheck.rawServices.some((line) => hasBouncyBlowoutEvidence(line));
  }
  if (service === "Wig cornrows") {
    return check.serviceCheck.rawServices.some((line, index, lines) => hasWigCornrowsEvidence(line, lines, index));
  }
  if (service === "Stitch braids") {
    return check.serviceCheck.rawServices.some((line) => hasStitchBraidsEvidence(line));
  }
  if (service === "Butterfly locs" || service === "Faux locs") {
    return check.serviceCheck.rawServices.some((line) => hasSpecificLocSubtypeEvidence(line, service));
  }
  if (service === "Full head colour" || service === "Balayage" || service === "Highlights") {
    return !hasWigColourEvidence(check.serviceCheck.rawServices);
  }

  return true;
}

function hasRawEvidenceForService(rawServices: string[], service: string) {
  const normalizedRaw = normalizeEvidenceText(rawServices.join(" "));

  if (service === "Pixie wig / weave install") {
    return rawServices.some((line) => hasPixieInstallEvidence(line));
  }
  if (service === "Pixie cut / finger waves") {
    return /\b(finger\s+waves?|pixie\s+cut|short\s+pixie|wrap)\b/.test(normalizedRaw) && !hasRawEvidenceForService(rawServices, "Pixie wig / weave install");
  }
  if (service === "Wig colouring / bundle colouring") {
    return hasWigColourEvidence(rawServices);
  }
  if (service === "Olaplex treatment") {
    return /\bolaplex\b|\b(repair|bond)\b.*\b(bond|repair|treatment)\b/.test(normalizedRaw);
  }
  if (service === "Moisturising treatment") {
    return /\bmoisturi[sz](ing|e)\b|\bmoisture\b|\bhydrat(e|ing|ion)\b|\bprotein\s*&?\s+moisture\b|\bdeep\s+condition(ing)?\b|\bsteam\s+treat(ment)?\b/.test(normalizedRaw);
  }
  if (service === "Half up half down") {
    return /\bhalf\s+up\b.*\bhalf\s+down\b|\bhalf\s+up\s*,?\s*half\s+down\b/.test(normalizedRaw);
  }

  return false;
}

function hasExplicitUPartWigEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b.*\b(wig|install|installation)\b|\b(wig|install|installation)\b.*\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b/.test(normalized);
}

function hasClosureSewInEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bclosure\b.*\b(sew\s*in|sewin|weave)\b|\b(sew\s*in|sewin|weave)\b.*\bclosure\b|\bweave\b.*\b(lace\s+)?closure\b|\bclosure\b.*\bbehind\s+the\s+hairline\b/.test(normalized);
}

function hasPixieInstallEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bpixie\b/.test(normalized) && /\b(wig|weave|sew\s*in|sewin|install|installation)\b/.test(normalized);
}

function hasWigInstallEvidence(value: string | string[]) {
  const normalized = normalizeEvidenceText(Array.isArray(value) ? value.join(" ") : value);
  return /\bwig\b.*\b(install|installation|instal|application|fit|fitting)\b|\b(glueless|lace|frontal|closure)\s+wig\b|\b(lace\s+)?frontal\s+installation\b|\b(lace\s+)?closure\s+installation\b|\b(frontal|closure|ready[\s-]*made)\s+unit\b|\bunit\b.*\b(install|installation|instal|application|fit|fitting)\b/.test(normalized);
}

function hasCustomWigEvidence(value: string | string[]) {
  const normalized = normalizeEvidenceText(Array.isArray(value) ? value.join(" ") : value);
  return /\bcustom\b.*\bwig\b|\bbespoke\b.*\bwig\b|\bcustom\s+handmade\s+wigs?\b|\bwig\b.*\b(custom|bespoke|handmade|made|making|construction|unit)\b|\bunit\b.*\bcustomi[sz](ing|ation)\b|\bcustomi[sz](ing|ation)\b.*\bunit\b|\bcustomi[sz]ed\s+closure\s+unit\b|\bcustom\s+mini\s+frontal\s+unit\b|\bcustom(?:\s+made)?\b.*\b(frontal|closure)\s+unit\b|\bcustom\b.*\bfrontal\s+closure\s+units?\b|\bwig\s+(making|construction|customi[sz](ing|ation))\b|\bconstruction\s+of\s+(the\s+)?wig\b|\bconstruction\b.*\bcustomi[sz](ing|ation)\b|\bcustomi[sz](ing|ation)\b.*\bconstruction\b|\b(frontal|closure)\b.*\bcustomi[sz](ing|ation)\b/.test(normalized) && !/\b(factory\s+made|pre\s*made|premade|ready\s*made|raw\s+pre\s*made)\b/.test(normalized);
}

function hasHalfBraidsHalfSewInEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bhalf\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b.*\b(weave|sew[\s-]*in|sewin)\b/.test(normalized) || /\bhalf\b.*\b(weave|sew[\s-]*in|sewin)\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b/.test(normalized);
}

function hasFrontalPonytailEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bfrontal\b.*\b(pony|ponytail|bun|updo|up\s*do)\b/.test(normalized) || /\b(pony|ponytail|bun|updo|up\s*do)\b.*\bfrontal\b/.test(normalized);
}

function hasNaturalHairEducationEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(afro|natural|curly|curl|hair)\b.*\beducation\b|\beducation\b.*\b(afro|natural|curly|curl|hair)\b|\b(hair|curl|styling)\b.*\btutorial\b|\btutorial\b.*\b(hair|curl|styling)\b|\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b|\bgrowth\s+plan\b|\bconsultation\b.*\bnatural\b|\bnatural\s+hair\b.*\b(class|education|consultation)\b|\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/.test(normalized);
}

function hasBraidedPonytailEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b.*\b(pony|ponytail)\b/.test(normalized) || /\b(pony|ponytail)\b.*\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b/.test(normalized);
}

function hasTwistsWithExtensionsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\btwists?\b.*\b(extension|extensions|hair added)\b|\b(extension|extensions|hair added)\b.*\btwists?\b|\b(passion|marley|senegalese|island|kinky|rope)\s+twists?\b/.test(normalized);
}

function hasTracksEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  if (/\btracks?\b.*\btapes?\b.*\bhybrid\b|\bhybrid\b.*\btracks?\b.*\btapes?\b/.test(normalized)) {
    return false;
  }
  return /\btracks?\b|\bindividual\s+sewn\s+on\s+tracks?\b|\bpartial\b.*\b(sew\s*in|sewin|weave)\b|\binvisible\b.*\b(sew\s*in|sewin|weave|wefts?)\b|\b(row|rows|line)\s+(?:of\s+)?(sew\s*in|sewin|weave)\b|\b(sew\s*in|sewin|weave)\s+(row|rows|line)\b|\bweave\s+on\s+per\s+row\b|\bweave\s+tracks?\s*\(?per\s+track\)?\b|\bper\s+(track|row|line)\b|\btrack\s+per\s+row\b|\btracks?\s+per\s+(track|row|line|double\s+row)\b|\btraditional\s+weave\s+rows?\b|\bone\s+row\b/.test(normalized);
}

function hasKeratinTipEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bkeratin\s+(tips?|bonds?|extensions?)\b/.test(normalized);
}

function hasWashBlowdryEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  if (/\b(arrive|come|please|note|recommended)\b.*\b(freshly\s+washed|clean|product\s+free|product-free)\b/.test(normalized) && !/\bblow\s*dry|blowdry|blowout\b/.test(normalized)) {
    return false;
  }
  return /\bwash\b.*\b(blow\s*dry|blowdry|blowout)\b|\bshampoo\b.*\b(blow\s*dry|blowdry|blowout)\b/.test(normalized);
}

function hasBouncyBlowoutEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bbouncy\b.*\b(blow\s*dry|blowdry|blow\s*out|blowout)\b|\b(blow\s*dry|blowdry|blow\s*out|blowout)\b.*\bbouncy\b|\bround\s+brush\b.*\b(blow\s*dry|blowdry)\b/.test(normalized);
}

function hasWigCornrowsEvidence(value: string, lines: string[] = [value], index = 0) {
  const normalized = normalizeEvidenceText(value);
  const nearby = normalizeEvidenceText([lines[index - 1], value, lines[index + 1]].filter(Boolean).join(" "));
  if (hasStyleRemovalInstructionEvidence(nearby)) {
    return false;
  }
  return /\bunder\s*wig\b|\bwig\s+cornrows?\b|\bcornrows?\s+for\s+wig\s+installation\b|\bcornrows?\b/.test(normalized);
}

function hasStyleRemovalInstructionEvidence(value: string) {
  return /\b(please\s+)?ensure\b.*\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(value) || /\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(value);
}

function hasStitchBraidsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bstitch\b/.test(normalized);
}

function hasSpecificLocSubtypeEvidence(value: string, service: string) {
  const normalized = normalizeEvidenceText(value);
  if (service === "Butterfly locs") {
    return /\bbutterfly\s+locs?\b/.test(normalized);
  }
  if (service === "Faux locs") {
    return /\bfaux\s+locs?\b|\binvisible\s+locs?\b|\bsoft\s+locs?\b/.test(normalized);
  }
  return false;
}

function hasStarterLocsEvidence(value: string) {
  const normalized = normalizeEvidenceText(value);
  return /\bstarter\s+locs?\b|\bstart\s+locs?\b|\bloc\s+start\b/.test(normalized);
}

function hasWigColourEvidence(rawServices: string[]) {
  const normalizedRaw = normalizeEvidenceText(rawServices.join(" "));
  const hasColourSignal = /\b(colou?r|colou?ring|dye|custom colour|custom color|highlight|tone|toning|tint|bleach|bright)\b/.test(normalizedRaw);
  const hasWigColourContext = /\b(wig|extensions?|bundle|bundles|lace\s+system|closure|frontal|wefts?|613|non[\s-]*contact)\b/.test(normalizedRaw);

  return hasColourSignal && hasWigColourContext;
}

function isManualCheckLink(linkCheck: DirectoryCheck["linkChecks"][number]) {
  if (linkCheck.status === "ok" || isActionableBrokenLink(linkCheck)) {
    return false;
  }

  if (linkCheck.type === "instagram" && linkCheck.status === "unverified" && !linkCheck.issues.length) {
    return false;
  }

  return true;
}

function hasDetectedLocationUpdate(check: DirectoryCheck) {
  const detectedLocation = normalizeLocationLabel(check.serviceCheck?.areaLabel);
  const savedLocation = normalizeLocationLabel(check.areaLabel);

  return Boolean(!check.locationReviewIgnored && detectedLocation && savedLocation && detectedLocation !== savedLocation);
}

function normalizeLocationLabel(value?: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\blondon\b/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getLinkDismissUpdate(check: DirectoryCheck): FreshnessUpdate | undefined {
  const linkTypes = new Set(check.linkChecks.filter((linkCheck) => linkCheck.status !== "ok").map((linkCheck) => linkCheck.type));
  const update: FreshnessUpdate = {};

  if (linkTypes.has("booking") && check.bookingUrl !== undefined) {
    update.bookingUrl = check.bookingUrl;
  }
  if (linkTypes.has("instagram") && check.instagramUrl !== undefined) {
    update.instagramUrl = check.instagramUrl;
  }

  return Object.keys(update).length ? update : undefined;
}

function getManualCheckDescription(linkCheck: DirectoryCheck["linkChecks"][number]) {
  if (linkCheck.httpStatus === 401 || linkCheck.httpStatus === 403 || linkCheck.httpStatus === 429) {
    return `Could not verify automatically: HTTP ${linkCheck.httpStatus}`;
  }
  if (linkCheck.httpStatus) {
    return `Could not verify automatically: HTTP ${linkCheck.httpStatus}`;
  }
  return "Could not verify automatically";
}

function getFreshnessGroupRecommendation(
  check: DirectoryCheck,
  brokenLinkCount: number,
  manualLinkCount: number,
  addedServices = check.addedServices,
  removedServices = check.removedServices,
  attributeSuggestions = check.attributeSuggestions || [],
  hasLocationRecommendation = false,
) {
  const hasAddedServices = addedServices.length > 0;
  const hasRemovedServices = removedServices.length > 0;
  const hasServiceRecommendations = hasAddedServices || hasRemovedServices;
  const hasAttributeRecommendations = attributeSuggestions.length > 0;

  if (brokenLinkCount && hasServiceRecommendations) {
    return "Review listing";
  }
  if (brokenLinkCount) {
    return brokenLinkCount === 1 ? "Fix broken link" : "Fix broken links";
  }
  if (manualLinkCount) {
    return manualLinkCount === 1 ? "Manual check" : "Manual checks";
  }
  if (hasAddedServices && hasRemovedServices) {
    return "Update services";
  }
  if (hasAddedServices) {
    return addedServices.length === 1 ? "Add service" : "Add services";
  }
  if (hasRemovedServices) {
    return removedServices.length === 1 ? "Remove service" : "Remove services";
  }
  if (hasAttributeRecommendations) {
    return "Update profile";
  }
  if (hasLocationRecommendation) {
    return "Review location";
  }
  if (check.backfillStatus === "auto-applied") {
    return "Price auto-applied";
  }
  if (check.backfillStatus === "no-price") {
    return "No pricing found";
  }
  if (check.backfillStatus === "skipped-social") {
    return "Skipped";
  }
  return check.issues.some((issue) => issue.toLowerCase().includes("price")) ? "Review price" : "Review service";
}

function getServiceEvidence(rawServices: string[] = [], service: string) {
  const keywords = serviceEvidenceKeywords[service] ?? service.toLowerCase().split(/\s+|\/|\(|\)|-/).filter((word) => word.length > 3);
  const normalizedKeywords = keywords.map(normalizeEvidenceText);
  const exactMatches = rawServices.filter((line) => {
    const normalizedLine = normalizeEvidenceText(line);
    return normalizedKeywords.some((keyword) => keyword && normalizedLine.includes(keyword));
  });

  if (exactMatches.length) {
    return exactMatches.slice(0, 4);
  }

  return rawServices.filter((line) => isColourService(service) && /colou?r|highlight|balayage|tone|tint|bleach|root/i.test(line)).slice(0, 4);
}

function getRemovalReviewEvidence(rawServices: string[] = [], service: string) {
  const exactEvidence = getServiceEvidence(rawServices, service).filter((line) => !hasStyleRemovalInstructionEvidence(normalizeEvidenceText(line)));
  if (exactEvidence.length) {
    return exactEvidence;
  }

  const family = getServiceGroupLabel(service);
  const siblingKeywords = family
    ? serviceGroups
        .find((group) => group.label === family)
        ?.services.flatMap((relatedService) => serviceEvidenceKeywords[relatedService] ?? [])
    : [];
  const serviceWords = service
    .toLowerCase()
    .split(/\s+|\/|\(|\)|-|\+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 4 && !genericRemovalEvidenceWords.has(word));
  const keywords = [...new Set([...(removalReviewKeywords[service] ?? []), ...(siblingKeywords ?? []), ...serviceWords].map(normalizeEvidenceText).filter(Boolean))];

  return rawServices
    .map((line) => {
      const normalizedLine = normalizeEvidenceText(line);
      const score = keywords.reduce((total, keyword) => total + (normalizedLine.includes(keyword) ? getRemovalEvidenceKeywordWeight(keyword) : 0), 0);
      return { line, score };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((match) => match.line)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .slice(0, 5);
}

function getRemovalEvidenceKeywordWeight(keyword: string) {
  return keyword.length > 10 ? 2 : 1;
}

function getServiceGroupLabel(service: string) {
  return serviceGroups.find((group) => group.services.includes(service))?.label ?? "";
}

const serviceEvidenceKeywords: Record<string, string[]> = {
  "Balayage": ["balayage"],
  "Highlights": ["highlight", "highlights", "lowlights"],
  "Full head colour": ["colour", "color", "tint", "dye", "rooting"],
  "Wig colouring / bundle colouring": ["wig colour", "wig color", "colouring full wig", "custom colour", "colour service", "613", "non-contact", "non contact"],
  "Frontal sew-in": ["frontal sew in", "frontal sew-in", "frontal sewin", "frontal weave"],
  "Closure sew-in": ["closure sew in", "closure sew-in", "closure sewin", "closure weave", "weave with lace closure", "closure behind the hairline"],
  "Creative braids": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids", "diva braids"],
  "Feed-in braids": ["feed in", "feed-in", "all back", "braids going back"],
  "Fulani / lemonade braids": ["fulani", "lemonade", "alicia keys braids"],
  "K-tips / invisible strands": ["k tips", "k-tips", "keratin tip", "keratin tips", "keratin bonds", "invisible strands"],
  "Frontal ponytail / bun": ["frontal ponytail", "frontal pony", "frontal bun", "frontal updo"],
  "U-part wig install": ["u part", "upart", "u-part", "u part wig", "u-part wig", "upart wig", "v part", "vpart", "v-part", "u/vpart", "uvpart"],
  "Custom wig": ["custom wig", "bespoke wig", "custom lace", "custom unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "construction of wig", "construction of the wig", "wig making", "wig construction", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Wig install (frontal / closure)": ["wig install", "wig installation", "installation of the wig", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install", "frontal unit install", "closure unit install"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie sew in", "pixie sew-in", "pixie sewin"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist"],
  "Hybrid sew in (tapes + sew in)": ["hybrid sew in", "hybrid sew-in", "hybrid weave", "tracks + tapes hybrid", "tracks and tapes hybrid"],
  "Tracks (+ silk press) / partial / invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "row sew in", "rows of sew in", "weave tracks", "weave tracks per track", "weave on per row", "traditional weave rows", "partial sew in", "partial sewin", "invisible sew in", "invisible weave", "invisible weft", "invisible wefts", "half head weave"],
  "Bouncy blowout / round brush blow dry": ["bouncy blowout", "bouncy blow out", "bouncy blowdry", "bouncy blow dry", "bouncy blow-dry", "round brush blow dry", "round brush blowdry", "dry bouncy blow-dry", "blowout"],
  "Sew in / extensions blowdry": ["extensions blowdry", "extensions blow dry", "extensions blowout", "extensions blow out", "extension blowdry", "extension blow dry", "extension blowout", "extension blow out", "blowdry with extensions", "blow dry with extensions", "blowout with extensions", "blow out with extensions", "weave blowdry", "weave blow dry", "weave blowout", "weave blow out", "sew in blowdry", "sew in blow dry", "sew-in blowdry", "sew-in blow dry", "sewin blowdry", "sewin blow dry", "sew in blowout", "sew in blow out", "k tips blowdry", "k-tips blowdry", "ktips blowdry", "k tips blow dry", "k-tips blow dry", "ktips blow dry", "blow out on sew in weave", "blowout on sew in weave", "wash blow dry with extensions", "wash and blow dry with extensions"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry"],
  "Japanese head spa": ["japanese head spa", "head spa", "headspa"],
  "Updo": ["updo", "up do", "pin up", "french roll up", "french roll"],
  "Wig cornrows": ["under wig", "wig cornrows", "cornrows for wig installation", "cornrows"],
  "Butterfly locs": ["butterfly locs"],
  "Faux locs": ["faux locs", "invisible locs", "soft locs"],
  "Starter locs": ["starter locs", "start locs", "loc start"],
  "Stitch braids": ["stitch braids", "stitch"],
  "Scalp detox / treatments": ["scalp", "scalp care", "scalp therapy", "scalp treatment", "scalp treatments", "scalp scrub", "scalp detox", "scalp rejuvenation", "scalp renewal", "exfoliating scalp salt scrub"],
  "Roller set": ["roller set", "roller sets", "rollers", "wet set", "wet roller set", "perm rods", "perm rod set", "curlformers", "flexi rods on wet hair", "rod set"],
};

const removalReviewKeywords: Record<string, string[]> = {
  "Custom wig": ["unit customisation", "unit customization", "wig customisation", "wig customization", "wig customising", "construction of wig", "construction of the wig", "wig making", "wig construction", "bespoke wig", "custom unit"],
  "Healthy hair plans & consultations": ["healthy hair", "healthy hair plan", "healthy hair plans", "healthy hair consultation", "healthy hair consultations", "healthy hair regime", "healthy hair regimes", "healthy hair regimen", "healthy hair journey", "hair growth plan", "hair health plan"],
  "Wig install (frontal / closure)": ["wig installation", "installation of the wig", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install"],
  "Tracks (+ silk press) / partial / invisible sew-in": ["tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "partial sew", "row sew", "one row", "individual sewn on track", "weave tracks", "weave tracks per track", "per track"],
  "Natural hair coaches / educators": ["hair education", "natural hair education", "natural hair coach", "natural hair coaches", "hair health", "growth plan", "tutorial"],
};

const genericRemovalEvidenceWords = new Set(["service", "services", "install", "installation", "treatment", "braids", "style", "styling", "with", "hair"]);

function isColourService(service: string) {
  return service === "Balayage" || service === "Highlights" || service === "Full head colour" || service === "Wig colouring / bundle colouring";
}

function normalizeEvidenceText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function FreshnessIssuePill({ tone, children }: { tone: FreshnessRecommendationGroup["typeTone"]; children: React.ReactNode }) {
  const colorClass =
    tone === "critical"
      ? "bg-red-100 text-red-700"
      : tone === "info"
        ? "bg-emerald-100 text-emerald-700"
        : tone === "warning"
          ? "bg-sky-100 text-sky-700"
          : "bg-stone-100 text-stone-700";

  return <span className={cn("inline-flex rounded-none px-2.5 py-1 text-xs font-medium", colorClass)}>{children}</span>;
}

function FreshnessStatusPill({ status }: { status: FreshnessRecommendationGroup["status"] }) {
  const colorClass = status === "Resolved" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700";

  return <span className={cn("inline-flex rounded-none px-2.5 py-1 text-xs font-medium", colorClass)}>{status}</span>;
}

function FreshnessRecommendationDetails({ row }: { row: FreshnessRecommendationGroup }) {
  if (row.details.length <= 1) {
    return <span>{row.details[0]?.description}</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.details.map((detail, index) => (
        <div key={`${detail.label}-${index}`} className="flex items-start gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-none bg-stone-300" />
          <span>{detail.description}</span>
        </div>
      ))}
    </div>
  );
}

function FreshnessLinkButtons({ row }: { row: FreshnessRecommendationGroup }) {
  const bookingDisplayUrl = row.bookingUrl;
  const brokenTypes = new Set(row.check.linkChecks.filter((lc) => lc.status !== "ok").map((lc) => lc.type));
  const instagramBroken = brokenTypes.has("instagram");
  const bookingBroken = brokenTypes.has("booking") || brokenTypes.has("website");

  return (
    <span className="inline-flex items-center gap-1">
      {row.instagramUrl ? (
        <a
          href={row.instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${row.stylist} Instagram${instagramBroken ? " (broken)" : ""}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-none transition hover:bg-stone-100",
            instagramBroken ? "text-red-500 hover:text-red-700" : "text-stone-500 hover:text-stone-950",
          )}
        >
          <InstagramIcon className="size-4" />
        </a>
      ) : null}
      {bookingDisplayUrl ? (
        <a
          href={bookingDisplayUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${row.stylist} booking link${bookingBroken ? " (broken)" : ""}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-none transition hover:bg-stone-100",
            bookingBroken ? "text-red-500 hover:text-red-700" : "text-stone-500 hover:text-stone-950",
          )}
        >
          <Globe className="size-4" />
        </a>
      ) : null}
    </span>
  );
}

function IconActionDivider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px bg-stone-200" />;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) {
    return "just now";
  }
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  return `${Math.round(elapsedHours / 24)}d ago`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function KeywordSearchPage({
  keywords,
  keywordInput,
  suggestionGroups,
  results,
  progress,
  isRunning,
  assigningServiceIds,
  onKeywordInputChange,
  onKeywordsChange,
  onRun,
  onAssignService,
}: {
  keywords: string[];
  keywordInput: string;
  suggestionGroups: KeywordSuggestionGroup[];
  results: KeywordSearchResult[];
  progress: KeywordSearchProgress;
  isRunning: boolean;
  assigningServiceIds: string[];
  onKeywordInputChange: (value: string) => void;
  onKeywordsChange: (keywords: string[]) => void;
  onRun: () => void;
  onAssignService: (result: KeywordSearchResult) => void;
}) {
  function suggestKeywords(value: string) {
    const suggestedKeywords = suggestKeywordSearchTerms(value, suggestionGroups);
    if (!suggestedKeywords.length) {
      onKeywordInputChange("");
      return;
    }
    onKeywordsChange([...new Set([...keywords, ...suggestedKeywords])]);
    onKeywordInputChange("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (keywordInput.trim()) {
      suggestKeywords(keywordInput);
      return;
    }
  }

  function removeKeyword(keyword: string) {
    onKeywordsChange(keywords.filter((item) => item !== keyword));
  }

  const progressLabel = progress.total
    ? `${progress.checkedCount} of ${progress.total} searched`
    : "Ready to scan live booking pages";
  const isInitialLoading = isRunning && results.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Keyword search</h1>
        <p className="mt-2 text-sm text-stone-500">{progressLabel}</p>
      </section>

      <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
        <StylistStatCell label="Matches found" value={results.length} />
        <StylistStatCell label="Searched" value={progress.checkedCount} />
        <StylistStatCell label="Skipped" value={progress.skippedCount} />
        <StylistStatCell label="Total" value={progress.total} />
      </div>

      <div className="rounded-none border border-stone-300 bg-white px-4 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <Search className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
          <div className="flex min-h-8 flex-1 flex-wrap items-center gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-none border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  aria-label={`Remove ${keyword}`}
                  className="text-stone-400 transition hover:text-stone-950"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={keywordInput}
              onChange={(event) => onKeywordInputChange(event.target.value)}
              placeholder={keywords.length ? "Add another keyword..." : "Enter a keyword, e.g. kids, bridal, locs"}
              className="min-w-[160px] flex-1 border-none bg-transparent px-1 py-1 text-sm text-stone-950 outline-none placeholder:text-stone-400"
            />
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || (keywords.length === 0 && !keywordInput.trim())}
            aria-label="Run search"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-none bg-stone-950 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Results</h2>
            <p className="mt-1 text-sm text-stone-500">{progress.skippedCount ? `${progress.skippedCount} skipped` : "Live scan of booking and website pages"}</p>
          </div>
          <p className="text-sm font-medium text-stone-600">{results.length} match{results.length === 1 ? "" : "es"}</p>
        </div>

        <div className="overflow-hidden rounded-none border border-stone-200 bg-white">
          {isInitialLoading ? (
            <div className="p-4">
              <KeywordSearchSkeleton />
            </div>
          ) : results.length ? (
            <div className="space-y-3 p-4">
              {results.map((result) => (
                <KeywordSearchResultCard key={result.id} result={result} isAssigning={assigningServiceIds.includes(result.id)} onAssignService={onAssignService} />
              ))}
              {isRunning ? <KeywordSearchSkeleton count={1} compact /> : null}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
              <SearchX className="mb-4 size-8 text-stone-300" />
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">No matches yet</h2>
              <p className="mt-3 max-w-xl text-base text-stone-500">Run a live keyword search to find matching wording across booking and website pages.</p>
              <Button type="button" onClick={onRun} disabled={isRunning || (keywords.length === 0 && !keywordInput.trim())} className="mt-8 h-11 rounded-none bg-stone-950 px-4 text-sm">
                <SearchCheck className="size-4" />
                Run search
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function KeywordSearchResultCard({ result, isAssigning, onAssignService }: { result: KeywordSearchResult; isAssigning: boolean; onAssignService: (result: KeywordSearchResult) => void }) {
  return (
    <article className="rounded-none border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">{result.name}</p>
          <p className="mt-1 text-xs text-stone-500">{[result.areaLabel, result.bookingPlatform].filter(Boolean).join(" · ") || "Directory listing"}</p>
          {result.selectedService ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("bg-white text-[11px]", result.selectedServiceAssigned ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700")}>
                {result.selectedServiceAssigned ? "Already assigned" : "Not assigned"}: {result.selectedService}
              </Badge>
              {!result.selectedServiceAssigned ? (
                <Button type="button" variant="outline" onClick={() => onAssignService(result)} disabled={isAssigning} className="h-7 rounded-none bg-white px-2.5 text-[11px]">
                  {isAssigning ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Assign service
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <KeywordResultLink href={result.bookingUrl} label="Booking" />
          <KeywordResultLink href={result.instagramUrl} label="Instagram" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {result.matches.map((match, index) => (
          <div key={`${match.sourceUrl}-${match.line}-${index}`} className="rounded-none bg-stone-50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <Badge variant="outline" className="bg-white">{match.keywords.join(", ")}</Badge>
              <span>{match.sourceType}</span>
              <a href={match.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-stone-950">
                Open source
                <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="mt-2 text-sm text-stone-700">{match.snippet || match.line}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function KeywordSearchSkeleton({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-none border border-stone-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-44 animate-pulse rounded-none bg-stone-200" />
              <div className="h-3 w-32 animate-pulse rounded-none bg-stone-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-none bg-stone-100" />
              <div className="h-8 w-20 animate-pulse rounded-none bg-stone-100" />
              <div className="h-8 w-24 animate-pulse rounded-none bg-stone-100" />
            </div>
          </div>
          {!compact ? (
            <div className="mt-4 space-y-2 rounded-none bg-stone-50 p-3">
              <div className="h-3 w-28 animate-pulse rounded-none bg-stone-200" />
              <div className="h-4 w-full animate-pulse rounded-none bg-stone-200" />
              <div className="h-4 w-4/5 animate-pulse rounded-none bg-stone-200" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function KeywordResultLink({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return null;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-none border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-500 hover:text-stone-950">
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

function normalizeKeywordInput(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function keywordSuggestionTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(splitKeywordSuggestionToken)
    .map(normalizeKeywordSuggestionToken)
    .filter((token) => !keywordSuggestionStopTokens.has(token));
}

const keywordSuggestionStopTokens = new Set(["and", "with", "for", "the", "of", "a", "an"]);

function splitKeywordSuggestionToken(token: string) {
  const compounds: Record<string, string[]> = {
    blowdry: ["blow", "dry"],
    blowout: ["blow", "out"],
    roundbrush: ["round", "brush"],
    sewin: ["sew", "in"],
    sewins: ["sew", "in"],
  };
  return compounds[token] || [token];
}

function normalizeKeywordSuggestionToken(token: string) {
  const aliases: Record<string, string> = {
    blowdries: "blowdry",
    extensions: "extension",
    installs: "install",
    installation: "install",
    braids: "braid",
    cornrows: "cornrow",
    locs: "loc",
    twists: "twist",
    wigs: "wig",
    styled: "style",
    styling: "style",
    styles: "style",
    finishing: "finish",
    finishes: "finish",
    shampooing: "shampoo",
  };
  return aliases[token] || token.replace(/s$/, "");
}

function hasSequentialKeywordSuggestionTokens(lineTokens: string[], keywordTokens: string[]) {
  if (!lineTokens.length || !keywordTokens.length || keywordTokens.length > lineTokens.length) {
    return false;
  }
  for (let index = 0; index <= lineTokens.length - keywordTokens.length; index += 1) {
    if (keywordTokens.every((token, offset) => lineTokens[index + offset] === token)) {
      return true;
    }
  }
  return false;
}

function isRelatedKeywordSuggestion(seed: string, trigger: string) {
  const seedTokens = keywordSuggestionTokens(seed);
  const triggerTokens = keywordSuggestionTokens(trigger);
  if (!seedTokens.length || !triggerTokens.length) {
    return false;
  }
  if (isGenericShortKeywordTrigger(triggerTokens) && seedTokens.length > triggerTokens.length) {
    return false;
  }
  if (triggerTokens.length > seedTokens.length && seedTokens.length > 1 && !triggerTokens.slice(0, seedTokens.length).every((token, index) => token === seedTokens[index])) {
    return false;
  }
  if (hasSequentialKeywordSuggestionTokens(seedTokens, triggerTokens) || hasSequentialKeywordSuggestionTokens(triggerTokens, seedTokens)) {
    return true;
  }
  return seedTokens.some((token) => keywordSuggestionDistinctiveTokens.has(token) && triggerTokens.includes(token));
}

function isGenericShortKeywordTrigger(tokens: string[]) {
  const key = tokens.join(" ");
  return genericShortKeywordTriggers.has(key);
}

const genericShortKeywordTriggers = new Set(["blow out", "blow dry", "blowdry", "blowout", "wash", "shampoo", "style", "hair"]);
const keywordSuggestionDistinctiveTokens = new Set(["bouncy", "round", "brush", "curly", "90", "dominican", "glamorous", "volumising", "volumizing", "extension", "weave", "sew", "track", "row", "partial", "invisible", "weft"]);

function suggestKeywordSearchTerms(value: string, suggestionGroups: KeywordSuggestionGroup[] = learnedKeywordSuggestionGroups) {
  const seed = normalizeKeywordInput(value);
  if (!seed) {
    return [];
  }

  const matchedGroups = suggestionGroups.filter((group) =>
    group.triggers.some((trigger) => isRelatedKeywordSuggestion(seed, trigger)),
  );
  const suggestions = matchedGroups.flatMap((group) => [...group.keywords]);
  return [...new Set([seed, ...suggestions])];
}

function DiscoveryPage({
  suggestions,
  isGenerating,
  isBusy,
  onGenerate,
  onCreateDraft,
}: {
  suggestions: DiscoverySuggestion[];
  isGenerating: boolean;
  isBusy: boolean;
  onGenerate: () => void;
  onCreateDraft: (suggestionId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Discovery</h1>
          <p className="mt-2 text-sm text-stone-500">Generate research leads from directory patterns, then turn promising leads into drafts.</p>
        </div>
        <Button type="button" variant="outline" onClick={onGenerate} disabled={isGenerating} className="h-10 rounded-none bg-white px-4">
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : null}
          Generate
        </Button>
      </section>

      <DiscoveryPanel suggestions={suggestions} isBusy={isBusy} onCreateDraft={onCreateDraft} />
    </div>
  );
}

function DiscoveryPanel({
  suggestions,
  isBusy,
  onCreateDraft,
}: {
  suggestions: DiscoverySuggestion[];
  isBusy: boolean;
  onCreateDraft: (suggestionId: string) => void;
}) {
  return (
    <div className="rounded-none border border-stone-200 bg-white p-4">
      {suggestions.length ? (
        <div className="max-h-[34rem] space-y-2 overflow-auto">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="space-y-3 rounded-none bg-stone-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{suggestion.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{suggestion.areaLabel || "Location pattern"}</p>
                </div>
                <FreshnessBadge status="service" label={suggestion.confidence} />
              </div>
              <p className="text-sm text-stone-600">{suggestion.reason}</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.services.map((service) => (
                  <Badge key={service} variant="outline" className="bg-white">
                    {service}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={suggestion.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-950">
                  Open search
                </a>
                <button
                  type="button"
                  onClick={() => onCreateDraft(suggestion.id)}
                  disabled={isBusy || suggestion.status === "draft_created"}
                  className="text-xs font-medium text-stone-900 underline underline-offset-2 disabled:text-stone-400"
                >
                  {suggestion.status === "draft_created" ? "Draft created" : "Create draft"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-none border border-dashed border-stone-300 p-4 text-sm text-stone-500">No discovery leads yet.</p>
      )}
    </div>
  );
}

function FreshnessResultCard({
  check,
  isBusy,
  onApply,
}: {
  check: DirectoryCheck;
  isBusy: boolean;
  onApply: (check: DirectoryCheck, update: FreshnessUpdate) => void;
}) {
  const [bookingUrl, setBookingUrl] = useState(check.bookingUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(check.instagramUrl || "");
  const hasBrokenLinks = check.linkChecks.some((linkCheck) => linkCheck.status !== "ok");

  return (
    <div className="space-y-3 rounded-none bg-stone-100 p-3">
      <p className="text-sm font-medium">{check.name}</p>
      <p className="mt-1 text-xs text-stone-500">{check.areaLabel || "Location unknown"}</p>
      <div className="flex flex-wrap gap-1">
        {check.linkChecks.map((linkCheck) => (
          <FreshnessBadge key={`${check.id}-${linkCheck.type}`} status={linkCheck.status} label={`${linkCheck.type}: ${linkCheck.status}`} />
        ))}
        {check.serviceCheck?.confidence && check.serviceCheck.confidence !== "unknown" ? (
          <FreshnessBadge status="service" label={`services: ${check.serviceCheck.confidence}`} />
        ) : null}
      </div>

      {check.addedServices.length ? (
        <div className="space-y-1.5">
          <ServiceSuggestionList
            label="Possible added"
            services={check.addedServices}
            tone="add"
            acceptLabel="Add"
            rejectLabel="Reject"
            isBusy={isBusy}
            onAccept={(service) => onApply(check, { addServices: [service] })}
            onReject={(service) => onApply(check, { rejectAddedServices: [service] })}
          />
        </div>
      ) : null}

      {check.removedServices.length ? (
        <div className="space-y-1.5">
          <ServiceSuggestionList
            label="Possible removed"
            services={check.removedServices}
            tone="remove"
            acceptLabel="Remove"
            rejectLabel="Keep"
            isBusy={isBusy}
            onAccept={(service) => onApply(check, { removeServices: [service] })}
            onReject={(service) => onApply(check, { rejectRemovedServices: [service] })}
          />
        </div>
      ) : null}

      {check.issues.length ? (
        <div className="flex flex-wrap gap-1">
          {check.issues.map((issue) => (
            <Badge key={issue} variant="outline" className="bg-white">
              {issue}
            </Badge>
          ))}
        </div>
      ) : null}

      {hasBrokenLinks ? (
        <div className="space-y-2 rounded-none border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Update links</p>
          <Input value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} placeholder="Booking URL" className="h-10 rounded-none" />
          <Input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram URL" className="h-10 rounded-none" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(check, { bookingUrl, instagramUrl })}
            disabled={isBusy}
            className="w-full rounded-none"
          >
            Save updated links
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[check.bookingUrl, check.instagramUrl].filter(Boolean).map((link) => (
          <a
            key={link}
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-stone-600 underline underline-offset-2 hover:text-stone-950"
          >
            Open source
          </a>
        ))}
      </div>
    </div>
  );
}

function nameFromInstagramUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const urlMatch = trimmed.match(/instagram\.com\/([^/?]+)/i);
  const handle = (urlMatch ? urlMatch[1] : trimmed).replace(/^@/, "");
  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DraftEditor({
  draft,
  regions,
  services,
  filterCategories,
  isBusy,
  onChange,
  onChangeLocations,
  onSave,
  onApprove,
  onDelete,
  canDelete = true,
  activeStep = "details",
  showWarnings = true,
  isEmbedded = false,
  embeddedSection = "basic",
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  filterCategories?: { id: string; label: string; subcategories: string[] }[];
  isBusy: boolean;
  onChange: (update: Partial<StylistDraft>) => void;
  onChangeLocations: (areaIds: string[]) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  activeStep?: DraftEditorStep;
  showWarnings?: boolean;
  isEmbedded?: boolean;
  embeddedSection?: "basic" | "filters" | "reviews";
}) {
  const bookingMatchesInstagram = urlsMatch(draft.bookingUrl, draft.instagramUrl);
  const visibleWarnings = showWarnings ? getVisibleDraftWarnings(draft) : [];
  const selectedAreaIds = getDraftAreaIds(draft);
  const selectedLocationLabels = getAreaIdsForLabels(selectedAreaIds)
    .map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId))
    .filter(Boolean);
  const [additionalNeedsOptions, setAdditionalNeedsOptions] = useState<{ id: string; label: string }[]>([]);
  const [customFilterTypes, setCustomFilterTypes] = useState<CustomFilterType[]>([]);
  const [openSourcePanel, setOpenSourcePanel] = useState<"pricing" | "services" | null>(null);
  const priceBandTiers = usePriceBandTiers();
  const priceBandOptions = priceBandOptionsFromTiers(priceBandTiers);
  useEffect(() => {
    fetch("/api/admin/additional-needs", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => { if (data.ok && Array.isArray(data.options)) setAdditionalNeedsOptions(data.options); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/admin/custom-filters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => { if (data.ok && Array.isArray(data.filterTypes)) setCustomFilterTypes(data.filterTypes); })
      .catch(() => {});
  }, []);

  function toggleCustomFilterValue(filterTypeId: string, optionId: string) {
    const current = draft.customFilters?.[filterTypeId] ?? [];
    const next = current.includes(optionId) ? current.filter((v) => v !== optionId) : [...current, optionId];
    onChange({ customFilters: { ...draft.customFilters, [filterTypeId]: next } });
  }

  function updateInstagramUrl(instagramUrl: string) {
    onChange({
      instagramUrl,
      ...(bookingMatchesInstagram ? { bookingUrl: instagramUrl } : {}),
    });
  }

  function autofillNameFromInstagram() {
    const currentName = draft.name.trim();
    if (currentName && currentName !== "New stylist") {
      return;
    }
    const derivedName = nameFromInstagramUrl(draft.instagramUrl);
    if (derivedName) {
      onChange({ name: derivedName });
    }
  }

  function toggleBookingSameAsInstagram(checked: boolean) {
    onChange({
      bookingUrl: checked ? draft.instagramUrl : bookingMatchesInstagram ? "" : draft.bookingUrl,
      ...(checked ? { bookingPlatform: "Instagram" } : {}),
    });
  }

  const warningsContent = visibleWarnings.length ? (
    <div className="rounded-none border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{visibleWarnings.join(" ")}</div>
  ) : null;

  const detailsContent = (
    <section className="space-y-6">
      <Field label="Name">
        <Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Stylist name" className="h-11 rounded-none" />
      </Field>

      <Field label="Discovery source">
        <Select value={draft.discoverySource || "Manual search"} onChange={(discoverySource) => onChange({ discoverySource })}>
          {[...new Set([...discoverySourceOptions, ...(draft.discoverySource ? [draft.discoverySource] : [])])].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Added via">
        <Select value={draft.addedVia || "Code edit"} onChange={(addedVia) => onChange({ addedVia })}>
          {[...new Set([...addedViaOptions, ...(draft.addedVia ? [draft.addedVia] : [])])].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Links</p>
        <DraftLinkField
          label="Instagram"
          icon={<InstagramIcon className="size-4" />}
          value={draft.instagramUrl}
          onChange={updateInstagramUrl}
          onBlur={autofillNameFromInstagram}
          placeholder="Enter instagram URL"
          href={draft.instagramUrl}
        />
        <DraftLinkField
          label="TikTok recommendation"
          icon={<Link2 className="size-4" />}
          value={draft.tiktokUrl || ""}
          onChange={(tiktokUrl) => onChange({ tiktokUrl })}
          placeholder="Enter TikTok URL"
          href={draft.tiktokUrl}
        />
        <DraftLinkField
          label="Booking URL"
          icon={<Link2 className="size-4" />}
          value={draft.bookingUrl}
          onChange={(bookingUrl) => onChange({ bookingUrl })}
          placeholder="https://..."
          href={draft.bookingUrl}
        >
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={bookingMatchesInstagram}
              disabled={!draft.instagramUrl}
              onChange={(event) => toggleBookingSameAsInstagram(event.target.checked)}
              className="size-3.5 rounded-none border-stone-300 accent-stone-950 disabled:opacity-40"
            />
            Same as Instagram
          </label>
        </DraftLinkField>
        <DraftLinkField
          label={<WebsiteFieldLabel />}
          icon={<Link2 className="size-4" />}
          value={draft.websiteUrl || ""}
          onChange={(websiteUrl) => onChange({ websiteUrl })}
          placeholder="https://..."
          href={draft.websiteUrl}
        />
      </div>

      <DraftLocationSelector draft={draft} regions={regions} onChange={onChangeLocations} />

      <DraftAdditionalNeeds draft={draft} options={additionalNeedsOptions} onChange={onChange} />

      <DraftCustomFilters draft={draft} filterTypes={customFilterTypes} onChange={onChange} />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Pricing</p>
        <Field label="Price band">
          <Select
            value={draft.priceBand || ""}
            onChange={(value) =>
              onChange({
                priceBand: (value as "" | PriceBand) || undefined,
                servicePriceBand: (value as "" | PriceBand) || "",
                packagePriceBand: value ? draft.packagePriceBand || "" : "",
                priceIncludesHair: value ? draft.priceIncludesHair === true : false,
                priceComparisonMode: value ? draft.priceComparisonMode || "service-only" : "",
                priceSource: value ? "manual" : "",
                priceConfidence: value ? "manual" : "",
                priceUpdatedAt: value ? new Date().toISOString() : "",
                ...(!value ? { priceEvidence: [], priceCheckedAt: "" } : {}),
              })
            }
          >
            {priceBandOptions.map((option) => (
              <option key={option.value || "unset"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Comparable service-only band">
            <Select
              value={draft.servicePriceBand || draft.priceBand || ""}
              onChange={(value) =>
                onChange({
                  servicePriceBand: (value as "" | PriceBand) || "",
                  priceBand: (value as "" | PriceBand) || draft.packagePriceBand || undefined,
                  priceComparisonMode: draft.packagePriceBand && value ? "mixed" : value ? "service-only" : draft.packagePriceBand ? "package-only" : "",
                })
              }
            >
              {priceBandOptions.map((option) => (
                <option key={`service-${option.value || "unset"}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hair-included package band">
            <Select
              value={draft.packagePriceBand || ""}
              onChange={(value) =>
                onChange({
                  packagePriceBand: (value as "" | PriceBand) || "",
                  priceIncludesHair: Boolean(value),
                  priceComparisonMode: value && (draft.servicePriceBand || draft.priceBand) ? "mixed" : value ? "package-only" : draft.servicePriceBand || draft.priceBand ? "service-only" : "",
                })
              }
            >
              {priceBandOptions.map((option) => (
                <option key={`package-${option.value || "unset"}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <DraftBooleanOption
          label="Hair or extensions included in some packages"
          checked={draft.priceIncludesHair === true}
          onToggle={(checked) =>
            onChange({
              priceIncludesHair: checked,
              priceComparisonMode: checked && (draft.servicePriceBand || draft.priceBand) && draft.packagePriceBand ? "mixed" : draft.priceComparisonMode || (checked ? "mixed" : "service-only"),
            })
          }
        />
        <ManualPriceCalculator
          key={`${draft.id}-manual-price-calculator`}
          initialText={(draft.priceEvidence || []).join("\n")}
          selectedPriceBand={draft.priceBand || ""}
          onSelectedPriceBandChange={(priceBand) => {
            const now = new Date().toISOString();
            onChange({
              priceBand: priceBand || undefined,
              servicePriceBand: priceBand || "",
              packagePriceBand: priceBand ? draft.packagePriceBand || "" : "",
              priceIncludesHair: priceBand ? draft.priceIncludesHair === true : false,
              priceComparisonMode: priceBand ? draft.priceComparisonMode || "service-only" : "",
              priceSource: priceBand ? "manual" : "",
              priceConfidence: priceBand ? "manual" : "",
              priceCheckedAt: priceBand ? draft.priceCheckedAt || now : "",
              priceUpdatedAt: priceBand ? now : "",
              ...(!priceBand ? { priceEvidence: [] } : {}),
            });
          }}
          onManualPriceResult={(result) => {
            if (!result?.priceBand) {
              return;
            }
            const now = new Date().toISOString();
            onChange({
              priceBand: result.priceBand,
              servicePriceBand: result.servicePriceBand || result.priceBand,
              packagePriceBand: result.packagePriceBand || "",
              priceIncludesHair: result.priceIncludesHair,
              priceComparisonMode: result.priceComparisonMode || (result.packagePriceBand ? "mixed" : "service-only"),
              priceSource: "manual",
              priceEvidence: result.evidence?.length ? result.evidence : draft.priceEvidence || [],
              priceConfidence: "manual",
              priceCheckedAt: now,
              priceUpdatedAt: now,
            });
          }}
        />
      </div>
    </section>
  );

  const servicesContent = (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">Services</h3>
        <p className="mt-1 text-sm text-stone-500">Raw booking copy and matched services.</p>
      </div>
      <Field label="Raw services">
        <Textarea value={(draft.rawServices || []).join("\n")} onChange={(value) => onChange({ rawServices: splitNoteLines(value) })} />
      </Field>
      <ServicePicker services={services} filterCategories={filterCategories} selected={draft.services} onChange={(next) => onChange({ services: next })} />
    </section>
  );

  const reviewContent = (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">Review</h3>
        <p className="mt-1 text-sm text-stone-500">Check the final details before publishing.</p>
      </div>
      <div className="divide-y divide-stone-100 rounded-none border border-stone-200 bg-white">
        <DraftReviewRow label="Name" value={draft.name || "Untitled stylist"} />
        <DraftReviewRow label="Instagram" value={draft.instagramUrl || "Not added"} />
        <DraftReviewRow label="Booking URL" value={draft.bookingUrl || "Not added"} />
        <DraftReviewRow label="TikTok recommendation" value={draft.tiktokUrl || "Not added"} />
        <DraftReviewRow label="Discovery source" value={draft.discoverySource || "Not set"} />
        <DraftReviewRow label="Added via" value={draft.addedVia || "Not set"} />
        <DraftReviewRow label="Locations" value={selectedLocationLabels.length ? selectedLocationLabels.join(", ") : getDraftLocationLabel(draft, regions) || "No location selected"} />
        <DraftReviewRow
          label="Preferences"
          value={additionalNeedsOptions
            .filter((opt) => {
              const field = additionalNeedsFieldMap[opt.id];
              return field && draft[field] === true;
            })
            .map((opt) => opt.label)
            .join(", ") || "None selected"}
        />
        <DraftReviewRow label="Pricing" value={draft.priceBand ? `${draft.priceBand} (${draft.priceSource || "manual"})` : "Not set"} />
        <DraftReviewRow label="Services">
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-900">{draft.services.length} selected</p>
            {draft.services.length ? (
              <div className="flex flex-wrap gap-2">
                {draft.services.map((service) => (
                  <span key={service} className="rounded-none border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm font-medium text-stone-700">
                    {service}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </DraftReviewRow>
      </div>
    </section>
  );

  const selectedPreferenceLabels = additionalNeedsOptions
    .filter((option) => {
      const field = additionalNeedsFieldMap[option.id];
      return field && draft[field] === true;
    })
    .map((option) => option.label);

  function renderFilterChip(key: string, label: string, isSelected: boolean, onToggle: () => void) {
    return (
      <button
        key={key}
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        className={cn(
          "rounded-none border px-2.5 py-1 text-xs font-medium transition",
          isSelected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
        )}
      >
        {label}
      </button>
    );
  }

  const embeddedBasicContent = (
    <div className="bg-white">
      <DraftPropertyRow label="Status">
        <DraftStatusPill status={getDraftDisplayStatus(draft)} />
      </DraftPropertyRow>

      <DraftPropertyRow label="Discovery source">
        <Select value={draft.discoverySource || "Manual search"} onChange={(discoverySource) => onChange({ discoverySource })}>
          {[...new Set([...discoverySourceOptions, ...(draft.discoverySource ? [draft.discoverySource] : [])])].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </DraftPropertyRow>

      <DraftPropertyRow label="Added via">
        <Select value={draft.addedVia || "Code edit"} onChange={(addedVia) => onChange({ addedVia })}>
          {[...new Set([...addedViaOptions, ...(draft.addedVia ? [draft.addedVia] : [])])].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </DraftPropertyRow>

      <DraftPropertyRow label="Instagram">
        <div className="flex items-center gap-2">
          <Input
            value={draft.instagramUrl}
            onChange={(event) => updateInstagramUrl(event.target.value)}
            onBlur={autofillNameFromInstagram}
            placeholder="Enter Instagram URL"
            className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950"
          />
          {draft.instagramUrl ? (
            <a href={draft.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Open Instagram">
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </DraftPropertyRow>

      <DraftPropertyRow label="Booking URL">
        <div className="flex items-center gap-2">
          <Input value={draft.bookingUrl} onChange={(event) => onChange({ bookingUrl: event.target.value })} placeholder="https://..." className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950" />
          {draft.bookingUrl ? (
            <a href={draft.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Open booking URL">
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </DraftPropertyRow>

      <DraftPropertyRow label="Booking link is Instagram">
        <input
          type="checkbox"
          checked={bookingMatchesInstagram}
          disabled={!draft.instagramUrl}
          onChange={(event) => toggleBookingSameAsInstagram(event.target.checked)}
          className="ml-2 size-4 rounded border-stone-300 accent-stone-500 disabled:opacity-40"
        />
      </DraftPropertyRow>

      <DraftPropertyRow label={<WebsiteFieldLabel />}>
        <div className="flex items-center gap-2">
          <Input
            value={draft.websiteUrl || ""}
            onChange={(event) => onChange({ websiteUrl: event.target.value })}
            placeholder="https://..."
            className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950"
          />
          {draft.websiteUrl ? (
            <a href={draft.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Open website">
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </DraftPropertyRow>
    </div>
  );

  const embeddedFiltersContent = (
    <div className="bg-white">
      <DraftPropertyRow label="Services">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <ServicePicker services={services} filterCategories={filterCategories} selected={draft.services} onChange={(next) => onChange({ services: next })} label={null} />
          </div>
          <SourceNotesButton
            isOpen={openSourcePanel === "services"}
            label="raw service notes"
            count={draft.rawServices?.length || 0}
            onClick={() => setOpenSourcePanel((current) => (current === "services" ? null : "services"))}
          />
        </div>
      </DraftPropertyRow>

      {openSourcePanel === "services" ? (
        <DraftPropertyRow label="Raw service notes">
          <SourceNotesPanel>
            <Textarea
              value={(draft.rawServices || []).join("\n")}
              onChange={(value) => onChange({ rawServices: splitNoteLines(value) })}
              placeholder="Paste service list, booking menu text, or notes"
            />
          </SourceNotesPanel>
        </DraftPropertyRow>
      ) : null}

      <DraftPropertyRow label="Locations">
        <DraftLocationSelector draft={draft} regions={regions} onChange={onChangeLocations} hideLabel />
      </DraftPropertyRow>

      <DraftPropertyRow label="Pricing">
        <div className="flex items-center gap-1.5">
          <Select
            value={draft.priceBand || ""}
            onChange={(value) =>
              onChange({
                priceBand: (value as "" | PriceBand) || undefined,
                servicePriceBand: (value as "" | PriceBand) || "",
                packagePriceBand: value ? draft.packagePriceBand || "" : "",
                priceIncludesHair: value ? draft.priceIncludesHair === true : false,
                priceComparisonMode: value ? draft.priceComparisonMode || "service-only" : "",
                priceSource: value ? "manual" : "",
                priceConfidence: value ? "manual" : "",
                priceUpdatedAt: value ? new Date().toISOString() : "",
                ...(!value ? { priceEvidence: [], priceCheckedAt: "" } : {}),
              })
            }
          >
            {priceBandOptions.map((option) => (
              <option key={option.value || "unset"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <SourceNotesButton
            isOpen={openSourcePanel === "pricing"}
            label="raw pricing notes"
            count={draft.priceEvidence?.length || 0}
            onClick={() => setOpenSourcePanel((current) => (current === "pricing" ? null : "pricing"))}
          />
        </div>
      </DraftPropertyRow>

      {openSourcePanel === "pricing" ? (
        <DraftPropertyRow label="Raw pricing notes">
          <SourceNotesPanel>
            <Textarea
              value={(draft.priceEvidence || []).join("\n")}
              onChange={(value) => onChange({ priceEvidence: splitNoteLines(value) })}
              placeholder="Paste pricing notes, menu text, or evidence"
            />
          </SourceNotesPanel>
        </DraftPropertyRow>
      ) : null}

      <DraftPropertyRow label="Additional needs">
        <div className="flex flex-wrap gap-1.5 py-1">
          {additionalNeedsOptions.map((option) => {
            const field = additionalNeedsFieldMap[option.id];
            if (!field) return null;
            const isSelected = draft[field] === true;
            return renderFilterChip(option.id, option.label, isSelected, () => onChange({ [field]: !isSelected }));
          })}
        </div>
      </DraftPropertyRow>

      {customFilterTypes.map((filterType) => {
        const selected = draft.customFilters?.[filterType.id] ?? [];
        return (
          <DraftPropertyRow key={filterType.id} label={filterType.label}>
            <div className={cn("flex gap-1.5 py-1", filterType.behavior === "toggle-group" ? "flex-col items-start" : "flex-wrap")}>
              {filterType.options.map((option) =>
                renderFilterChip(option.id, option.label, selected.includes(option.id), () => toggleCustomFilterValue(filterType.id, option.id)),
              )}
            </div>
          </DraftPropertyRow>
        );
      })}
    </div>
  );

  const embeddedReviewsContent = (
    <div className="bg-white">
      <DraftPropertyRow label="TikTok recommendation">
        <div className="flex items-center gap-2">
          <Input value={draft.tiktokUrl || ""} onChange={(event) => onChange({ tiktokUrl: event.target.value })} placeholder="Enter TikTok URL" className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950" />
          {draft.tiktokUrl ? (
            <a href={draft.tiktokUrl} target="_blank" rel="noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label="Open TikTok">
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </DraftPropertyRow>

      <DraftPropertyRow label="Booking reviews">
        {(() => {
          const platform = getVerifiedReviewsPlatform(draft.bookingUrl);
          const reviewsUrl = platform ? getVerifiedReviewsUrl(draft.bookingUrl) : null;
          return (
            <>
              <div className="flex items-center gap-2">
                {platform ? (
                  <a href={reviewsUrl!} target="_blank" rel="noreferrer" className="text-sm underline hover:text-stone-950">
                    Reviews on {platform}
                  </a>
                ) : (
                  <span className="text-sm text-stone-400">No supported booking platform detected</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                <Input
                  type="number"
                  min={0}
                  value={draft.verifiedReviewCount ?? ""}
                  onChange={(event) => onChange({ verifiedReviewCount: event.target.value === "" ? undefined : Math.max(0, Math.round(Number(event.target.value))) })}
                  placeholder="0"
                  className="h-6 w-20 rounded-none border border-stone-300 bg-stone-50 px-2 py-0 text-xs"
                />
                <span>reviews</span>
              </div>
            </>
          );
        })()}
      </DraftPropertyRow>

      <DraftPropertyRow label="Google reviews">
        <div className="flex items-center gap-2">
          <Input
            value={draft.googleMapsUri || ""}
            onChange={(event) => onChange({ googleMapsUri: event.target.value })}
            placeholder="https://maps.google.com/..."
            className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950"
          />
          {draft.googleMapsUri ? (
            <a href={draft.googleMapsUri} target="_blank" rel="noreferrer" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950" aria-label={`Google Maps link for ${draft.name} - opens in a new tab`}>
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
          <Input
            type="number"
            min={0}
            value={draft.googleReviewCount ?? ""}
            onChange={(event) => onChange({ googleReviewCount: event.target.value === "" ? undefined : Math.max(0, Math.round(Number(event.target.value))) })}
            placeholder="0"
            className="h-6 w-20 rounded-none border border-stone-300 bg-stone-50 px-2 py-0 text-xs"
          />
          <span>reviews{draft.googleDisplayName ? ` — matched to "${draft.googleDisplayName}"` : ""}</span>
        </div>
      </DraftPropertyRow>
    </div>
  );

  const embeddedContent = embeddedSection === "filters" ? embeddedFiltersContent : embeddedSection === "reviews" ? embeddedReviewsContent : embeddedBasicContent;

  const stepContent = activeStep === "details" ? detailsContent : activeStep === "services" ? servicesContent : reviewContent;
  const content = (
    <div className="space-y-7">
      {warningsContent}
      {stepContent}
    </div>
  );

  if (isEmbedded) {
    return embeddedContent;
  }

  return (
    <Card className="rounded-none">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Edit draft</CardTitle>
              <StatusBadge status={draft.status} />
            </div>
            <CardDescription>Clean up the research result before it joins the public directory.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onSave} disabled={isBusy} className="rounded-none">
              <Save className="size-4" />
              Save
            </Button>
	            {canDelete ? (
	              <>
	                <Button type="button" onClick={onApprove} disabled={isBusy} className="rounded-none">
	                  <Check className="size-4" />
	                  Approve
	                </Button>
                <Button type="button" variant="ghost" onClick={onDelete} disabled={isBusy} className="rounded-none text-red-700">
	                  <Trash2 className="size-4" />
                    <span className="sr-only">Delete draft</span>
	                </Button>
	              </>
	            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function SourceNotesButton({ isOpen, label, count, onClick }: { isOpen: boolean; label: string; count: number; onClick: () => void }) {
  const actionLabel = (isOpen ? "Hide " : "Edit ") + label + (count ? ", " + count + " lines" : "");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={actionLabel}
      title={actionLabel}
      className={cn(
        "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-950",
        isOpen ? "bg-stone-100 text-stone-950" : "",
      )}
    >
      <Pencil className="size-3.5" />
    </button>
  );
}

function SourceNotesPanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-stone-50 p-2">{children}</div>;
}

function WebsiteFieldLabel() {
  return (
    <span className="inline-flex items-center gap-1">
      Website
      <span title="Used by freshness checks for richer info — not shown to visitors.">
        <Info className="size-3.5 shrink-0 text-stone-400" />
      </span>
    </span>
  );
}

function DraftPropertyRow({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[210px_minmax(0,1fr)] sm:gap-8">
      <div className="flex min-h-8 items-start pt-1 text-[15px] font-medium text-stone-500">
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function DraftReviewRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[128px_1fr] sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
      {children ?? <span className="min-w-0 break-words text-sm font-medium text-stone-900">{value}</span>}
    </div>
  );
}

function DraftLinkField({
  label,
  icon,
  value,
  onChange,
  onBlur,
  placeholder,
  href,
  children,
}: {
  label: React.ReactNode;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-none border border-stone-200 bg-stone-50 px-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
        <span className="text-stone-500">{icon}</span>
        {label}
      </div>
      <div className="flex items-center gap-3">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="h-8 rounded-none border border-stone-300 bg-stone-50 px-2 py-1 hover:border-stone-400 focus-visible:border-stone-950"
        />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-none text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label={`Open ${label}`}
          >
            <ExternalLink className="size-4" />
          </a>
        ) : (
          <span className="size-9 shrink-0" />
        )}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

// Admin-only pseudo-region: lets whoever's triaging a draft say "definitely
// south London, but the stylist never said which side" without guessing.
// Deliberately not part of the shared `regions` list (data/locations.json) that
// also feeds the public site's region filter — visitors never see "South
// London" as an option. matchesRegion() on the server already treats an
// areaId of "south" as satisfying both south-east and south-west filters, so
// a salon tagged this way still surfaces correctly either way a visitor
// searches; only the ambiguity itself stays admin-side.
const southLondonRegion: RegionOption = { id: "south", label: "South London" };

function DraftLocationSelector({
  draft,
  regions: regionsProp,
  onChange,
  hideLabel = false,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onChange: (areaIds: string[]) => void;
  hideLabel?: boolean;
}) {
  const regions = useMemo(
    () => (regionsProp.some((region) => region.id === "south") ? regionsProp : [...regionsProp, southLondonRegion]),
    [regionsProp],
  );
  const selectedAreaIds = getDraftAreaIds(draft);
  const selectedAreaSet = useMemo(() => new Set(selectedAreaIds), [selectedAreaIds]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const regionParentGroups = useRegionParentGroups();
  const locationGroups = useMemo(() => {
    const groups = regionParentGroups.map((group) => {
      const parentRegion = regions.find((region) => region.id === group.parentId);
      const rows = [
        ...(parentRegion ? [{ ...parentRegion, label: `All ${parentRegion.label}` }] : []),
        ...regions.filter((region) => group.childIds.includes(region.id)),
      ];
      return { id: group.parentId, label: parentRegion?.label ?? group.parentId, regions: rows };
    });
    const parentIdSet = new Set(regionParentGroups.map((group) => group.parentId));
    const childIdSet = new Set(regionParentGroups.flatMap((group) => group.childIds));
    const otherRows = regions.filter((region) => !parentIdSet.has(region.id) && !childIdSet.has(region.id));
    return [...groups, { id: "other", label: "Other", regions: otherRows }].filter((group) => group.regions.length > 0);
  }, [regions, regionParentGroups]);
  const activeGroup = locationGroups.find((group) => group.id === activeGroupId) ?? locationGroups[0] ?? null;
  const selectedLocationLabels = getAreaIdsForLabels(selectedAreaIds)
    .map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId))
    .filter(Boolean);
  const searchGroups = locationGroups
    .map((group) => ({
      ...group,
      regions: group.regions.filter((region) => region.label.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.regions.length > 0);
  const visibleSelected = selectedLocationLabels.slice(0, 4);
  const hiddenSelectedCount = Math.max(selectedLocationLabels.length - visibleSelected.length, 0);

  useEffect(() => {
    if (!locationGroups.length) {
      setActiveGroupId("");
      return;
    }
    if (!activeGroupId || !locationGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(locationGroups[0].id);
    }
  }, [activeGroupId, locationGroups]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggle(areaId: string) {
    const nextAreaIds = selectedAreaIds.includes(areaId) ? selectedAreaIds.filter((id) => id !== areaId) : [...selectedAreaIds, areaId];
    onChange(normalizeAreaIds(nextAreaIds, areaId));
  }

  function removeByLabel(label: string) {
    const match = regions.find((region) => region.label === label);
    if (match) {
      onChange(selectedAreaIds.filter((id) => id !== match.id));
    }
  }

  function renderLocationButton(region: RegionOption) {
    const isSelected = selectedAreaSet.has(region.id);
    return (
      <button
        key={region.id}
        type="button"
        onClick={() => toggle(region.id)}
        aria-pressed={isSelected}
        aria-label={(isSelected ? "Remove " : "Add ") + region.label}
        className={cn(
          "flex min-h-8 w-full items-center justify-between gap-2 rounded-none border px-2 py-1.5 text-left text-[11px] font-medium transition",
          isSelected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50",
        )}
      >
        <span className="truncate">{region.label}</span>
        {isSelected ? <Check className="size-3.5 shrink-0" /> : null}
      </button>
    );
  }

  const picker = (
    <div className="relative space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            className="min-h-8 w-full rounded-none border border-stone-300 bg-stone-50 px-2 py-1 text-left outline-none transition hover:border-stone-400 focus:border-stone-950"
          >
            {selectedLocationLabels.length ? (
              <span className="flex flex-wrap gap-1">
                {visibleSelected.map((label) => (
                  <span key={label} className="max-w-full truncate rounded-none bg-stone-100 px-1.5 py-0.5 text-[12px] font-medium text-stone-800">
                    {label}
                  </span>
                ))}
                {hiddenSelectedCount ? <span className="rounded-none bg-stone-100 px-1.5 py-0.5 text-[12px] font-medium text-stone-500">+{hiddenSelectedCount}</span> : null}
              </span>
            ) : (
              <span className="text-[13px] text-stone-400">Select locations</span>
            )}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div ref={popoverRef} className="mt-2 overflow-hidden rounded-none border border-stone-200 bg-white sm:-ml-[242px] sm:w-[calc(100%+242px)]">
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search locations"
                className="h-8 rounded-none border-stone-200 bg-white pl-8 pr-8"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900"
                  aria-label="Clear location search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="mt-2 min-h-7">
              {selectedLocationLabels.length ? (
                <div className="flex flex-wrap gap-1">
                  {selectedLocationLabels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => removeByLabel(label)}
                      aria-label={"Remove " + label}
                      className="inline-flex max-w-full items-center gap-1 rounded-none bg-stone-950 px-1.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-stone-800"
                    >
                      <span className="truncate">{label}</span>
                      <X className="size-3 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-1 text-[13px] text-stone-400">No locations selected</p>
              )}
            </div>
          </div>

          {normalizedQuery ? (
            <div className="max-h-[320px] overflow-y-auto p-2">
              {searchGroups.length ? (
                <div className="space-y-3">
                  {searchGroups.map((group) => (
                    <div key={group.id} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{group.label}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">{group.regions.map(renderLocationButton)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-3 text-sm text-stone-500">No locations match</p>
              )}
            </div>
          ) : (
            <div className="grid max-h-[320px] min-h-0 grid-rows-[auto_1fr] md:grid-cols-[132px_1fr] md:grid-rows-1">
              <div className="overflow-x-auto border-b border-stone-100 p-1.5 md:overflow-y-auto md:border-b-0 md:border-r">
                <div className="flex gap-1.5 md:block md:space-y-1">
                  {locationGroups.map((group) => {
                    const selectedCount = group.regions.filter((region) => selectedAreaSet.has(region.id)).length;
                    const isActive = activeGroup?.id === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroupId(group.id)}
                        aria-pressed={isActive}
                        className={cn(
                          "flex shrink-0 items-center justify-between gap-2 rounded-none px-2 py-1.5 text-left text-[11px] font-medium transition md:w-full",
                          isActive ? "bg-stone-950 text-white" : "bg-stone-50 text-stone-700 hover:bg-stone-100",
                        )}
                      >
                        <span className="min-w-0 truncate">{group.label}</span>
                        <span className="inline-flex shrink-0 items-center gap-1">
                          {selectedCount ? (
                            <span className={cn("rounded-none px-1.5 py-0.5 text-[10px]", isActive ? "bg-white text-stone-950" : "bg-stone-950 text-white")}>{selectedCount}</span>
                          ) : null}
                          <span className={cn("text-[10px]", isActive ? "text-stone-200" : "text-stone-400")}>{group.regions.length}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto p-2">
                {activeGroup ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{activeGroup.label}</p>
                      <span className="text-xs text-stone-400">{activeGroup.regions.length} locations</span>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">{activeGroup.regions.map(renderLocationButton)}</div>
                  </div>
                ) : (
                  <p className="p-3 text-sm text-stone-500">No locations available.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  if (hideLabel) {
    return picker;
  }

  return (
    <Field label="Locations">
      {picker}
    </Field>
  );
}

// Map additional-needs option IDs to StylistDraft boolean field names
const additionalNeedsFieldMap: Record<string, keyof StylistDraft> = {
  hijabiFriendly: "hijabiFriendly",
  canBraidWithoutGel: "canBraidWithoutGel",
  "wheelchair-access": "wheelchairAccessible",
  senFriendly: "senFriendly",
  lgbtqFriendly: "lgbtqFriendly",
  parkingAvailable: "parkingAvailable",
};

function DraftAdditionalNeeds({
  draft,
  options,
  onChange,
  hideLabel = false,
}: {
  draft: StylistDraft;
  options: { id: string; label: string }[];
  onChange: (update: Partial<StylistDraft>) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="space-y-1">
      {hideLabel ? null : <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Preferences</p>}
      <div className="grid gap-1">
        {options.map((option) => {
          const field = additionalNeedsFieldMap[option.id];
          if (!field) return null;
          return (
            <DraftBooleanOption
              key={option.id}
              label={option.label}
              checked={draft[field] === true}
              onToggle={(checked) => onChange({ [field]: checked })}
            />
          );
        })}
      </div>
    </div>
  );
}

function DraftCustomFilters({
  draft,
  filterTypes,
  onChange,
}: {
  draft: StylistDraft;
  filterTypes: CustomFilterType[];
  onChange: (update: Partial<StylistDraft>) => void;
}) {
  if (!filterTypes.length) return null;

  function toggle(filterTypeId: string, optionId: string) {
    const current = draft.customFilters?.[filterTypeId] ?? [];
    const next = current.includes(optionId) ? current.filter((v) => v !== optionId) : [...current, optionId];
    onChange({ customFilters: { ...draft.customFilters, [filterTypeId]: next } });
  }

  return (
    <div className="space-y-4">
      {filterTypes.map((filterType) => {
        const selected = draft.customFilters?.[filterType.id] ?? [];
        return (
          <div key={filterType.id} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{filterType.label}</p>
            {filterType.behavior === "toggle-group" ? (
              <div className="grid gap-1">
                {filterType.options.map((option) => (
                  <DraftBooleanOption
                    key={option.id}
                    label={option.label}
                    checked={selected.includes(option.id)}
                    onToggle={() => toggle(filterType.id, option.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filterType.options.map((option) => {
                  const isSelected = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggle(filterType.id, option.id)}
                      className={cn(
                        "rounded-none border px-2.5 py-1 text-xs font-medium transition",
                        isSelected ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DraftBooleanOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-[15px] font-medium text-stone-800 transition hover:bg-stone-100">
      <input type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} className="size-4 rounded border-stone-300 accent-stone-500" />
      <span>{label}</span>
    </label>
  );
}

function MultiLocationPicker({
  draft,
  regions,
  onChange,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onChange: (areaIds: string[]) => void;
}) {
  const selectedAreaIds = getDraftAreaIds(draft);

  function toggle(areaId: string) {
    onChange(selectedAreaIds.includes(areaId) ? selectedAreaIds.filter((id) => id !== areaId) : [...selectedAreaIds, areaId]);
  }

  return (
    <Field label="Locations">
      <div className="rounded-none border border-stone-200 bg-white p-3">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {regions.map((region) => (
            <label
              key={region.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-sm transition",
                selectedAreaIds.includes(region.id) ? "bg-stone-950 text-white" : "bg-stone-50 text-stone-700 hover:bg-stone-100",
              )}
            >
              <input
                type="checkbox"
                checked={selectedAreaIds.includes(region.id)}
                onChange={() => toggle(region.id)}
                className="size-3.5 accent-stone-950"
              />
              {region.label}
            </label>
          ))}
        </div>
      </div>
    </Field>
  );
}

function getDraftAreaIds(draft: StylistDraft) {
  return normalizeAreaIds(draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : []);
}

function draftMatchesCategory(draft: StylistDraft, categoryId: string, filterCategories: { id: string; label: string; subcategories: string[] }[]) {
  const category = filterCategories.find((item) => item.id === categoryId);
  if (!category) {
    return true;
  }
  if (!category.subcategories.length) {
    return draft.services.includes(category.label);
  }
  return draft.services.some((service) => category.subcategories.includes(service));
}

function draftMatchesLocation(draft: StylistDraft, regionId: string) {
  const areaIds = getDraftAreaIds(draft);
  const group = regionParentGroupsCache.find((g) => g.parentId === regionId);
  if (group) {
    return areaIds.some((areaId) => areaId === regionId || group.childIds.includes(areaId));
  }
  return areaIds.includes(regionId);
}

function normalizeAreaIds(areaIds: string[], latestAreaId?: string) {
  const uniqueAreaIds = [...new Set(areaIds.filter(Boolean))];
  const latestGroup = latestAreaId ? regionParentGroupsCache.find((g) => g.parentId === latestAreaId) : undefined;
  if (latestGroup) {
    return uniqueAreaIds.filter((areaId) => areaId === latestAreaId || !latestGroup.childIds.includes(areaId));
  }

  const owningGroup = latestAreaId ? regionParentGroupsCache.find((g) => g.childIds.includes(latestAreaId)) : undefined;
  if (owningGroup) {
    return uniqueAreaIds.filter((areaId) => areaId !== owningGroup.parentId);
  }
  return uniqueAreaIds;
}

function publishedSalonToDraft(salon: Partial<StylistDraft>): StylistDraft {
  const fallbackDate = new Date().toISOString();
  return {
    id: salon.id || "",
    status: "approved",
    name: salon.name || "",
    areaId: salon.areaId || "",
    areaIds: Array.isArray(salon.areaIds) ? salon.areaIds : salon.areaId ? [salon.areaId] : [],
    areaLabel: salon.areaLabel || "",
    neighbourhood: salon.neighbourhood || "",
    postcode: salon.postcode || "",
    bookingPlatform: salon.bookingPlatform || "",
    bookingUrl: salon.bookingUrl || "",
    websiteUrl: salon.websiteUrl || "",
    instagramUrl: salon.instagramUrl || "",
    tiktokUrl: salon.tiktokUrl || "",
    addedVia: salon.addedVia || "",
    discoverySource: salon.discoverySource || "",
    services: Array.isArray(salon.services) ? salon.services : [],
    rawServices: [],
    hijabiFriendly: salon.hijabiFriendly === true,
    canBraidWithoutGel: salon.canBraidWithoutGel === true,
    wheelchairAccessible: salon.wheelchairAccessible === true,
    senFriendly: salon.senFriendly === true,
    lgbtqFriendly: salon.lgbtqFriendly === true,
    parkingAvailable: salon.parkingAvailable === true,
    priceBand: salon.priceBand,
    servicePriceBand: salon.servicePriceBand,
    packagePriceBand: salon.packagePriceBand,
    priceIncludesHair: salon.priceIncludesHair === true,
    priceComparisonMode: salon.priceComparisonMode || "",
    priceSource: salon.priceSource || "",
    priceEvidence: Array.isArray(salon.priceEvidence) ? salon.priceEvidence : [],
    priceCheckedAt: salon.priceCheckedAt || "",
    priceUpdatedAt: salon.priceUpdatedAt || "",
    priceConfidence: salon.priceConfidence || "",
    summary: salon.summary || "",
    warnings: [],
    evidence: Array.isArray(salon.evidence) ? salon.evidence : [],
    createdAt: salon.createdAt || fallbackDate,
    updatedAt: salon.updatedAt || fallbackDate,
    googleMapsUri: salon.googleMapsUri || "",
    googleReviewCount: salon.googleReviewCount,
    googleMatchConfidence: salon.googleMatchConfidence || "",
    googleDisplayName: salon.googleDisplayName || "",
    verifiedReviewCount: salon.verifiedReviewCount,
  };
}

function getAreaIdsForLabels(areaIds: string[]) {
  const areaIdSet = new Set(areaIds);
  const redundantParentIds = new Set(
    regionParentGroupsCache.filter((group) => group.childIds.some((childId) => areaIdSet.has(childId))).map((group) => group.parentId),
  );
  return areaIds.filter((areaId) => !redundantParentIds.has(areaId));
}

function getDraftLocationLabel(draft: StylistDraft, regions: RegionOption[]) {
  const labelAreaIds = getAreaIdsForLabels(getDraftAreaIds(draft));
  const labels = labelAreaIds.map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId)).filter(Boolean);
  return labels.length ? labels.join(" / ") : draft.areaLabel;
}

function areaLabelFromId(areaId: string) {
  return areaId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

type FilterCategory = { id: string; label: string; subcategories: string[] };

type FilterTypeId = "services" | "locations" | "additional-needs" | "price-range" | string;

type FiltersBaseline = {
  categories: FilterCategory[];
  regions: LocationRegion[];
  needsOptions: AdditionalNeedOption[];
  customFilterTypes: CustomFilterType[];
};

function getFilterRemovals(baseline: FiltersBaseline | null, current: FiltersBaseline & { priceBandTiers: PriceBandTier[] }, priceBandBaseline: PriceBandTier[]): string[] {
  if (!baseline) return [];
  const removals: string[] = [];

  const currentCategoryIds = new Set(current.categories.map((c) => c.id));
  const removedGroups = baseline.categories.filter((c) => !currentCategoryIds.has(c.id));
  if (removedGroups.length) {
    removals.push(`${removedGroups.length} service ${removedGroups.length === 1 ? "group" : "groups"} (${removedGroups.map((c) => c.label).join(", ")})`);
  }

  let removedSubcategoryCount = 0;
  for (const baselineCategory of baseline.categories) {
    const currentCategory = current.categories.find((c) => c.id === baselineCategory.id);
    if (!currentCategory) continue;
    const currentSubs = new Set(currentCategory.subcategories);
    removedSubcategoryCount += baselineCategory.subcategories.filter((sub) => !currentSubs.has(sub)).length;
  }
  if (removedSubcategoryCount) {
    removals.push(`${removedSubcategoryCount} service ${removedSubcategoryCount === 1 ? "subcategory" : "subcategories"}`);
  }

  const currentRegionIds = new Set(current.regions.map((r) => r.id));
  const removedRegions = baseline.regions.filter((r) => !currentRegionIds.has(r.id));
  if (removedRegions.length) {
    removals.push(`${removedRegions.length} ${removedRegions.length === 1 ? "region" : "regions"} (${removedRegions.map((r) => r.label).join(", ")})`);
  }

  const currentNeedIds = new Set(current.needsOptions.map((o) => o.id));
  const removedNeeds = baseline.needsOptions.filter((o) => !currentNeedIds.has(o.id));
  if (removedNeeds.length) {
    removals.push(`${removedNeeds.length} additional-need ${removedNeeds.length === 1 ? "option" : "options"} (${removedNeeds.map((o) => o.label).join(", ")})`);
  }

  const currentFilterTypeIds = new Set(current.customFilterTypes.map((t) => t.id));
  const removedFilterTypes = baseline.customFilterTypes.filter((t) => !currentFilterTypeIds.has(t.id));
  if (removedFilterTypes.length) {
    removals.push(`${removedFilterTypes.length} custom filter ${removedFilterTypes.length === 1 ? "type" : "types"} (${removedFilterTypes.map((t) => t.label).join(", ")})`);
  }

  let removedFilterOptionCount = 0;
  for (const baselineType of baseline.customFilterTypes) {
    const currentType = current.customFilterTypes.find((t) => t.id === baselineType.id);
    if (!currentType) continue;
    const currentOptionIds = new Set(currentType.options.map((o) => o.id));
    removedFilterOptionCount += baselineType.options.filter((o) => !currentOptionIds.has(o.id)).length;
  }
  if (removedFilterOptionCount) {
    removals.push(`${removedFilterOptionCount} custom filter ${removedFilterOptionCount === 1 ? "option" : "options"}`);
  }

  const currentTierSymbols = new Set(current.priceBandTiers.map((t) => t.symbol));
  const removedTiers = priceBandBaseline.filter((t) => !currentTierSymbols.has(t.symbol));
  if (removedTiers.length) {
    removals.push(`${removedTiers.length} price ${removedTiers.length === 1 ? "tier" : "tiers"} (${removedTiers.map((t) => t.label).join(", ")})`);
  }

  return removals;
}

function FiltersPage({ onCategoriesChange }: { onCategoriesChange?: (categories: FilterCategory[]) => void }) {
  const confirm = useConfirm();
  const baselineRef = useRef<FiltersBaseline | null>(null);
  const [activeType, setActiveType] = useState<FilterTypeId>("services");

  const [categories, setCategories] = useState<FilterCategory[]>([]);
  const [categoryRenames, setCategoryRenames] = useState<{ from: string; to: string }[]>([]);

  const [regions, setRegions] = useState<LocationRegion[]>([]);
  const [parentGroups, setParentGroups] = useState<RegionParentGroup[]>([]);
  const [standaloneIds, setStandaloneIds] = useState<string[]>([]);

  const [needsOptions, setNeedsOptions] = useState<AdditionalNeedOption[]>([]);

  const [customFilterTypes, setCustomFilterTypes] = useState<CustomFilterType[]>([]);
  const [isAddingFilterType, setIsAddingFilterType] = useState(false);

  const priceBandTiers = usePriceBandTiers();
  const [draftPriceBandTiers, setDraftPriceBandTiers] = useState<PriceBandTier[]>(priceBandTiers);
  const [hasPriceBandChanges, setHasPriceBandChanges] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function updateBaseline(patch: Partial<FiltersBaseline>) {
    baselineRef.current = {
      categories: baselineRef.current?.categories ?? [],
      regions: baselineRef.current?.regions ?? [],
      needsOptions: baselineRef.current?.needsOptions ?? [],
      customFilterTypes: baselineRef.current?.customFilterTypes ?? [],
      ...patch,
    };
  }

  useEffect(() => {
    fetch("/api/admin/filters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCategories(data.categories);
          updateBaseline({ categories: data.categories });
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/admin/locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setRegions(data.regions);
          setParentGroups(data.parentGroups ?? []);
          setStandaloneIds(data.standaloneIds ?? []);
          updateBaseline({ regions: data.regions });
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/admin/additional-needs", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setNeedsOptions(data.options);
          updateBaseline({ needsOptions: data.options });
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/admin/custom-filters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCustomFilterTypes(data.filterTypes);
          updateBaseline({ customFilterTypes: data.filterTypes });
        }
      });
  }, []);

  useEffect(() => {
    if (!hasPriceBandChanges) setDraftPriceBandTiers(priceBandTiers);
  }, [priceBandTiers, hasPriceBandChanges]);

  const subcategoryCount = categories.reduce((sum, cat) => sum + cat.subcategories.length, 0);

  const filterTypes: { id: FilterTypeId; label: string; description: string; count: number; icon: ComponentType<{ className?: string }>; removable?: boolean }[] = [
    { id: "services", label: "Service Categories", description: "Group and subcategory taxonomy", count: categories.length, icon: Tag },
    { id: "locations", label: "Location", description: "Regions across London", count: regions.length, icon: MapPin },
    { id: "additional-needs", label: "Additional Needs", description: "Accessibility and preferences", count: needsOptions.length, icon: Heart },
    { id: "price-range", label: "Price Range", description: "Budget tiers for services", count: draftPriceBandTiers.length, icon: CreditCard },
    ...customFilterTypes.map((type) => ({
      id: type.id,
      label: type.label,
      description: type.description || (type.behavior === "toggle-group" ? "Checklist filter" : "Tag multiselect filter"),
      count: type.options.length,
      icon: type.behavior === "toggle-group" ? Heart : Tag,
      removable: true,
    })),
  ];

  function recordRename(oldName: string, newName: string) {
    setCategoryRenames((prev) => {
      const existing = prev.find((r) => r.to === oldName);
      if (existing) {
        return prev.map((r) => (r.to === oldName ? { ...r, to: newName } : r));
      }
      return [...prev, { from: oldName, to: newName }];
    });
  }

  function addCustomFilterType(label: string, id: string, description: string, behavior: CustomFilterBehavior) {
    if (customFilterTypes.some((type) => type.id === id)) return;
    setCustomFilterTypes((prev) => [...prev, { id, label, description, behavior, options: [] }]);
    setIsAddingFilterType(false);
    setActiveType(id);
  }

  function removeCustomFilterType(id: string) {
    setCustomFilterTypes((prev) => prev.filter((type) => type.id !== id));
    if (activeType === id) setActiveType("services");
  }

  function updateCustomFilterType(id: string, updates: Partial<CustomFilterType>) {
    setCustomFilterTypes((prev) => prev.map((type) => (type.id === id ? { ...type, ...updates } : type)));
  }

  function updatePriceBandTiers(updater: (prev: PriceBandTier[]) => PriceBandTier[]) {
    setHasPriceBandChanges(true);
    setDraftPriceBandTiers(updater);
  }

  async function publish() {
    const removals = getFilterRemovals(
      baselineRef.current,
      { categories, regions, needsOptions, customFilterTypes, priceBandTiers: draftPriceBandTiers },
      priceBandTiers,
    );
    if (removals.length) {
      const confirmed = await confirm({
        title: "Publish these changes?",
        description: `This will remove: ${removals.join(", ")}. Stylists using these will lose them from the live site.`,
        confirmLabel: "Publish",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const [filtersRes, locationsRes, needsRes, customFiltersRes, priceBandsRes] = await Promise.all([
        fetch("/api/admin/filters", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories, renames: categoryRenames }),
        }),
        fetch("/api/admin/locations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regions, parentGroups, standaloneIds }),
        }),
        fetch("/api/admin/additional-needs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: needsOptions }),
        }),
        fetch("/api/admin/custom-filters", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filterTypes: customFilterTypes }),
        }),
        fetch("/api/admin/price-bands", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bands: draftPriceBandTiers }),
        }),
      ]);
      const [filtersData, locationsData, needsData, customFiltersData, priceBandsData] = await Promise.all([
        filtersRes.json(),
        locationsRes.json(),
        needsRes.json(),
        customFiltersRes.json(),
        priceBandsRes.json(),
      ]);
      const ok = filtersData.ok && locationsData.ok && needsData.ok && customFiltersData.ok && priceBandsData.ok;
      if (filtersData.ok) {
        setCategoryRenames([]);
        onCategoriesChange?.(categories);
        updateBaseline({ categories });
      }
      if (locationsData.ok) {
        updateBaseline({ regions });
        setRegionParentGroupsCache(parentGroups);
      }
      if (needsData.ok) {
        updateBaseline({ needsOptions });
      }
      if (customFiltersData.ok && Array.isArray(customFiltersData.filterTypes)) {
        setCustomFilterTypes(customFiltersData.filterTypes);
        updateBaseline({ customFilterTypes: customFiltersData.filterTypes });
      }
      if (priceBandsData.ok && Array.isArray(priceBandsData.bands)) {
        setHasPriceBandChanges(false);
        setPriceBandTiersCache(priceBandsData.bands);
      }
      setPublishMessage({
        text: ok
          ? "Published."
          : (filtersData.error || locationsData.error || needsData.error || customFiltersData.error || priceBandsData.error || "Failed to publish some changes."),
        ok,
      });
    } catch {
      setPublishMessage({ text: "Failed to publish changes.", ok: false });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Filters</h1>
          <p className="mt-1 text-sm text-stone-500">Manage filter types, groups and categories for the directory</p>
        </div>
        <div className="flex items-center gap-3">
          {publishMessage ? (
            <p className={cn("text-sm font-medium", publishMessage.ok ? "text-emerald-700" : "text-red-600")}>{publishMessage.text}</p>
          ) : null}
          <Button type="button" onClick={publish} disabled={isPublishing} className="h-10 rounded-none px-4 text-sm">
            {isPublishing ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            Publish
          </Button>
        </div>
      </div>

      <div className="mt-8 grid overflow-hidden rounded-none border border-stone-200 bg-white lg:h-[75vh] lg:grid-cols-[300px_1fr]">
        <aside className="max-h-[75vh] overflow-y-auto border-stone-200 bg-white lg:border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Filter types</p>
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-100 px-1.5 text-[11px] font-semibold text-stone-600">{filterTypes.length}</span>
          </div>
          <div>
            {filterTypes.map((type) => {
              const Icon = type.icon;
              const isActive = activeType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setActiveType(type.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 border-t border-stone-100 px-4 py-4 text-left transition",
                    isActive ? "bg-stone-100" : "hover:bg-stone-50",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-stone-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-stone-950">{type.label}</p>
                      <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 px-1.5 text-[11px] font-semibold text-stone-600">{type.count}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-stone-500">{type.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-stone-100 p-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddingFilterType(true)}
              className="h-10 w-full rounded-none px-4 text-sm"
            >
              <Plus className="size-4" />
              Add filter type
            </Button>
          </div>
        </aside>

        <main className="max-h-[75vh] overflow-y-auto bg-white p-6">
          {activeType === "services" ? (
            <ServicesFilterPanel
              categories={categories}
              onCategoriesChange={setCategories}
              onRename={recordRename}
              subcategoryCount={subcategoryCount}
            />
          ) : null}
          {activeType === "locations" ? (
            <LocationsFilterPanel
              regions={regions}
              onRegionsChange={setRegions}
              parentGroups={parentGroups}
              onParentGroupsChange={setParentGroups}
              onStandaloneIdsChange={setStandaloneIds}
            />
          ) : null}
          {activeType === "additional-needs" ? (
            <AdditionalNeedsFilterPanel options={needsOptions} onOptionsChange={setNeedsOptions} />
          ) : null}
          {activeType === "price-range" ? (
            <PriceRangeFilterPanel tiers={draftPriceBandTiers} onTiersChange={updatePriceBandTiers} />
          ) : null}
          {customFilterTypes.some((type) => type.id === activeType) ? (
            <CustomFilterPanel
              filterType={customFilterTypes.find((type) => type.id === activeType)!}
              onChange={(updates) => updateCustomFilterType(activeType, updates)}
              onDelete={() => removeCustomFilterType(activeType)}
            />
          ) : null}
        </main>
      </div>

      {isAddingFilterType ? (
        <AddCustomFilterTypeDrawer
          existingIds={new Set(filterTypes.map((type) => type.id))}
          onClose={() => setIsAddingFilterType(false)}
          onSubmit={addCustomFilterType}
        />
      ) : null}
    </div>
  );
}

function AddFilterItemDrawer({
  title,
  labelPlaceholder,
  idPlaceholder,
  onClose,
  onSubmit,
  showParentToggle,
  parentToggleLabel,
}: {
  title: string;
  labelPlaceholder: string;
  idPlaceholder: string;
  onClose: () => void;
  onSubmit: (label: string, id: string, isParent?: boolean) => void;
  showParentToggle?: boolean;
  parentToggleLabel?: string;
}) {
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [isParent, setIsParent] = useState(false);

  function handleSubmit() {
    if (!label.trim() || !id.trim()) return;
    onSubmit(label.trim(), id.trim(), isParent);
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/10">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-hidden border-l border-stone-200 bg-white shadow-xl shadow-stone-950/10">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <Field label="Label">
            <Input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder={labelPlaceholder} className="h-11 rounded-none" />
          </Field>
          <Field label="ID">
            <Input value={id} onChange={(event) => setId(event.target.value)} placeholder={idPlaceholder} className="h-11 rounded-none" />
          </Field>
          {showParentToggle ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={isParent}
                onChange={(event) => setIsParent(event.target.checked)}
                className="mt-0.5 size-4 rounded-none border-stone-300 accent-stone-950"
              />
              {parentToggleLabel ?? "This is a parent location (like London)"}
            </label>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-stone-200 px-6 py-5">
          <Button type="button" onClick={handleSubmit} disabled={!label.trim() || !id.trim()} className="h-11 w-full rounded-none">
            Add
          </Button>
        </div>
      </aside>
    </div>
  );
}

function EditFilterItemDrawer({
  title,
  label,
  onLabelChange,
  id,
  onClose,
  onSave,
  onDelete,
  deleteLabel,
  showParentToggle,
  parentToggleLabel,
  isParent,
  onIsParentChange,
  nestOptions,
  nestedUnderId,
  onNestedUnderChange,
}: {
  title: string;
  label: string;
  onLabelChange: (value: string) => void;
  id?: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  showParentToggle?: boolean;
  parentToggleLabel?: string;
  isParent?: boolean;
  onIsParentChange?: (value: boolean) => void;
  nestOptions?: { value: string; label: string }[];
  nestedUnderId?: string;
  onNestedUnderChange?: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-stone-950/10">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col overflow-hidden border-l border-stone-200 bg-white shadow-xl shadow-stone-950/10">
        <div className="shrink-0 border-b border-stone-200 px-8 pb-2 pt-5">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-950"
              aria-label="Close"
              title="Close"
            >
              <ChevronsRight className="size-4" />
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex size-8 items-center justify-center rounded-md text-red-700 transition hover:bg-red-50"
                aria-label={deleteLabel ?? "Delete"}
                title={deleteLabel ?? "Delete"}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</p>
          <Input
            autoFocus
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSave();
            }}
            placeholder="Label"
            className="mt-2 h-auto rounded-none border-transparent bg-transparent px-0 py-0 text-[32px] font-semibold leading-tight tracking-normal text-stone-950 placeholder:text-stone-300 hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
          />
          {id ? <p className="mt-2 text-sm text-stone-400">ID: {id}</p> : null}

          {showParentToggle ? (
            <div className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={isParent ?? false}
                  onChange={(event) => onIsParentChange?.(event.target.checked)}
                  className="mt-0.5 size-4 rounded-none border-stone-300 accent-stone-950"
                />
                {parentToggleLabel ?? "This is a parent location"}
              </label>

              {!isParent && nestOptions ? (
                <Field label="Nested under">
                  <select
                    value={nestedUnderId ?? ""}
                    onChange={(event) => onNestedUnderChange?.(event.target.value)}
                    className="h-11 w-full rounded-none border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  >
                    <option value="">None (standalone)</option>
                    {nestOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-stone-200 bg-white px-8 py-5">
          <Button type="button" onClick={onSave} disabled={!label.trim()} className="h-12 w-full rounded-none bg-stone-950 px-6 text-base font-medium text-white hover:bg-stone-900">
            Save changes
          </Button>
        </div>
      </aside>
    </div>
  );
}

function AddCustomFilterTypeDrawer({
  existingIds,
  onClose,
  onSubmit,
}: {
  existingIds: Set<string>;
  onClose: () => void;
  onSubmit: (label: string, id: string, description: string, behavior: CustomFilterBehavior) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [behavior, setBehavior] = useState<CustomFilterBehavior>("toggle-group");

  const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const isDuplicate = Boolean(id) && existingIds.has(id);

  function handleSubmit() {
    if (!label.trim() || !id || isDuplicate) return;
    onSubmit(label.trim(), id, description.trim(), behavior);
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/10">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-hidden border-l border-stone-200 bg-white shadow-xl shadow-stone-950/10">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">Add filter type</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <Field label="Label">
            <Input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Hair type" className="h-11 rounded-none" />
          </Field>
          {id ? <p className={cn("-mt-3 text-xs", isDuplicate ? "text-red-600" : "text-stone-400")}>ID: {id}{isDuplicate ? " (already in use)" : ""}</p> : null}
          <Field label="Description">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Shown under the filter name" className="h-11 rounded-none" />
          </Field>
          <Field label="Behaviour">
            <div className="space-y-2">
              <label className={cn("flex cursor-pointer items-start gap-3 border px-4 py-3", behavior === "toggle-group" ? "border-stone-950 bg-stone-50" : "border-stone-200")}>
                <input
                  type="radio"
                  name="custom-filter-behavior"
                  checked={behavior === "toggle-group"}
                  onChange={() => setBehavior("toggle-group")}
                  className="mt-1 size-4 accent-stone-950"
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-950">Checklist</span>
                  <span className="block text-sm text-stone-500">A list of checkboxes, like Additional Needs.</span>
                </span>
              </label>
              <label className={cn("flex cursor-pointer items-start gap-3 border px-4 py-3", behavior === "tag-multiselect" ? "border-stone-950 bg-stone-50" : "border-stone-200")}>
                <input
                  type="radio"
                  name="custom-filter-behavior"
                  checked={behavior === "tag-multiselect"}
                  onChange={() => setBehavior("tag-multiselect")}
                  className="mt-1 size-4 accent-stone-950"
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-950">Tag multiselect</span>
                  <span className="block text-sm text-stone-500">Compact selectable tags, like Services.</span>
                </span>
              </label>
            </div>
          </Field>
        </div>

        <div className="shrink-0 border-t border-stone-200 px-6 py-5">
          <Button type="button" onClick={handleSubmit} disabled={!label.trim() || !id || isDuplicate} className="h-11 w-full rounded-none">
            Add
          </Button>
        </div>
      </aside>
    </div>
  );
}

function CustomFilterPanel({
  filterType,
  onChange,
  onDelete,
}: {
  filterType: CustomFilterType;
  onChange: (updates: Partial<CustomFilterType>) => void;
  onDelete: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOption, setEditingOption] = useState<{ id: string; label: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleOptions = normalizedSearch
    ? filterType.options.filter((o) => o.label.toLowerCase().includes(normalizedSearch))
    : filterType.options;

  function commitEdit(id: string, label: string) {
    const trimmed = label.trim();
    if (trimmed) onChange({ options: filterType.options.map((o) => (o.id === id ? { ...o, label: trimmed } : o)) });
    setEditingOption(null);
  }

  function removeOption(id: string) {
    onChange({ options: filterType.options.filter((o) => o.id !== id) });
    setEditingOption(null);
  }

  function addOption(label: string, rawId: string) {
    const id = rawId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !label || filterType.options.some((o) => o.id === id)) return;
    onChange({ options: [...filterType.options, { id, label }] });
    setIsAdding(false);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">{filterType.label}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {filterType.options.length} options · {filterType.behavior === "toggle-group" ? "Checklist" : "Tag multiselect"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setIsAdding((current) => !current)} className="h-10 rounded-none px-4 text-sm">
            <Plus className="size-4" />
            Add option
          </Button>
          <Button type="button" variant="outline" onClick={onDelete} className="h-10 rounded-none px-4 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" />
            Delete filter type
          </Button>
        </div>
      </div>

      {isAdding ? (
        <AddFilterItemDrawer
          title="Add option"
          labelPlaceholder="e.g. Type 4 hair"
          idPlaceholder="e.g. type4Hair"
          onClose={() => setIsAdding(false)}
          onSubmit={addOption}
        />
      ) : null}

      {editingOption ? (
        <EditFilterItemDrawer
          title="Edit option"
          label={editingOption.label}
          onLabelChange={(value) => setEditingOption({ ...editingOption, label: value })}
          id={editingOption.id}
          onClose={() => setEditingOption(null)}
          onSave={() => commitEdit(editingOption.id, editingOption.label)}
          onDelete={() => removeOption(editingOption.id)}
          deleteLabel={`Remove ${editingOption.label}`}
        />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search options..."
          className="h-10 rounded-none pl-9 pr-9 text-sm"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Clear options search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-stone-100 border border-stone-200 bg-white">
        {visibleOptions.length ? (
          visibleOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{option.label}</p>
                <p className="text-xs text-stone-400">{option.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingOption({ id: option.id, label: option.label })}
                  className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                  aria-label={`Edit ${option.label}`}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <SearchX className="size-8 text-stone-300" />
            <p className="text-sm text-stone-500">No options match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesFilterPanel({
  categories,
  onCategoriesChange,
  onRename,
  subcategoryCount,
}: {
  categories: FilterCategory[];
  onCategoriesChange: (updater: (prev: FilterCategory[]) => FilterCategory[]) => void;
  onRename: (oldName: string, newName: string) => void;
  subcategoryCount: number;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [hasInitializedOpenGroups, setHasInitializedOpenGroups] = useState(false);
  const [editingItem, setEditingItem] = useState<
    { type: "group"; categoryId: string; label: string } | { type: "subcategory"; categoryId: string; oldName: string; label: string } | null
  >(null);
  const [newSubcategoryInputs, setNewSubcategoryInputs] = useState<Record<string, string>>({});
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  useEffect(() => {
    if (!hasInitializedOpenGroups && categories.length) {
      setOpenGroups(new Set([categories[0].id]));
      setHasInitializedOpenGroups(true);
    }
  }, [categories, hasInitializedOpenGroups]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleCategories = normalizedSearch
    ? categories
        .map((cat) => ({
          ...cat,
          subcategories: cat.label.toLowerCase().includes(normalizedSearch)
            ? cat.subcategories
            : cat.subcategories.filter((sub) => sub.toLowerCase().includes(normalizedSearch)),
        }))
        .filter((cat) => cat.label.toLowerCase().includes(normalizedSearch) || cat.subcategories.length)
    : categories;

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addSubcategory(categoryId: string) {
    const name = (newSubcategoryInputs[categoryId] ?? "").trim();
    if (!name) return;
    onCategoriesChange((prev) => prev.map((cat) => (cat.id === categoryId ? { ...cat, subcategories: [...cat.subcategories, name] } : cat)));
    setNewSubcategoryInputs((prev) => ({ ...prev, [categoryId]: "" }));
  }

  function removeSubcategory(categoryId: string, sub: string) {
    onCategoriesChange((prev) => prev.map((cat) => (cat.id === categoryId ? { ...cat, subcategories: cat.subcategories.filter((s) => s !== sub) } : cat)));
    setEditingItem(null);
  }

  function commitEditSubcategory(categoryId: string, oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== oldName) {
      onCategoriesChange((prev) =>
        prev.map((cat) => (cat.id === categoryId ? { ...cat, subcategories: cat.subcategories.map((s) => (s === oldName ? trimmed : s)) } : cat)),
      );
      onRename(oldName, trimmed);
    }
    setEditingItem(null);
  }

  function commitEditGroupLabel(categoryId: string, newLabel: string) {
    const trimmed = newLabel.trim();
    if (trimmed) onCategoriesChange((prev) => prev.map((cat) => (cat.id === categoryId ? { ...cat, label: trimmed } : cat)));
    setEditingItem(null);
  }

  function removeGroup(categoryId: string) {
    onCategoriesChange((prev) => prev.filter((cat) => cat.id !== categoryId));
    setEditingItem(null);
  }

  function addGroup(label: string, rawId: string) {
    const id = rawId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !label || categories.some((cat) => cat.id === id)) return;
    onCategoriesChange((prev) => [...prev, { id, label, subcategories: [] }]);
    setOpenGroups((prev) => new Set(prev).add(id));
    setIsAddingGroup(false);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Service Categories</h2>
          <p className="mt-1 text-sm text-stone-500">
            {categories.length} groups · {subcategoryCount} subcategories
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsAddingGroup((current) => !current)} className="h-10 rounded-none px-4 text-sm">
          <Plus className="size-4" />
          Add group
        </Button>
      </div>

      {isAddingGroup ? (
        <AddFilterItemDrawer
          title="Add group"
          labelPlaceholder="e.g. Curly Hair"
          idPlaceholder="e.g. curly-hair"
          onClose={() => setIsAddingGroup(false)}
          onSubmit={addGroup}
        />
      ) : null}

      {editingItem?.type === "group" ? (
        <EditFilterItemDrawer
          title="Edit group"
          label={editingItem.label}
          onLabelChange={(value) => setEditingItem({ ...editingItem, label: value })}
          id={editingItem.categoryId}
          onClose={() => setEditingItem(null)}
          onSave={() => commitEditGroupLabel(editingItem.categoryId, editingItem.label)}
          onDelete={() => removeGroup(editingItem.categoryId)}
          deleteLabel={`Remove ${editingItem.label}`}
        />
      ) : null}

      {editingItem?.type === "subcategory" ? (
        <EditFilterItemDrawer
          title="Edit subcategory"
          label={editingItem.label}
          onLabelChange={(value) => setEditingItem({ ...editingItem, label: value })}
          onClose={() => setEditingItem(null)}
          onSave={() => commitEditSubcategory(editingItem.categoryId, editingItem.oldName, editingItem.label)}
          onDelete={() => removeSubcategory(editingItem.categoryId, editingItem.oldName)}
          deleteLabel={`Remove ${editingItem.label}`}
        />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search groups and subcategories..."
          className="h-10 rounded-none pl-9 pr-9 text-sm"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Clear services search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-stone-100 border border-stone-200 bg-white">
        {visibleCategories.length ? (
          visibleCategories.map((cat) => {
            const isOpen = normalizedSearch ? true : openGroups.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => toggleGroup(cat.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                    <ChevronDown className={cn("size-4 shrink-0 text-stone-400 transition-transform", !isOpen && "-rotate-90")} />
                    <span className="truncate font-semibold text-stone-900">{cat.label}</span>
                    <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 px-1.5 text-[11px] font-semibold text-stone-600">
                      {cat.subcategories.length}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem({ type: "group", categoryId: cat.id, label: cat.label })}
                      className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                      aria-label={`Edit ${cat.label}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="divide-y divide-stone-50 border-t border-stone-100 bg-stone-50/40 pl-9">
                    {cat.subcategories.map((sub) => {
                      return (
                        <div key={sub} className="flex items-center gap-3 py-2.5 pr-4">
                          <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{sub}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingItem({ type: "subcategory", categoryId: cat.id, oldName: sub, label: sub })}
                              className="inline-flex size-7 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                              aria-label={`Edit ${sub}`}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 py-2.5 pr-4">
                      <input
                        type="text"
                        value={newSubcategoryInputs[cat.id] ?? ""}
                        onChange={(e) => setNewSubcategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSubcategory(cat.id);
                          }
                        }}
                        placeholder="Add subcategory…"
                        className="h-8 min-w-0 flex-1 rounded-none border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-500"
                      />
                      <Button type="button" variant="outline" onClick={() => addSubcategory(cat.id)} className="h-8 shrink-0 rounded-none px-3 text-xs">
                        Add
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <SearchX className="size-8 text-stone-300" />
            <p className="text-sm text-stone-500">No groups or subcategories match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}

type LocationRegion = { id: string; label: string };

function LocationsFilterPanel({
  regions,
  onRegionsChange,
  parentGroups,
  onParentGroupsChange,
  onStandaloneIdsChange,
}: {
  regions: LocationRegion[];
  onRegionsChange: (updater: (prev: LocationRegion[]) => LocationRegion[]) => void;
  parentGroups: RegionParentGroup[];
  onParentGroupsChange: (updater: (prev: RegionParentGroup[]) => RegionParentGroup[]) => void;
  onStandaloneIdsChange: (updater: (prev: string[]) => string[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRegion, setEditingRegion] = useState<{ id: string; label: string; isParent: boolean; nestedUnderId: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addingSubAreaFor, setAddingSubAreaFor] = useState<string | null>(null);
  const [closedParentIds, setClosedParentIds] = useState<Set<string>>(new Set());

  const parentIdSet = new Set(parentGroups.map((group) => group.parentId));
  const childIdSet = new Set(parentGroups.flatMap((group) => group.childIds));
  const standaloneRegions = regions.filter((r) => !parentIdSet.has(r.id) && !childIdSet.has(r.id));

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (region: LocationRegion) => !normalizedSearch || region.label.toLowerCase().includes(normalizedSearch);
  const visibleStandaloneRegions = standaloneRegions.filter(matchesSearch);
  const parentSections = parentGroups
    .map((group) => {
      const parent = regions.find((r) => r.id === group.parentId) ?? null;
      if (!parent) return null;
      const children = regions.filter((r) => group.childIds.includes(r.id));
      const parentMatches = matchesSearch(parent);
      const visibleChildren = children.filter(matchesSearch);
      return { group, parent, children, parentMatches, visibleChildren };
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
    .filter((section) => !normalizedSearch || section.parentMatches || section.visibleChildren.length > 0);
  const hasAnyResults = parentSections.length > 0 || visibleStandaloneRegions.length > 0;

  function openEditRegion(region: LocationRegion) {
    const owningGroup = parentGroups.find((group) => group.childIds.includes(region.id));
    setEditingRegion({
      id: region.id,
      label: region.label,
      isParent: parentIdSet.has(region.id),
      nestedUnderId: owningGroup?.parentId ?? "",
    });
  }

  function commitEditRegion() {
    if (!editingRegion) return;
    const { id, label, isParent, nestedUnderId } = editingRegion;
    const trimmedLabel = label.trim();
    if (trimmedLabel) {
      onRegionsChange((prev) => prev.map((r) => (r.id === id ? { ...r, label: trimmedLabel } : r)));
    }

    const previousGroup = parentGroups.find((group) => group.parentId === id);
    const orphanedChildIds = !isParent && previousGroup ? previousGroup.childIds : [];

    onParentGroupsChange((prev) => {
      const withoutId = prev.filter((group) => group.parentId !== id).map((group) => ({ ...group, childIds: group.childIds.filter((childId) => childId !== id) }));
      if (isParent) {
        return [...withoutId, { parentId: id, childIds: previousGroup?.childIds ?? [] }];
      }
      if (nestedUnderId) {
        return withoutId.map((group) => (group.parentId === nestedUnderId ? { ...group, childIds: [...group.childIds, id] } : group));
      }
      return withoutId;
    });

    onStandaloneIdsChange((prev) => {
      let next = prev.filter((s) => s !== id);
      if (!isParent && !nestedUnderId) next = [...next, id];
      if (orphanedChildIds.length) next = [...next, ...orphanedChildIds.filter((childId) => !next.includes(childId))];
      return next;
    });

    setClosedParentIds((prev) => {
      const next = new Set(prev);
      if (isParent || nestedUnderId) next.delete(isParent ? id : nestedUnderId);
      return next;
    });

    setEditingRegion(null);
  }

  function removeRegion(id: string) {
    onRegionsChange((prev) => prev.filter((r) => r.id !== id));
    onParentGroupsChange((prev) =>
      prev
        .filter((group) => group.parentId !== id)
        .map((group) => ({ ...group, childIds: group.childIds.filter((childId) => childId !== id) })),
    );
    onStandaloneIdsChange((prev) => prev.filter((c) => c !== id));
    setEditingRegion(null);
  }

  function addRegion(label: string, rawId: string, isParent?: boolean) {
    const id = rawId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !label || regions.some((r) => r.id === id)) return;
    onRegionsChange((prev) => [...prev, { id, label }]);
    if (isParent) {
      onParentGroupsChange((prev) => [...prev, { parentId: id, childIds: [] }]);
    } else {
      onStandaloneIdsChange((prev) => [...prev, id]);
    }
    setIsAdding(false);
  }

  function addSubArea(label: string, rawId: string) {
    const parentId = addingSubAreaFor;
    if (!parentId) return;
    const id = rawId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !label || regions.some((r) => r.id === id)) return;
    onRegionsChange((prev) => [...prev, { id, label }]);
    onParentGroupsChange((prev) => prev.map((group) => (group.parentId === parentId ? { ...group, childIds: [...group.childIds, id] } : group)));
    onStandaloneIdsChange((prev) => prev.filter((s) => s !== id));
    setAddingSubAreaFor(null);
    setClosedParentIds((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
  }

  function toggleParentOpen(parentId: string) {
    setClosedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }

  function renderRegionRow(region: LocationRegion, options: { indent?: boolean } = {}) {
    return (
      <div
        key={region.id}
        className={cn("flex items-center gap-3 py-2.5 pr-4", options.indent ? "border-l-2 border-stone-200 pl-8" : "px-4")}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900">{region.label}</p>
          <p className="text-xs text-stone-400">{region.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => openEditRegion(region)}
            className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label={`Edit ${region.label}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  const nestOptions = parentSections
    .filter((section) => section.group.parentId !== editingRegion?.id)
    .map((section) => ({ value: section.group.parentId, label: section.parent.label }));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Location</h2>
          <p className="mt-1 text-sm text-stone-500">{regions.length} regions</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsAdding((current) => !current)} className="h-10 rounded-none px-4 text-sm">
          <Plus className="size-4" />
          Add location
        </Button>
      </div>

      {isAdding ? (
        <AddFilterItemDrawer
          title="Add location"
          labelPlaceholder="e.g. Surrey"
          idPlaceholder="e.g. surrey"
          onClose={() => setIsAdding(false)}
          onSubmit={addRegion}
          showParentToggle
          parentToggleLabel="This is a parent location (like London)"
        />
      ) : null}

      {addingSubAreaFor ? (
        <AddFilterItemDrawer
          title="Add sub-area"
          labelPlaceholder="e.g. Shoreditch"
          idPlaceholder="e.g. shoreditch"
          onClose={() => setAddingSubAreaFor(null)}
          onSubmit={addSubArea}
        />
      ) : null}

      {editingRegion ? (
        <EditFilterItemDrawer
          title={editingRegion.isParent ? "Edit parent location" : "Edit location"}
          label={editingRegion.label}
          onLabelChange={(value) => setEditingRegion({ ...editingRegion, label: value })}
          id={editingRegion.id}
          onClose={() => setEditingRegion(null)}
          onSave={commitEditRegion}
          onDelete={() => removeRegion(editingRegion.id)}
          deleteLabel={
            editingRegion.isParent
              ? `Remove ${editingRegion.label} (sub-areas move back to Other locations)`
              : `Remove ${editingRegion.label}`
          }
          showParentToggle
          parentToggleLabel="This is a parent location (like London)"
          isParent={editingRegion.isParent}
          onIsParentChange={(value) => setEditingRegion({ ...editingRegion, isParent: value })}
          nestOptions={nestOptions}
          nestedUnderId={editingRegion.nestedUnderId}
          onNestedUnderChange={(value) => setEditingRegion({ ...editingRegion, nestedUnderId: value })}
        />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search locations..."
          className="h-10 rounded-none pl-9 pr-9 text-sm"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Clear locations search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-stone-100 border border-stone-200 bg-white">
        {hasAnyResults ? (
          <>
            {parentSections.map(({ group, parent, children, visibleChildren }) => {
              const isExpanded = normalizedSearch ? true : !closedParentIds.has(group.parentId);
              return (
                <div key={group.parentId}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleParentOpen(group.parentId)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown className={cn("size-4 shrink-0 text-stone-400 transition-transform", !isExpanded && "-rotate-90")} />
                      <span className="truncate font-semibold text-stone-900">{parent.label}</span>
                      <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 px-1.5 text-[11px] font-semibold text-stone-600">
                        {children.length}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAddingSubAreaFor(group.parentId)}
                        className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                        aria-label={`Add sub-area under ${parent.label}`}
                        title="Add sub-area"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRegion(parent)}
                        className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                        aria-label={`Edit ${parent.label}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-stone-100 bg-stone-50/40">
                      {visibleChildren.length ? (
                        visibleChildren.map((child) => renderRegionRow(child, { indent: true }))
                      ) : (
                        <p className="py-4 pl-8 pr-4 text-sm text-stone-400">No sub-areas yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {visibleStandaloneRegions.length ? (
              <div>
                {parentSections.length ? (
                  <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Other locations</p>
                ) : null}
                {visibleStandaloneRegions.map((region) => renderRegionRow(region))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <SearchX className="size-8 text-stone-300" />
            <p className="text-sm text-stone-500">No locations match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}

type AdditionalNeedOption = { id: string; label: string };

function AdditionalNeedsFilterPanel({
  options,
  onOptionsChange,
}: {
  options: AdditionalNeedOption[];
  onOptionsChange: (updater: (prev: AdditionalNeedOption[]) => AdditionalNeedOption[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOption, setEditingOption] = useState<{ id: string; label: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleOptions = normalizedSearch ? options.filter((o) => o.label.toLowerCase().includes(normalizedSearch)) : options;

  function commitEdit(id: string, label: string) {
    const trimmed = label.trim();
    if (trimmed) onOptionsChange((prev) => prev.map((o) => (o.id === id ? { ...o, label: trimmed } : o)));
    setEditingOption(null);
  }

  function removeOption(id: string) {
    onOptionsChange((prev) => prev.filter((o) => o.id !== id));
    setEditingOption(null);
  }

  function addOption(label: string, rawId: string) {
    const id = rawId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || !label || options.some((o) => o.id === id)) return;
    onOptionsChange((prev) => [...prev, { id, label }]);
    setIsAdding(false);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Additional Needs</h2>
          <p className="mt-1 text-sm text-stone-500">{options.length} options</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsAdding((current) => !current)} className="h-10 rounded-none px-4 text-sm">
          <Plus className="size-4" />
          Add option
        </Button>
      </div>

      {isAdding ? (
        <AddFilterItemDrawer
          title="Add option"
          labelPlaceholder="e.g. Pregnancy-safe"
          idPlaceholder="e.g. pregnancySafe"
          onClose={() => setIsAdding(false)}
          onSubmit={addOption}
        />
      ) : null}

      {editingOption ? (
        <EditFilterItemDrawer
          title="Edit option"
          label={editingOption.label}
          onLabelChange={(value) => setEditingOption({ ...editingOption, label: value })}
          id={editingOption.id}
          onClose={() => setEditingOption(null)}
          onSave={() => commitEdit(editingOption.id, editingOption.label)}
          onDelete={() => removeOption(editingOption.id)}
          deleteLabel={`Remove ${editingOption.label}`}
        />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search additional needs..."
          className="h-10 rounded-none pl-9 pr-9 text-sm"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Clear additional needs search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-stone-100 border border-stone-200 bg-white">
        {visibleOptions.length ? (
          visibleOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{option.label}</p>
                <p className="text-xs text-stone-400">{option.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingOption({ id: option.id, label: option.label })}
                  className="inline-flex size-8 items-center justify-center text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                  aria-label={`Edit ${option.label}`}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <SearchX className="size-8 text-stone-300" />
            <p className="text-sm text-stone-500">No options match your search.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PriceRangeFilterPanel({
  tiers,
  onTiersChange,
}: {
  tiers: PriceBandTier[];
  onTiersChange: (updater: (prev: PriceBandTier[]) => PriceBandTier[]) => void;
}) {
  function updateTier(index: number, updates: Partial<PriceBandTier>) {
    onTiersChange((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...updates } : tier)));
  }

  function removeTier(index: number) {
    onTiersChange((prev) => prev.filter((_, i) => i !== index));
  }

  function addTier() {
    onTiersChange((prev) => [...prev, { symbol: "£".repeat(prev.length + 1), label: "", maxAmount: null }]);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Price Range</h2>
          <p className="mt-1 text-sm text-stone-500">{tiers.length} tiers · shared with the automated pricing checker</p>
        </div>
        <Button type="button" variant="outline" onClick={addTier} className="h-10 rounded-none px-4 text-sm">
          <Plus className="size-4" />
          Add tier
        </Button>
      </div>

      <div className="divide-y divide-stone-100 border border-stone-200 bg-white">
        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <PoundSterling className="size-4 shrink-0 text-stone-400" />
            <Input
              value={tier.symbol}
              onChange={(event) => updateTier(index, { symbol: event.target.value })}
              placeholder="£"
              className="h-9 w-20 rounded-none text-sm"
            />
            <Input
              value={tier.label}
              onChange={(event) => updateTier(index, { label: event.target.value })}
              placeholder="e.g. £100-£200"
              className="h-9 min-w-0 flex-1 rounded-none text-sm"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400">Up to £</span>
              <Input
                type="number"
                value={tier.maxAmount ?? ""}
                onChange={(event) => updateTier(index, { maxAmount: event.target.value === "" ? null : Number(event.target.value) })}
                placeholder="No limit"
                className="h-9 w-28 rounded-none text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => removeTier(index)}
              className="inline-flex size-8 shrink-0 items-center justify-center text-red-500 transition hover:bg-red-50"
              aria-label={`Remove ${tier.label || tier.symbol}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-400">Tiers are matched in order by "Up to £" amount; leave it blank for the top, open-ended tier. Publish to update both the manual price pickers and the automated pricing checker.</p>
    </section>
  );
}

function ServicePicker({
  services,
  filterCategories,
  selected,
  onChange,
  label = "Services",
}: {
  services: string[];
  filterCategories?: { id: string; label: string; subcategories: string[] }[];
  selected: string[];
  onChange: (services: string[]) => void;
  label?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const serviceSet = useMemo(() => new Set(services), [services]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const sourceGroups = filterCategories ?? serviceGroups.map((g) => ({ id: g.label, label: g.label, subcategories: g.services }));
  const groups = sourceGroups
    .map((group) => ({
      id: group.id,
      label: group.label,
      services: (group.subcategories.length ? group.subcategories : [group.label]).filter((service) => serviceSet.has(service)),
    }))
    .filter((group) => group.services.length > 0);
  const activeCategory = groups.find((group) => group.id === activeCategoryId) ?? groups[0] ?? null;
  const searchGroups = groups
    .map((group) => ({
      ...group,
      services: group.services.filter((service) => service.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.services.length > 0);
  const visibleSelected = selected.slice(0, 5);
  const hiddenSelectedCount = Math.max(selected.length - visibleSelected.length, 0);

  useEffect(() => {
    if (!groups.length) {
      setActiveCategoryId("");
      return;
    }

    if (!activeCategoryId || !groups.some((group) => group.id === activeCategoryId)) {
      setActiveCategoryId(groups[0].id);
    }
  }, [activeCategoryId, groups]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggle(service: string) {
    onChange(selected.includes(service) ? selected.filter((item) => item !== service) : [...selected, service]);
  }

  function removeSelected(service: string) {
    onChange(selected.filter((item) => item !== service));
  }

  function renderServiceButton(service: string, groupLabel: string) {
    const isSelected = selectedSet.has(service);
    return (
      <button
        key={groupLabel + "-" + service}
        type="button"
        onClick={() => toggle(service)}
        aria-pressed={isSelected}
        aria-label={(isSelected ? "Remove " : "Add ") + service}
        className={cn(
          "flex min-h-8 w-full items-center justify-between gap-2 rounded-none border px-2 py-1.5 text-left text-[11px] font-medium transition",
          isSelected
            ? "border-stone-950 bg-stone-950 text-white"
            : "border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50",
        )}
      >
        <span className="min-w-0 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{service}</span>
        {isSelected ? <Check className="size-3.5 shrink-0" /> : null}
      </button>
    );
  }

  return (
    <div className="relative space-y-3">
      <div className="flex items-end justify-between gap-3">
        {label ? (
          <Field label={label} className="flex-1">
            <ServicePickerTrigger triggerRef={triggerRef} isOpen={isOpen} selected={selected} visibleSelected={visibleSelected} hiddenSelectedCount={hiddenSelectedCount} onToggle={() => setIsOpen((current) => !current)} />
          </Field>
        ) : (
          <div className="flex-1">
            <ServicePickerTrigger triggerRef={triggerRef} isOpen={isOpen} selected={selected} visibleSelected={visibleSelected} hiddenSelectedCount={hiddenSelectedCount} onToggle={() => setIsOpen((current) => !current)} />
          </div>
        )}
      </div>

      {isOpen ? (
        <div
          ref={popoverRef}
          className="mt-2 overflow-hidden rounded-none border border-stone-200 bg-white sm:-ml-[242px] sm:w-[calc(100%+242px)]"
        >
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search services"
                className="h-8 rounded-none border-stone-200 bg-white pl-8 pr-8"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-stone-400 transition hover:text-stone-900"
                  aria-label="Clear service search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-2 min-h-7">
              {selected.length ? (
                <div className="flex flex-wrap gap-1">
                  {selected.map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => removeSelected(service)}
                      aria-label={"Remove " + service}
                      className="inline-flex max-w-full items-center gap-1 rounded-none bg-stone-950 px-1.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-stone-800"
                    >
                      <span className="truncate">{service}</span>
                      <X className="size-3 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-1 text-sm text-stone-400">No services selected</p>
              )}
            </div>
          </div>

          {normalizedQuery ? (
            <div className="max-h-[320px] overflow-y-auto p-2">
              {searchGroups.length ? (
                <div className="space-y-3">
                  {searchGroups.map((group) => (
                    <div key={group.id} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{group.label}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">{group.services.map((service) => renderServiceButton(service, group.label))}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-3 text-sm text-stone-500">No services match</p>
              )}
            </div>
          ) : (
            <div className="grid max-h-[320px] min-h-0 grid-rows-[auto_1fr] md:grid-cols-[180px_1fr] md:grid-rows-1">
              <div className="overflow-x-auto border-b border-stone-100 p-1.5 md:overflow-y-auto md:border-b-0 md:border-r">
                <div className="flex gap-1.5 md:block md:space-y-1">
                  {groups.map((group) => {
                    const selectedCount = group.services.filter((service) => selectedSet.has(service)).length;
                    const isActive = activeCategory?.id === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveCategoryId(group.id)}
                        aria-pressed={isActive}
                        className={cn(
                          "flex shrink-0 items-center justify-between gap-2 rounded-none px-2 py-1.5 text-left text-[11px] font-medium transition md:w-full",
                          isActive ? "bg-stone-950 text-white" : "bg-stone-50 text-stone-700 hover:bg-stone-100",
                        )}
                      >
                        <span className="min-w-0 truncate">{group.label}</span>
                        <span className="inline-flex shrink-0 items-center gap-1">
                          {selectedCount ? (
                            <span className={cn("rounded-none px-1.5 py-0.5 text-[10px]", isActive ? "bg-white text-stone-950" : "bg-stone-950 text-white")}>{selectedCount}</span>
                          ) : null}
                          <span className={cn("text-[10px]", isActive ? "text-stone-200" : "text-stone-400")}>{group.services.length}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-2">
                {activeCategory ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{activeCategory.label}</p>
                      <span className="text-xs text-stone-400">{activeCategory.services.length} services</span>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">{activeCategory.services.map((service) => renderServiceButton(service, activeCategory.label))}</div>
                  </div>
                ) : (
                  <p className="p-3 text-sm text-stone-500">No services available.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ServicePickerTrigger({
  triggerRef,
  isOpen,
  selected,
  visibleSelected,
  hiddenSelectedCount,
  onToggle,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  selected: string[];
  visibleSelected: string[];
  hiddenSelectedCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="min-h-8 w-full rounded-none border border-stone-300 bg-stone-50 px-2 py-1 text-left outline-none transition hover:border-stone-400 focus:border-stone-950"
    >
      {selected.length ? (
        <span className="flex flex-wrap gap-1">
          {visibleSelected.map((service) => (
            <span key={service} className="max-w-full truncate rounded-none bg-stone-100 px-1.5 py-0.5 text-[12px] font-medium text-stone-800">
              {service}
            </span>
          ))}
          {hiddenSelectedCount ? <span className="rounded-none bg-stone-100 px-1.5 py-0.5 text-[12px] font-medium text-stone-500">+{hiddenSelectedCount}</span> : null}
        </span>
      ) : (
        <span className="text-[13px] text-stone-400">Select services</span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  const colorClass =
    status === "ready_to_approve"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "needs_review"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "approved"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span className={cn("inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium capitalize", colorClass)}>
      {label}
    </span>
  );
}

function FreshnessBadge({ status, label }: { status: string; label: string }) {
  const colorClass =
    status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "service"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : status === "possibly_blocked" || status === "unknown"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-800";

  return <span className={cn("rounded-none border px-2 py-0.5 text-xs font-medium capitalize", colorClass)}>{label.replace(/_/g, " ")}</span>;
}

function ServiceSuggestionList({
  label,
  services,
  tone,
  acceptLabel,
  rejectLabel,
  isBusy,
  onAccept,
  onReject,
}: {
  label: string;
  services: string[];
  tone: "add" | "remove";
  acceptLabel: string;
  rejectLabel: string;
  isBusy: boolean;
  onAccept: (service: string) => void;
  onReject: (service: string) => void;
}) {
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", tone === "add" ? "text-emerald-700" : "text-red-700")}>{label}</p>
      <div className="mt-2 space-y-2">
        {services.map((service) => (
          <div key={service} className="flex flex-col gap-2 rounded-none border border-stone-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
            <span className={cn("text-sm", tone === "add" ? "text-emerald-800" : "text-red-800")}>
              {tone === "add" ? "+ " : "- "}
              {service}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccept(service)}
                disabled={isBusy}
                className="rounded-none bg-stone-950 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {acceptLabel}
              </button>
              <button
                type="button"
                onClick={() => onReject(service)}
                disabled={isBusy}
                className="rounded-none border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-50"
              >
                {rejectLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FreshnessSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-4 rounded-none border border-stone-100 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="h-4 w-2/5 animate-pulse rounded-none bg-stone-200" />
            <div className="flex gap-2">
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
              <div className="size-8 animate-pulse rounded-none bg-stone-100" />
            </div>
          </div>
          <div className="h-3 w-1/4 animate-pulse rounded-none bg-stone-100" />
          <div className="rounded-none border border-stone-100 bg-stone-50 p-4">
            <div className="h-4 w-1/3 animate-pulse rounded-none bg-stone-200" />
            <div className="mt-3 h-3 w-4/5 animate-pulse rounded-none bg-stone-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FreshnessMetricSkeleton() {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-stone-200 rounded-none border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="p-5">
          <div className="h-3 w-20 animate-pulse rounded-none bg-stone-200" />
          <div className="mt-3 h-7 w-12 animate-pulse rounded-none bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
      {children}
    </label>
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-20 w-full rounded-none border border-stone-300 bg-stone-50 px-2 py-1.5 text-[13px] outline-none placeholder:text-stone-400 transition hover:border-stone-400 focus:border-stone-950"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }}
        className="h-8 w-full appearance-none rounded-none border border-stone-300 bg-stone-50 pl-2 pr-10 text-[15px] outline-none transition hover:border-stone-400 focus:border-stone-950"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-stone-950" />
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitNoteLines(value: string) {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeLines(current: string[] = [], next: string[] = []) {
  const seen = new Set<string>();
  return [...current, ...next].filter((line) => {
    const normalized = line.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function mergeServices(current: string[], matched: string[]) {
  return [...new Set([...current, ...matched])];
}

function looksLikeHttpUrl(value = "") {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLikelySocialUrl(value = "") {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return /(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)facebook\.com$|(^|\.)linktr\.ee$|(^|\.)linktree\.com$|(^|\.)beacons\.ai$|(^|\.)bio\.site$|(^|\.)campsite\.bio$|(^|\.)solo\.to$/.test(host);
  } catch {
    return true;
  }
}

function buildDraftPricingUpdate(
  priceCheck: AdminPriceCheck | null | undefined,
  draft: StylistDraft,
  source: "auto" | "manual",
  options: { allowOverwriteManual: boolean },
): Partial<StylistDraft> {
  if (!priceCheck?.priceBand) {
    return {};
  }
  if (!options.allowOverwriteManual && draft.priceSource === "manual" && draft.priceBand) {
    return {};
  }
  if (draft.priceBand === priceCheck.priceBand && draft.priceSource === source) {
    return {};
  }

  const checkedAt = new Date().toISOString();
  return {
    priceBand: priceCheck.priceBand,
    servicePriceBand: priceCheck.servicePriceBand || priceCheck.priceBand,
    packagePriceBand: priceCheck.packagePriceBand || "",
    priceIncludesHair: priceCheck.priceIncludesHair === true,
    priceComparisonMode: priceCheck.priceComparisonMode || (priceCheck.packagePriceBand ? "mixed" : "service-only"),
    priceSource: source,
    priceEvidence: (priceCheck.evidence || []).slice(0, 8),
    priceCheckedAt: checkedAt,
    priceUpdatedAt: checkedAt,
    priceConfidence: source === "manual" ? "manual" : priceCheck.confidence === "manual" ? "manual" : priceCheck.confidence || "low",
  };
}

function removeReviewedServices(current: string[], reviewed: string[]) {
  return current.filter((service) => !reviewed.includes(service));
}

function removeReviewedAttributeSuggestions(current: AttributeSuggestion[] = [], update: FreshnessUpdate) {
  return current.filter((suggestion) => {
    if (suggestion.field === "hijabiFriendly") {
      return update.hijabiFriendly !== true && update.rejectHijabiFriendly !== true;
    }
    if (suggestion.field === "wheelchairAccessible") {
      return update.wheelchairAccessible !== true && update.rejectWheelchairAccessible !== true;
    }
    if (suggestion.field === "senFriendly") {
      return update.senFriendly !== true && update.rejectSenFriendly !== true;
    }
    if (suggestion.field === "lgbtqFriendly") {
      return update.lgbtqFriendly !== true && update.rejectLgbtqFriendly !== true;
    }
    if (suggestion.field === "parkingAvailable") {
      return update.parkingAvailable !== true && update.rejectParkingAvailable !== true;
    }
    return true;
  });
}

function removeReviewedLinkChecks(check: DirectoryCheck, update: FreshnessUpdate) {
  const reviewedLinkTypes = new Set<string>();
  if (update.bookingUrl !== undefined) {
    reviewedLinkTypes.add("booking");
  }
  if (update.instagramUrl !== undefined) {
    reviewedLinkTypes.add("instagram");
  }
  const reviewedIssues = new Set(
    check.linkChecks
      .filter((linkCheck) => reviewedLinkTypes.has(linkCheck.type))
      .flatMap((linkCheck) => linkCheck.issues),
  );

  return {
    linkChecks: check.linkChecks.filter((linkCheck) => !reviewedLinkTypes.has(linkCheck.type)),
    issues: check.issues.filter((issue) => !reviewedIssues.has(issue)),
  };
}

function updateChecksAfterFreshnessAction(
  current: DirectoryCheck[],
  check: DirectoryCheck,
  update: FreshnessUpdate,
  serverCheck?: DirectoryCheck | null,
  salon?: Partial<StylistDraft>,
) {
  if (serverCheck) {
    const found = current.some((item) => item.id === check.id);
    return found ? current.map((item) => (item.id === check.id ? serverCheck : item)) : [serverCheck, ...current];
  }
  if (serverCheck === null) {
    return current.filter((item) => item.id !== check.id);
  }

  return current.map((item) =>
    item.id === check.id
      ? {
          ...item,
          bookingUrl: update.bookingUrl ?? item.bookingUrl,
          instagramUrl: update.instagramUrl ?? item.instagramUrl,
          areaId: update.areaId ?? item.areaId,
          areaIds: update.areaIds ?? item.areaIds,
          areaLabel: update.areaLabel ?? item.areaLabel,
          locationReviewIgnored: update.rejectLocation === true ? true : item.locationReviewIgnored,
          hijabiFriendly: update.hijabiFriendly === true ? true : item.hijabiFriendly,
          wheelchairAccessible: update.wheelchairAccessible === true ? true : item.wheelchairAccessible,
          senFriendly: update.senFriendly === true ? true : item.senFriendly,
          lgbtqFriendly: update.lgbtqFriendly === true ? true : item.lgbtqFriendly,
          parkingAvailable: update.parkingAvailable === true ? true : item.parkingAvailable,
          priceCheck: update.priceBand || update.rejectPriceBand ? undefined : item.priceCheck,
          currentServices: salon?.services ?? item.currentServices,
          addedServices: removeReviewedServices(item.addedServices, [...(update.addServices ?? []), ...(update.rejectAddedServices ?? [])]),
          removedServices: removeReviewedServices(item.removedServices, [...(update.removeServices ?? []), ...(update.rejectRemovedServices ?? [])]),
          attributeSuggestions: removeReviewedAttributeSuggestions(item.attributeSuggestions, update),
          ...removeReviewedLinkChecks(item, update),
        }
      : item,
  );
}

function cloneDirectoryCheck(check: DirectoryCheck) {
  return JSON.parse(JSON.stringify(check)) as DirectoryCheck;
}

function getFreshnessUndoLabel(update: FreshnessUpdate) {
  if (update.addServices?.length) {
    return `added ${formatServiceList(update.addServices)}`;
  }
  if (update.removeServices?.length) {
    return `removed ${formatServiceList(update.removeServices)}`;
  }
  if (update.rejectAddedServices?.length || update.rejectRemovedServices?.length) {
    return "rejected recommendation";
  }
  if (update.hijabiFriendly === true) {
    return "marked hijabi-friendly";
  }
  if (update.rejectHijabiFriendly === true) {
    return "ignored hijabi-friendly recommendation";
  }
  if (update.wheelchairAccessible === true) {
    return "marked wheelchair accessible entrance";
  }
  if (update.rejectWheelchairAccessible === true) {
    return "ignored wheelchair accessible entrance recommendation";
  }
  if (update.senFriendly === true) {
    return "marked sensory-safe / SEN-friendly";
  }
  if (update.rejectSenFriendly === true) {
    return "ignored sensory-safe / SEN-friendly recommendation";
  }
  if (update.lgbtqFriendly === true) {
    return "marked LGBTQIA+-friendly";
  }
  if (update.rejectLgbtqFriendly === true) {
    return "ignored LGBTQIA+-friendly recommendation";
  }
  if (update.parkingAvailable === true) {
    return "marked parking nearby";
  }
  if (update.rejectParkingAvailable === true) {
    return "ignored parking nearby recommendation";
  }
  if (update.rejectPriceBand === true) {
    return "ignored price recommendation";
  }
  if (update.areaId || update.areaIds?.length) {
    return "updated location";
  }
  if (update.rejectLocation === true) {
    return "ignored location recommendation";
  }
  return "health check update";
}

function formatServiceList(services: string[]) {
  if (services.length === 1) return services[0];
  return `${services.length} services`;
}
