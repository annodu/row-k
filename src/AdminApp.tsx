import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsRight,
  ClockAlert,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Plus,
  PoundSterling,
  Pencil,
  RefreshCw,
  Save,
  Search,
  SearchCheck,
  Trash2,
  Unlink,
  Undo2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RegionOption = {
  id: string;
  label: string;
};

type StylistDraft = {
  id: string;
  status: string;
  name: string;
  areaId: string;
  areaIds?: string[];
  areaLabel: string;
  neighbourhood: string;
  postcode: string;
  bookingPlatform: string;
  bookingUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  tiktokUrl?: string;
  services: string[];
  rawServices: string[];
  hijabiFriendly?: boolean;
  canBraidWithoutGel?: boolean;
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
};

type PriceBand = "£" | "££" | "£££" | "££££";
type PriceComparisonMode = "service-only" | "mixed" | "package-only";
type AdminView = "overview" | "drafts" | "freshness" | "pricing" | "keyword" | "discovery" | "filters";

type DraftForm = {
  links: string;
  name: string;
  areaId: string;
  rawServices: string;
  services: string[];
  hijabiFriendly: boolean;
  canBraidWithoutGel: boolean;
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
  websiteUrl?: string;
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

type SavedKeywordSearch = {
  id: string;
  name: string;
  keywords: string[];
  status: "research" | "candidate_filter" | "promoted";
  notes?: string;
  resultCount: number;
  results: KeywordSearchResult[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
};

type KeywordSuggestionGroup = {
  service?: string;
  triggers: string[];
  keywords: string[];
};

const londonParentAreaId = "all-london";
const londonChildAreaIds = new Set(["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"]);
const priceBandOptions: { value: "" | PriceBand; label: string }[] = [
  { value: "", label: "Not set" },
  { value: "£", label: "£ under £100" },
  { value: "££", label: "££ £100-£200" },
  { value: "£££", label: "£££ £200-£300" },
  { value: "££££", label: "££££ over £300" },
];
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
    service: "Bouncy blowout / Round Brush Blow dry",
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
  websiteUrl?: string;
  hijabiFriendly?: boolean;
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
  field: "hijabiFriendly";
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
  instagramUrl?: string;
  websiteUrl?: string;
  hijabiFriendly?: boolean;
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
  rejectPriceBand?: boolean;
  rejectLocation?: boolean;
  areaId?: string;
  areaIds?: string[];
  areaLabel?: string;
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
};

const emptyForm: DraftForm = {
  links: "",
  name: "",
  areaId: "",
  rawServices: "",
  services: [],
  hijabiFriendly: false,
  canBraidWithoutGel: false,
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
  { label: "Braids", services: ["Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)"] },
  { label: "Colour", services: ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"] },
  { label: "Bridal", services: ["Bridal"] },
  { label: "Editorial / Session styling", services: ["Editorial / Session styling"] },
  { label: "Extensions", services: ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"] },
  { label: "Locs", services: ["Butterfly locs","Faux locs","Microlocs / sisterlocs","Retwist","Starter locs"] },
  { label: "Sew in / weave", services: ["Closure sew-in","Flipover / Versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"] },
  { label: "Styling (sew in / frontal / relaxer)", services: ["Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie / finger waves","Sleek ponytail / bun","Updo"] },
  { label: "Treatments", services: ["Hair botox","Japanese straightening","K-18 treatment","Keratin treatment","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"] },
  { label: "Natural hair washing & styling", services: ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / Round Brush Blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Wash & blowdry","Japanese head spa","Scalp detox / treatments"] },
  { label: "Natural hair health & trichology", services: ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"] },
  { label: "Wigs", services: ["Custom wig","Pixie wig / weave install","U-part wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry"] },
];

export function AdminApp() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [drafts, setDrafts] = useState<StylistDraft[]>([]);
  const [publishedStylists, setPublishedStylists] = useState<StylistDraft[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [services, setServices] = useState<string[]>([]);
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
  const [intakeText, setIntakeText] = useState("");
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [keywordTerms, setKeywordTerms] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedKeywordService, setSelectedKeywordService] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([]);
  const [keywordProgress, setKeywordProgress] = useState<KeywordSearchProgress>({ checkedCount: 0, total: 0, skippedCount: 0, nextOffset: null });
  const [isRunningKeywordSearch, setIsRunningKeywordSearch] = useState(false);
  const [assigningKeywordServiceIds, setAssigningKeywordServiceIds] = useState<string[]>([]);
  const [savedKeywordSearches, setSavedKeywordSearches] = useState<SavedKeywordSearch[]>([]);
  const [selectedKeywordSearchId, setSelectedKeywordSearchId] = useState("");
  const [keywordSearchName, setKeywordSearchName] = useState("");
  const [isSavingKeywordSearch, setIsSavingKeywordSearch] = useState(false);
  const [stylistStatusFilter, setStylistStatusFilter] = useState("all");
  const [stylistSearchTerm, setStylistSearchTerm] = useState("");
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);
  const [freshnessUndoStack, setFreshnessUndoStack] = useState<FreshnessUndoState[]>([]);
  const lastBookingPreviewKeyRef = useRef("");

	  function updateDraftLocations(draft: StylistDraft, nextAreaIds: string[]) {
	    const normalizedAreaIds = [...new Set(nextAreaIds.filter(Boolean))];
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

      const pricingUpdate = buildDraftPricingUpdate(priceCheck, selectedDraft, "manual", { allowOverwriteManual: false });
      Object.assign(update, pricingUpdate);

      if (Object.keys(update).length) {
        updateStylist(selectedDraft.id, update);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [selectedDraft?.id, selectedDraftRawServices, isAuthed]);

  useEffect(() => {
    if (!isAuthed || !selectedDraft) {
      return;
    }

    const bookingUrl = selectedDraft.bookingUrl?.trim() || "";
    const websiteUrl = selectedDraft.websiteUrl?.trim() || "";
    const previewUrl = bookingUrl || websiteUrl;
    if (!looksLikeHttpUrl(previewUrl) || isLikelySocialUrl(previewUrl)) {
      return;
    }

    const previewKey = `${selectedDraft.id}|${bookingUrl}|${websiteUrl}`;
    if (lastBookingPreviewKeyRef.current === previewKey) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      lastBookingPreviewKeyRef.current = previewKey;
      const preview = await fetchBookingPreview(bookingUrl, websiteUrl);
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
  }, [selectedDraft?.id, selectedDraft?.bookingUrl, selectedDraft?.websiteUrl, isAuthed]);

  async function checkSession() {
    setIsCheckingSession(true);
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
      setIsAuthed(response.ok && payload?.ok === true);
    } catch {
      setIsAuthed(false);
    } finally {
      setIsCheckingSession(false);
    }
  }

  async function loadAdminData() {
    setIsBusy(true);
    try {
      const [draftResponse, publishedResponse, optionResponse, dashboardResponse, discoveryResponse, savedChecksResponse, keywordSearchResponse] = await Promise.all([
        fetch("/api/admin/stylists/drafts", { credentials: "include" }),
        fetch("/api/admin/stylists/published", { credentials: "include" }),
        fetch("/api/admin/stylists/options", { credentials: "include" }),
        fetch("/api/admin/dashboard", { credentials: "include" }),
        fetch("/api/admin/discovery", { credentials: "include" }),
        fetch("/api/admin/stylists/checks/saved", { credentials: "include" }),
        fetch("/api/admin/stylists/keyword-searches", { credentials: "include" }),
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
      const keywordSearchPayload = keywordSearchResponse.ok ? await keywordSearchResponse.json() : null;
      setDrafts(draftPayload.drafts ?? []);
      setPublishedStylists(publishedPayload?.stylists ?? []);
      setRegions(optionPayload.regions ?? []);
      setServices(optionPayload.services ?? []);
      setServiceKeywordSuggestionGroups(optionPayload.keywordSuggestionGroups ?? []);
      setDashboard(dashboardPayload ?? null);
      setSuggestions(discoveryPayload?.suggestions ?? []);
      setChecks(savedChecksPayload?.checks ?? []);
      setChecksLoadedAt(savedChecksPayload?.checkedAt ?? "");
      setSavedKeywordSearches(keywordSearchPayload?.searches ?? []);
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

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/stylists/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
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

  async function createBulkDrafts(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/stylists/intake-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: intakeText,
          priceBand: form.priceBand,
          servicePriceBand: form.servicePriceBand,
          packagePriceBand: form.packagePriceBand,
          priceIncludesHair: form.priceIncludesHair,
          priceComparisonMode: form.priceComparisonMode,
          priceSource: form.priceSource,
          priceEvidence: form.priceEvidence,
          priceCheckedAt: form.priceCheckedAt,
          priceUpdatedAt: form.priceUpdatedAt,
          priceConfidence: form.priceConfidence,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(formatDuplicateResponse(payload) || payload.message || "Could not create drafts.", "error");
        return;
      }
      const createdDrafts = payload.drafts ?? [];
      const duplicateCount = Array.isArray(payload.duplicates) ? payload.duplicates.length : 0;
      setIntakeText("");
      setForm(emptyForm);
      setDrafts((current) => [...createdDrafts, ...current]);
      setSelectedDraftId(createdDrafts[0]?.id ?? null);
      setActiveView("drafts");
      setIsDraftEditorOpen(true);
      notify(
        duplicateCount
          ? `Created ${createdDrafts.length} draft${createdDrafts.length === 1 ? "" : "s"}; skipped ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}.`
          : `Created ${createdDrafts.length} draft${createdDrafts.length === 1 ? "" : "s"}.`,
      );
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
      notify(`${payload.salon.name} was added to the directory.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteStylist(draft: StylistDraft) {
    setMessage("");
    setIsBusy(true);
    try {
      const isPublished = getDraftDisplayStatus(draft) === "published";
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
          body: JSON.stringify({ keywords, selectedService: selectedKeywordService || undefined, offset: nextOffset, limit: 50 }),
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

  async function saveKeywordSearch() {
    const keywords = keywordTerms.map((term) => term.trim()).filter(Boolean);
    if (!keywords.length) {
      setMessage("Add at least one keyword before saving.");
      return;
    }
    const name = keywordSearchName.trim() || titleCase(keywords[0] || "Keyword search");
    setIsSavingKeywordSearch(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/stylists/keyword-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: selectedKeywordSearchId || undefined,
          name,
          keywords,
          results: keywordResults,
          resultCount: keywordResults.length,
          lastRunAt: keywordResults[0]?.checkedAt || new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({ message: "Could not save keyword search." }));
      if (!response.ok) {
        setMessage(payload.message || "Could not save keyword search.");
        return;
      }
      setSavedKeywordSearches(payload.searches ?? []);
      setSelectedKeywordSearchId(payload.search?.id || "");
      setKeywordSearchName(payload.search?.name || name);
      setMessage(`Saved "${payload.search?.name || name}".`);
    } finally {
      setIsSavingKeywordSearch(false);
    }
  }

  async function deleteKeywordSearch(searchId: string) {
    if (!searchId) {
      return;
    }
    setMessage("");
    const response = await fetch(`/api/admin/stylists/keyword-searches/${searchId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({ message: "Could not delete saved search." }));
    if (!response.ok) {
      setMessage(payload.message || "Could not delete saved search.");
      return;
    }
    setSavedKeywordSearches(payload.searches ?? []);
    if (selectedKeywordSearchId === searchId) {
      setSelectedKeywordSearchId("");
      setKeywordSearchName("");
    }
  }

  function loadKeywordSearch(search: SavedKeywordSearch) {
    setSelectedKeywordSearchId(search.id);
    setKeywordSearchName(search.name);
    setKeywordTerms(search.keywords);
    setKeywordInput("");
    setSelectedKeywordService("");
    setKeywordResults(search.results || []);
    setKeywordProgress({
      checkedCount: search.results?.length || 0,
      total: search.resultCount || search.results?.length || 0,
      skippedCount: 0,
      nextOffset: null,
    });
    setActiveView("keyword");
  }

  function selectKeywordService(service: string) {
    setSelectedKeywordService(service);
    if (!service) {
      return;
    }
    const serviceGroups = keywordSuggestionGroups.filter((group) => group.service === service);
    const nextKeywords = serviceGroups.length
      ? [...new Set(serviceGroups.flatMap((group) => group.keywords))]
      : suggestKeywordSearchTerms(service, keywordSuggestionGroups);
    setKeywordTerms(nextKeywords);
    setKeywordInput("");
    setKeywordResults([]);
    setKeywordProgress({ checkedCount: 0, total: 0, skippedCount: 0, nextOffset: null });
    if (!keywordSearchName.trim()) {
      setKeywordSearchName(service);
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
          rejectAddedServices: lastFreshnessUndo.update.rejectAddedServices,
          rejectRemovedServices: lastFreshnessUndo.update.rejectRemovedServices,
          rejectHijabiFriendly: lastFreshnessUndo.update.rejectHijabiFriendly,
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

  async function fetchBookingPreview(bookingUrl: string, websiteUrl: string): Promise<BookingPreview | null> {
    const response = await fetch("/api/admin/stylists/booking-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bookingUrl, websiteUrl }),
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

  const syncLabel = dashboard?.freshness.updatedAt ? `Synced ${formatRelativeTime(dashboard.freshness.updatedAt)}` : "Synced just now";

  return (
    <main className="admin-ui min-h-screen bg-[#f8f8f7] text-stone-950 dark:bg-stone-950 dark:text-stone-50">
      <header className="mx-auto max-w-7xl px-5 pt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex rounded-none bg-stone-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white dark:bg-stone-100 dark:text-stone-950">ROW K ADMIN</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2 text-xs text-stone-500">
              <span className="size-2 rounded-none bg-emerald-500" />
              {syncLabel}
            </span>
            <Button type="button" variant="outline" onClick={logout} className="h-9 rounded-none bg-white px-3 text-xs dark:bg-transparent">
              Log out
            </Button>
          </div>
        </div>

        <nav className="mt-9 flex gap-7 overflow-x-auto border-b border-stone-200 dark:border-stone-800">
          {(["overview", "drafts", "freshness", "pricing", "keyword", "filters"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                "whitespace-nowrap border-b-2 px-0 pb-3 text-sm capitalize transition",
                activeView === view ? "border-stone-950 text-stone-950 dark:border-stone-100 dark:text-stone-50" : "border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
              )}
            >
              {view === "drafts" ? "Stylists" : view === "freshness" ? "Health" : view === "pricing" ? "Pricing" : view === "keyword" ? "Keyword search" : view === "filters" ? "Filters" : view}
            </button>
          ))}
        </nav>
      </header>

      {activeView === "overview" ? (
        <DashboardOverview
          dashboard={dashboard}
          checks={checks}
          publishedCount={publishedStylists.length}
          onOpenView={setActiveView}
        />
      ) : null}

      {activeView === "drafts" ? (
        <StylistsPage
          drafts={filteredStylists}
          allDrafts={allStylists}
          editableDrafts={drafts}
          publishedStylists={publishedStylists}
          dashboard={dashboard}
          statusFilter={stylistStatusFilter}
          searchTerm={stylistSearchTerm}
          isBusy={isBusy}
          intakeText={intakeText}
          selectedDraft={isDraftEditorOpen ? selectedDraft : null}
          regions={regions}
          services={services}
          onStatusFilterChange={setStylistStatusFilter}
          onSearchTermChange={setStylistSearchTerm}
          onIntakeChange={setIntakeText}
          onSubmitIntake={createBulkDrafts}
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
          selectedService={selectedKeywordService}
          services={services}
          suggestionGroups={keywordSuggestionGroups}
          searchName={keywordSearchName}
          savedSearches={savedKeywordSearches}
          results={keywordResults}
          progress={keywordProgress}
          isRunning={isRunningKeywordSearch}
          isSaving={isSavingKeywordSearch}
          assigningServiceIds={assigningKeywordServiceIds}
          onKeywordInputChange={setKeywordInput}
          onKeywordsChange={setKeywordTerms}
          onSelectedServiceChange={selectKeywordService}
          onSearchNameChange={setKeywordSearchName}
          onRun={() => runKeywordSearch(0)}
          onSave={saveKeywordSearch}
          onLoad={loadKeywordSearch}
          onDelete={deleteKeywordSearch}
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

      {activeView === "filters" ? <FiltersPage /> : null}

      <AdminToastMessage toast={toast} onClose={() => setToast(null)} />
    </main>
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
  allDrafts,
  editableDrafts,
  publishedStylists,
  dashboard,
  statusFilter,
  searchTerm,
  isBusy,
  intakeText,
  selectedDraft,
  regions,
  services,
  onStatusFilterChange,
  onSearchTermChange,
  onIntakeChange,
  onSubmitIntake,
  onSelectDraft,
  onCloseEditor,
  onChangeDraft,
  onChangeDraftLocations,
  onSaveDraft,
  onApproveDraft,
  onDeleteDraft,
}: {
  drafts: StylistDraft[];
  allDrafts: StylistDraft[];
  editableDrafts: StylistDraft[];
  publishedStylists: StylistDraft[];
  dashboard: DashboardMetrics | null;
  statusFilter: string;
  searchTerm: string;
  isBusy: boolean;
  intakeText: string;
  selectedDraft: StylistDraft | null;
  regions: RegionOption[];
  services: string[];
  onStatusFilterChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onIntakeChange: (value: string) => void;
  onSubmitIntake: (event: FormEvent) => void;
  onSelectDraft: (draftId: string) => void;
  onCloseEditor: () => void;
  onChangeDraft: (update: Partial<StylistDraft>) => void;
  onChangeDraftLocations: (areaIds: string[]) => void;
  onSaveDraft: () => void;
  onApproveDraft: () => void;
  onDeleteDraft: () => void;
}) {
  const readyDraftCount = editableDrafts.filter((draft) => getDraftDisplayStatus(draft) === "ready_to_publish").length;
  const draftCount = editableDrafts.filter((draft) => getDraftDisplayStatus(draft) === "draft").length;
  const ready = readyDraftCount || dashboard?.drafts.readyToApprove || 0;
  const published = publishedStylists.length || dashboard?.freshness.total || 0;
  const statusLabel = statusFilter === "all" ? "All statuses" : getStylistStatusLabel(statusFilter);

  function submitIntakeOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!isBusy && intakeText.trim()) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-9">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Stylists</h1>
      </section>

      <form onSubmit={onSubmitIntake} className="relative">
        <Plus className="pointer-events-none absolute left-6 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
        <textarea
          value={intakeText}
          onChange={(event) => onIntakeChange(event.target.value)}
          onKeyDown={submitIntakeOnEnter}
          rows={1}
          aria-label="Create draft from link, handle, or notes"
          placeholder="Paste an Instagram link..."
          className="block h-16 min-h-16 w-full resize-none overflow-hidden whitespace-nowrap rounded-none border border-stone-200 bg-white py-5 pl-16 pr-24 text-base leading-6 outline-none placeholder:text-stone-400 focus:border-stone-400"
        />
        <button
          type="submit"
          disabled={isBusy || !intakeText.trim()}
          className="absolute right-3 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-none bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Create draft"
        >
          {isBusy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <StylistMetricCard
          title="Draft"
          value={draftCount}
          icon={<FileText className="size-4" />}
          valueClassName="text-sky-700"
          isActive={statusFilter === "draft"}
          onClick={() => onStatusFilterChange(statusFilter === "draft" ? "all" : "draft")}
        />
        <StylistMetricCard
          title="Ready to Publish"
          value={ready}
          icon={<Check className="size-4" />}
          valueClassName="text-emerald-700"
          isActive={statusFilter === "ready_to_publish"}
          onClick={() => onStatusFilterChange(statusFilter === "ready_to_publish" ? "all" : "ready_to_publish")}
        />
        <StylistMetricCard
          title="Published"
          value={published}
          icon={<CompassDot />}
          isActive={statusFilter === "published"}
          onClick={() => onStatusFilterChange(statusFilter === "published" ? "all" : "published")}
        />
      </div>

      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Stylist entries</h2>
            <p className="mt-1 text-sm text-stone-500">
              {drafts.length} of {allDrafts.length} stylist{allDrafts.length === 1 ? "" : "s"}
              {statusFilter !== "all" ? ` · ${statusLabel}` : ""}
              {searchTerm.trim() ? ` · search: ${searchTerm.trim()}` : ""}
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search stylists"
              aria-label="Search stylist entries"
              className="h-10 rounded-none pl-9 pr-10"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchTermChange("")}
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Clear stylist search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm md:min-w-[900px]">
            <thead className="border-b border-stone-100 text-xs font-medium text-stone-500">
              <tr>
                <th className="px-4 py-3">Stylist</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Completeness</th>
                <th className="hidden px-4 py-3 md:table-cell">Services</th>
                <th className="hidden px-4 py-3 md:table-cell">Location</th>
                <th className="hidden w-28 whitespace-nowrap px-4 py-3 md:table-cell">Last edited</th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Open stylist</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {drafts.length ? (
                drafts.map((draft) => {
                  const completeness = getDraftCompleteness(draft);
                  return (
	                    <tr
	                      key={draft.id}
	                      tabIndex={0}
	                      onClick={() => onSelectDraft(draft.id)}
	                      onKeyDown={(event) => {
	                        if (event.key === "Enter" || event.key === " ") {
	                          event.preventDefault();
	                          onSelectDraft(draft.id);
	                        }
	                      }}
	                      className="cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 focus:bg-stone-50 focus:outline-none last:border-b-0"
	                    >
                      <td className="max-w-[12rem] truncate px-4 py-4 font-medium text-stone-950 sm:max-w-none">{draft.name || "Untitled stylist"}</td>
                      <td className="px-4 py-4">
                        <DraftTableStatusBadge draft={draft} />
                      </td>
                      <td className="hidden px-4 py-4 md:table-cell">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-20 overflow-hidden rounded-none bg-stone-100">
                            <div className="h-full rounded-none bg-stone-950" style={{ width: `${completeness}%` }} />
                          </div>
                          <span className="text-xs text-stone-500">{completeness}%</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-4 text-stone-700 md:table-cell">{draft.services.length}</td>
                      <td className="hidden px-4 py-4 text-stone-700 md:table-cell">{getDraftLocationLabel(draft, regions) || "—"}</td>
                      <td className="hidden w-28 whitespace-nowrap px-4 py-4 text-stone-500 md:table-cell">{formatRelativeTime(draft.updatedAt || draft.createdAt)}</td>
	                      <td className="px-4 py-4">
	                        <span className="inline-flex size-7 items-center justify-center rounded-none text-stone-500">
	                          <ChevronRight className="size-4" />
	                        </span>
	                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">
                    No stylists match those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDraft ? (
        <DraftEditorDrawer
          draft={selectedDraft}
          regions={regions}
          services={services}
          isBusy={isBusy}
          onClose={onCloseEditor}
          onChange={onChangeDraft}
          onChangeLocations={onChangeDraftLocations}
          onSave={onSaveDraft}
          onApprove={onApproveDraft}
          onDelete={onDeleteDraft}
        />
      ) : null}
    </div>
  );
}

function DraftEditorDrawer({
  draft,
  regions,
  services,
  isBusy,
  onClose,
  onChange,
  onChangeLocations,
  onSave,
  onApprove,
  onDelete,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
  isBusy: boolean;
  onClose: () => void;
  onChange: (update: Partial<StylistDraft>) => void;
  onChangeLocations: (areaIds: string[]) => void;
  onSave: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const isPublished = getDraftDisplayStatus(draft) === "published";
  const deleteLabel = isPublished ? "Delete published stylist" : "Delete draft";
  const displayStatus = getDraftDisplayStatus(draft);
  const [activeStep, setActiveStep] = useState<DraftEditorStep>("details");
  const [hasAttemptedPublish, setHasAttemptedPublish] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stepOrder: DraftEditorStep[] = ["details", "services", "review"];
  const activeStepIndex = stepOrder.indexOf(activeStep);
  const canGoBack = activeStepIndex > 0;
  const canGoNext = activeStepIndex < stepOrder.length - 1;

  useEffect(() => {
    setActiveStep("details");
    setHasAttemptedPublish(false);
  }, [draft.id]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeStep, draft.id]);

  function goToPreviousStep() {
    if (canGoBack) {
      setActiveStep(stepOrder[activeStepIndex - 1]);
    }
  }

  function goToNextStep() {
    if (canGoNext) {
      setActiveStep(stepOrder[activeStepIndex + 1]);
    }
  }

  function publishDraft() {
    setHasAttemptedPublish(true);
    onApprove();
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/20 backdrop-blur-[1px]">
      <button type="button" aria-label="Close editor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[628px] flex-col overflow-hidden border-l border-stone-200 bg-white">
        <div className="shrink-0 border-b border-stone-200 px-7 pb-7 pt-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-stone-700">
              <button type="button" onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-none hover:bg-stone-100" aria-label="Close editor">
                <ChevronsRight className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={isBusy}
              className="inline-flex size-8 items-center justify-center rounded-none text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">{draft.name || "Untitled stylist"}</h2>
            <DraftStatusPill status={displayStatus} />
          </div>

          <DraftEditorStepper activeStep={activeStep} onStepChange={setActiveStep} />
        </div>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
          <DraftEditor
            draft={draft}
            regions={regions}
            services={services}
            isBusy={isBusy}
            onChange={onChange}
            onChangeLocations={onChangeLocations}
            onSave={onSave}
            onApprove={onApprove}
            onDelete={onDelete}
            canDelete={!isPublished}
            activeStep={activeStep}
            showWarnings={hasAttemptedPublish}
            isEmbedded
          />
        </div>

        <div className="shrink-0 border-t border-stone-200 bg-white/95 px-7 py-4 backdrop-blur">
          <div className="grid grid-cols-2 gap-4">
            {canGoBack || isPublished ? (
              <Button
                type="button"
                variant="outline"
                onClick={canGoBack ? goToPreviousStep : onSave}
                disabled={isBusy}
                className="h-11 rounded-none bg-white"
              >
                {canGoBack ? <ChevronLeft className="size-4" /> : null}
                {canGoBack ? "Back" : "Save changes"}
              </Button>
            ) : (
              <div aria-hidden="true" />
            )}
            {canGoNext ? (
              <Button type="button" onClick={goToNextStep} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                {activeStep === "details" ? "Services" : "Review"}
                <ChevronRight className="size-4" />
              </Button>
            ) : !isPublished ? (
              <Button type="button" onClick={publishDraft} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                Publish
              </Button>
            ) : (
              <Button type="button" onClick={onSave} disabled={isBusy} className="h-11 rounded-none bg-stone-950">
                Save
              </Button>
            )}
          </div>
        </div>
      </aside>
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-sm font-medium", colorClass)}>
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
  const colorClass =
    status === "ready_to_publish"
      ? "bg-emerald-100 text-emerald-800"
      : status === "published"
        ? "bg-blue-100 text-blue-800"
        : "bg-sky-100 text-sky-800";

  return <span className={cn("rounded-none px-3 py-1 text-xs", colorClass)}>{label}</span>;
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

function getStylistStatusLabel(status: string) {
  if (status === "ready_to_publish") {
    return "Ready to Publish";
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
    draft.websiteUrl,
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
  return Boolean(draft.bookingUrl.trim() || isBookingLikeUrl(draft.websiteUrl));
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
  checks,
  publishedCount,
  onOpenView,
}: {
  dashboard: DashboardMetrics | null;
  checks: DirectoryCheck[];
  publishedCount: number;
  onOpenView: (view: AdminView) => void;
}) {
  const rows = buildFreshnessRecommendationGroups(checks);
  const healthRows = filterFreshnessRowsByDetail(rows, (detail) => detail.kind !== "price" && detail.kind !== "price-info" && detail.kind !== "manual-price");
  const pricingRows = filterFreshnessRowsByDetail(rows, (detail) => detail.kind === "price" || detail.kind === "manual-price");
  const visibleStaleEntries = checks.length ? healthRows.length : dashboard?.freshness.totalIssues || 0;
  const visibleWrongServices = healthRows.filter((row) => row.details.some((detail) => detail.kind === "add" || detail.kind === "remove")).length;
  const visibleBrokenLinks = healthRows.filter((row) => row.details.some((detail) => detail.kind === "fix")).length;
  const visibleManualChecks = healthRows.filter((row) => row.details.some((detail) => detail.kind === "manual")).length;
  const pricingActions = pricingRows.length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-11">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Overview</h1>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard
          title="Stylists"
          value={publishedCount}
          detail={`${dashboard?.drafts.total ?? 0} draft${(dashboard?.drafts.total ?? 0) === 1 ? "" : "s"} · ${dashboard?.drafts.readyToApprove ?? 0} ready · ${publishedCount} published`}
          icon={<FileText className="size-4" />}
          onClick={() => onOpenView("drafts")}
        />
        <DashboardCard
          title="Stale entries"
          value={visibleStaleEntries}
          detail={`${visibleWrongServices} wrong service${visibleWrongServices === 1 ? "" : "s"} · ${visibleBrokenLinks} broken link${visibleBrokenLinks === 1 ? "" : "s"} · ${visibleManualChecks} couldn't verify`}
          icon={<ClockAlert className="size-4" />}
          onClick={() => onOpenView("freshness")}
        />
        <DashboardCard
          title="Pricing"
          value={pricingActions}
          detail="Manual price suggestions and Instagram-only pricing checks"
          icon={<PoundSterling className="size-4" />}
          onClick={() => onOpenView("pricing")}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  detail,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${title}`}
      className={cn(
        "cursor-pointer rounded-none border p-6 text-left transition",
        "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className="mt-5 text-4xl font-semibold leading-none tracking-tight text-stone-950">{value}</p>
      <p className="mt-4 text-sm text-stone-500">{detail}</p>
    </button>
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
  const visibleRows = filteredRows;

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
	              className="inline-flex h-10 items-center gap-2 rounded-none border border-stone-200 bg-white px-3 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
	            >
	              <Undo2 className="size-4" />
	              Undo
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
          <div className="grid gap-5 md:grid-cols-4">
            <FreshnessMetricCard title="Stale entries" value={recommendationCount} icon={<RefreshCw className="size-4" />} isActive={freshnessFilter === "all"} onClick={() => setFreshnessFilter("all")} />
            <FreshnessMetricCard title="Services incorrect" value={serviceChanges} icon={<AlertTriangle className="size-4" />} isActive={freshnessFilter === "service-changes"} onClick={() => setFreshnessFilter(freshnessFilter === "service-changes" ? "all" : "service-changes")} />
            <FreshnessMetricCard title="Link issues" value={linkIssues} icon={<Unlink className="size-4" />} isActive={freshnessFilter === "link-issues"} onClick={() => setFreshnessFilter(freshnessFilter === "link-issues" ? "all" : "link-issues")} />
            <FreshnessMetricCard title="Location updates" value={locationUpdates} icon={<MapPin className="size-4" />} isActive={freshnessFilter === "location-updates"} onClick={() => setFreshnessFilter(freshnessFilter === "location-updates" ? "all" : "location-updates")} />
          </div>
        )}

      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
          {isWaitingForResults ? (
            <FreshnessSkeleton />
          ) : visibleRows.length ? (
            visibleRows.map((row, index) => (
              <FreshnessRecommendationCard key={row.id} row={row} defaultOpen={index === 0} isBusy={isBusy} onApply={onApply} />
            ))
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">All clear</h2>
              <p className="mt-3 max-w-xl text-base text-stone-500">No health issues found. Everything is running smoothly.</p>
              <Button type="button" variant="outline" onClick={onRunChecks} disabled={isRunningChecks} className="mt-8 h-11 rounded-none bg-white px-4 text-sm">
                <RefreshCw className="size-4" />
                Run check again
              </Button>
            </div>
          )}
        </section>
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
  const [pricingView, setPricingView] = useState<"suggestions" | "instagram" | "missing">("suggestions");
  const rows = buildFreshnessRecommendationGroups(checks);
  const suggestionRows = filterFreshnessRowsByDetail(rows, (detail) => detail.kind === "price" && detail.priceAutoApplied !== true);
  const instagramRows = filterFreshnessRowsByDetail(rows, (detail, row) => detail.kind === "manual-price" && detail.manualPriceReason === "social-only" && !hasSavedPriceBand(row.check));
  const missingRows = filterFreshnessRowsByDetail(rows, (detail, row) => detail.kind === "manual-price" && detail.manualPriceReason === "no-price" && !hasSavedPriceBand(row.check));
  const visibleRows = pricingView === "instagram" ? instagramRows : pricingView === "missing" ? missingRows : suggestionRows;
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

      <div className="grid gap-5 md:grid-cols-3">
        <FreshnessMetricCard title="Suggestions" value={suggestionRows.length} icon={<PoundSterling className="size-4" />} isActive={pricingView === "suggestions"} onClick={() => setPricingView("suggestions")} />
        <FreshnessMetricCard title="Instagram only" value={instagramRows.length} icon={<Globe className="size-4" />} isActive={pricingView === "instagram"} onClick={() => setPricingView("instagram")} />
        <FreshnessMetricCard title="No pricing found" value={missingRows.length} icon={<FileText className="size-4" />} isActive={pricingView === "missing"} onClick={() => setPricingView("missing")} />
      </div>

      <section className="overflow-hidden rounded-none border border-stone-200 bg-white">
        {isRunningChecks && !visibleRows.length ? (
          <FreshnessSkeleton />
        ) : visibleRows.length ? (
          visibleRows.map((row, index) => (
            <FreshnessRecommendationCard key={row.id} row={row} defaultOpen={index === 0} isBusy={isBusy} onApply={onApply} />
          ))
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              {pricingView === "instagram" ? "No Instagram-only checks" : pricingView === "missing" ? "No missing price checks" : "No price suggestions"}
            </h2>
            <p className="mt-3 max-w-xl text-base text-stone-500">
              {pricingView === "instagram" ? "No Instagram-only stylists need manual price checking." : pricingView === "missing" ? "No checked booking pages are missing machine-readable prices." : "No price suggestions need review."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function FreshnessMetricCard({ title, value, icon, isActive, onClick }: { title: string; value: number; icon: React.ReactNode; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${title}`}
      className={cn(
        "cursor-pointer rounded-none border border-stone-200 bg-white p-7 text-left transition hover:border-stone-300 active:bg-stone-50",
        isActive
          ? ""
          : "",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{title}</p>
        <span className="text-stone-400">{icon}</span>
      </div>
      <p className="mt-6 text-4xl font-semibold leading-none tracking-tight text-stone-950">{value}</p>
    </button>
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
  const hasWebsiteLinkIssue = row.check.linkChecks.some((linkCheck) => linkCheck.type === "website" && linkCheck.status !== "ok");
  const primaryLinkLabel = hasWebsiteLinkIssue ? "Website URL" : "Booking URL";
  const primaryLinkValue = hasWebsiteLinkIssue ? row.websiteUrl || row.bookingUrl || "" : row.bookingUrl || "";
  const [primaryLinkUrl, setPrimaryLinkUrl] = useState(primaryLinkValue);
  const [instagramUrl, setInstagramUrl] = useState(row.instagramUrl || "");
  const [linkSaveState, setLinkSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const hasLinkIssues = row.details.some((d) => d.kind === "fix" || d.kind === "manual");

  async function handleSaveLinks() {
    setLinkSaveState("saving");
    try {
      const linkUpdate: FreshnessUpdate = hasWebsiteLinkIssue
        ? { websiteUrl: primaryLinkUrl }
        : {
            bookingUrl: primaryLinkUrl,
            ...(row.websiteUrl && urlsMatch(row.websiteUrl, row.bookingUrl) ? { websiteUrl: primaryLinkUrl } : {}),
          };
      await Promise.resolve(onApply(row.check, { ...linkUpdate, instagramUrl }));
      setLinkSaveState("saved");
      setTimeout(() => setLinkSaveState("idle"), 2500);
    } catch {
      setLinkSaveState("idle");
    }
  }

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
        <div className="space-y-3 px-7 pb-6">
          {row.details.map((detail, index) => (
            <FreshnessRecommendationItem
              key={`${row.id}-${detail.label}-${index}`}
              detail={detail}
              row={row}
              isBusy={isBusy}
              onApply={onApply}
              onSaveLinks={handleSaveLinks}
              linkSaveState={linkSaveState}
            />
          ))}
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
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FreshnessRecommendationItem({
  detail,
  row,
  isBusy,
  onApply,
  onSaveLinks,
  linkSaveState,
}: {
  detail: FreshnessRecommendationDetail;
  row: FreshnessRecommendationGroup;
  isBusy: boolean;
  onApply: FreshnessPageApplyHandler;
  onSaveLinks: () => void;
  linkSaveState: "idle" | "saving" | "saved";
}) {
  const isAdd = detail.kind === "add";
  const isRemove = detail.kind === "remove";
  const isManual = detail.kind === "manual";
  const isAttribute = detail.kind === "attribute";
  const isPrice = detail.kind === "price";
  const isManualPrice = detail.kind === "manual-price";
  const isInformational = detail.kind === "price-info";
  const isAutoAppliedPrice = isPrice && detail.priceAutoApplied === true;
  const [selectedPriceBand, setSelectedPriceBand] = useState<PriceBand | "">(detail.priceBand || "");
  const [manualPriceResult, setManualPriceResult] = useState<ManualPriceParseResult | null>(null);
  const visual = getFreshnessDetailVisual(detail);
  const acceptUpdate = getFreshnessDetailAcceptUpdate(detail, row, selectedPriceBand, manualPriceResult);
  const rejectUpdate =
    detail.kind === "add" && detail.service
      ? { rejectAddedServices: [detail.service] }
      : detail.kind === "remove" && detail.service
        ? { rejectRemovedServices: [detail.service] }
        : detail.kind === "attribute" && detail.attributeField === "hijabiFriendly"
          ? { rejectHijabiFriendly: true }
          : detail.kind === "price" || detail.kind === "manual-price"
            ? { rejectPriceBand: true }
            : detail.kind === "location"
              ? { rejectLocation: true }
        : row.rejectUpdate;
  const primaryActionLabel = isAdd ? "Add service" : isRemove ? "Remove" : isAttribute ? "Mark hijabi-friendly" : isPrice || isManualPrice ? "Set band" : detail.kind === "location" ? "Update location" : detail.kind === "fix" ? "Save" : "Resolve";
  const secondaryActionLabel = isAdd ? "Ignore" : isRemove ? "Keep" : "Ignore";
  const sortedPriceValues = [...(detail.priceValues || [])].sort((left, right) => left - right);

  return (
    <div
      className={cn(
        "grid gap-4 rounded-none border border-stone-200 bg-stone-50 px-4 sm:grid-cols-[minmax(0,1fr)_auto]",
        isManual ? "py-3 sm:items-center" : "py-4 sm:items-start",
      )}
    >
      <div className={cn("grid min-w-0 flex-1 gap-4", isManual ? "sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center" : "sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start")}>
        <div className={cn("mt-1 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]", visual.textClass)}>
          <span className={cn("size-3 rounded-none", visual.dotClass)} />
          {visual.label}
        </div>
        <div className="min-w-0">
          <div className={cn("flex min-w-0 flex-wrap items-center", isManual ? "gap-x-5 gap-y-1" : "gap-x-3 gap-y-1")}>
            <p className="font-semibold text-stone-950">{detail.label}</p>
            {detail.kind === "fix" || detail.kind === "manual" || detail.kind === "price" || detail.kind === "price-info" || detail.kind === "review" || detail.kind === "manual-price" ? (
              <p className="text-sm font-medium text-stone-500">{detail.description}</p>
            ) : null}
          </div>
          {sortedPriceValues.length ? (
            <p className="mt-2 text-sm font-semibold text-stone-700">
              {sortedPriceValues.map(formatDetectedPrice).join(", ")}
            </p>
          ) : null}
          {(isPrice && !isAutoAppliedPrice) || isManualPrice ? (
            <ManualPriceCalculator
              detail={detail}
              selectedPriceBand={selectedPriceBand}
              onSelectedPriceBandChange={setSelectedPriceBand}
              onManualPriceResult={setManualPriceResult}
            />
          ) : null}
          {detail.evidence?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.evidence.map((line) => (
                <span key={line} className="rounded-none border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-500">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {detail.kind !== "fix" && !isAutoAppliedPrice && !isInformational ? (
        <div className="flex items-center justify-end gap-2 text-sm font-semibold">
          {isManualPrice ? (() => {
            const linkUrl = detail.manualPriceReason === "social-only"
              ? (row.check.instagramUrl || row.check.bookingUrl || row.check.websiteUrl)
              : (row.check.bookingUrl || row.check.websiteUrl || row.check.instagramUrl);
            return linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-none border border-stone-200 bg-white px-3 py-2 text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
              >
                Open link
              </a>
            ) : null;
          })() : null}
          {isManual ? (
            <button
              type="button"
              disabled={isBusy || linkSaveState === "saving"}
              onClick={onSaveLinks}
              className={cn(
                "inline-flex items-center gap-2 rounded-none border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-35",
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
          ) : null}
          <button
            type="button"
            disabled={isBusy || !rejectUpdate}
            onClick={() => rejectUpdate ? onApply(row.check, rejectUpdate) : undefined}
            className="rounded-none border border-stone-200 bg-white px-3 py-2 text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {secondaryActionLabel}
          </button>
          {!isManual ? (
            <button
              type="button"
              disabled={isBusy || !acceptUpdate || ((isPrice || isManualPrice) && !selectedPriceBand)}
              onClick={() => acceptUpdate ? onApply(row.check, acceptUpdate) : undefined}
              className={cn(
                "rounded-none px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-35",
                isAdd || isAttribute || isPrice || isManualPrice
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
  if (detail.kind === "attribute" && detail.attributeField === "hijabiFriendly") {
    return { hijabiFriendly: true };
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
  websiteUrl?: string;
  acceptUpdate?: {
    addServices?: string[];
    removeServices?: string[];
    hijabiFriendly?: boolean;
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
  kind: "add" | "remove" | "fix" | "manual" | "attribute" | "price" | "price-info" | "location" | "review" | "manual-price";
  label: string;
  description: string;
  service?: string;
  attributeField?: "hijabiFriendly";
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
  reviewTone?: "danger" | "caution";
  manualPriceReason?: "social-only" | "no-price";
};

function getFreshnessDetailVisual(detail: FreshnessRecommendationDetail) {
  if (detail.kind === "add") {
    return { label: "Add", dotClass: "bg-emerald-500", textClass: "text-emerald-700" };
  }
  if (detail.kind === "remove" && detail.reviewTone === "caution") {
    return { label: "Review", dotClass: "bg-sky-500", textClass: "text-sky-700" };
  }
  if (detail.kind === "fix") {
    return { label: "Fix", dotClass: "bg-red-500", textClass: "text-red-700" };
  }
  if (detail.kind === "remove") {
    return { label: "Remove", dotClass: "bg-red-500", textClass: "text-red-700" };
  }
  if (detail.kind === "manual") {
    return { label: "Verify", dotClass: "bg-amber-500", textClass: "text-amber-700" };
  }
  if (detail.kind === "attribute") {
    return { label: "Mark", dotClass: "bg-emerald-500", textClass: "text-emerald-700" };
  }
  if (detail.kind === "price") {
    return { label: "Price", dotClass: "bg-sky-500", textClass: "text-sky-700" };
  }
  if (detail.kind === "price-info") {
    return { label: "Price", dotClass: "bg-stone-400", textClass: "text-stone-600" };
  }
  if (detail.kind === "location") {
    return { label: "Location", dotClass: "bg-violet-500", textClass: "text-violet-700" };
  }
  if (detail.kind === "manual-price") {
    return { label: "Price", dotClass: "bg-amber-500", textClass: "text-amber-700" };
  }
  return { label: "Review", dotClass: "bg-sky-500", textClass: "text-sky-700" };
}

function FreshnessDetailSummary({ details }: { details: FreshnessRecommendationDetail[] }) {
  const counts = details.reduce(
    (summary, detail) => ({
      ...summary,
      [detail.kind === "remove" && detail.reviewTone === "caution" ? "review" : detail.kind]: summary[detail.kind === "remove" && detail.reviewTone === "caution" ? "review" : detail.kind] + 1,
    }),
    { add: 0, remove: 0, fix: 0, manual: 0, attribute: 0, price: 0, "price-info": 0, location: 0, review: 0, "manual-price": 0 } as Record<FreshnessRecommendationDetail["kind"], number>,
  );
  const parts = [
    { count: counts.add, label: "add", className: "bg-emerald-100 text-emerald-700" },
    { count: counts.remove, label: "remove", className: "bg-red-100 text-red-700" },
    { count: counts.fix, label: "link fix", className: "bg-red-100 text-red-700" },
    { count: counts.manual, label: "verify", className: "bg-amber-100 text-amber-700" },
    { count: counts.attribute, label: "profile", className: "bg-emerald-100 text-emerald-700" },
    { count: counts.price, label: "price", className: "bg-sky-100 text-sky-700" },
    { count: counts["price-info"], label: "price check", className: "bg-stone-100 text-stone-600" },
    { count: counts.location, label: "location", className: "bg-violet-100 text-violet-700" },
    { count: counts.review, label: "review", className: "bg-stone-100 text-stone-600" },
    { count: counts["manual-price"], label: "price", className: "bg-amber-100 text-amber-700" },
  ].filter((part) => part.count);

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
    const actionableIssues = check.issues.filter((issue) => isActionableFreshnessIssue(issue, check));
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
          reviewTone: possibleEvidence.length ? "caution" as const : "danger" as const,
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
        label: "Mark hijabi-friendly",
        description: "Explicit hijabi-friendly wording found",
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
      ...actionableIssues.map((issue) => ({
        kind: "review" as const,
        label: "Review listing",
        description: issue,
      })),
    ];

    if (!details.length) {
      return [];
    }

    const hasServiceRecommendations = addedServices.length > 0 || removedServices.length > 0;
    const hasHijabiFriendlyRecommendation = attributeSuggestions.some((suggestion) => suggestion.field === "hijabiFriendly");
    const linkDismissUpdate = getLinkDismissUpdate(check);
    const acceptUpdate = hasServiceRecommendations || hasHijabiFriendlyRecommendation || hasPriceRecommendation
      ? {
          ...(addedServices.length ? { addServices: addedServices } : {}),
          ...(removedServices.length ? { removeServices: removedServices } : {}),
          ...(hasHijabiFriendlyRecommendation ? { hijabiFriendly: true } : {}),
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
    const rejectUpdate = hasServiceRecommendations || hasHijabiFriendlyRecommendation || linkDismissUpdate || hasPriceRecommendation
      ? {
          ...(addedServices.length ? { rejectAddedServices: addedServices } : {}),
          ...(removedServices.length ? { rejectRemovedServices: removedServices } : {}),
          ...(hasHijabiFriendlyRecommendation ? { rejectHijabiFriendly: true } : {}),
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
      websiteUrl: check.websiteUrl,
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
  if (service === "Pixie / finger waves") {
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
  if (service === "Bouncy blowout / Round Brush Blow dry") {
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
  if (service === "Pixie / finger waves") {
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
  if (linkTypes.has("website") && check.websiteUrl !== undefined) {
    update.websiteUrl = check.websiteUrl;
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
  "Creative braids (e.g. patewo)": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids"],
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
  "Tracks (+ silk press) / partial / invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "row sew in", "rows of sew in", "weave tracks", "weave tracks per track", "weave on per row", "traditional weave rows", "partial sew in", "partial sewin", "invisible sew in", "invisible weave", "invisible weft", "invisible wefts"],
  "Bouncy blowout / Round Brush Blow dry": ["bouncy blowout", "bouncy blow out", "bouncy blowdry", "bouncy blow dry", "bouncy blow-dry", "round brush blow dry", "round brush blowdry", "dry bouncy blow-dry", "blowout"],
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

function isActionableFreshnessIssue(issue: string, check: DirectoryCheck) {
  const normalizedIssue = issue.toLowerCase();
  if (normalizedIssue === "possible new services found" || normalizedIssue === "possible removed services found" || normalizedIssue === "possible hijabi-friendly wording found" || normalizedIssue === "possible pricing band found" || normalizedIssue === "manual price check required") {
    return false;
  }
  if (normalizedIssue.includes("instagram") && check.linkChecks.some((linkCheck) => linkCheck.type === "instagram" && linkCheck.status !== "ok")) {
    return false;
  }
  if (normalizedIssue.includes("booking link") && check.bookingUrl) {
    return false;
  }
  return true;
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
  const websiteUrl = row.websiteUrl || row.bookingUrl;
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
      {websiteUrl ? (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${row.stylist} website${bookingBroken ? " (broken)" : ""}`}
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
  selectedService,
  services,
  suggestionGroups,
  searchName,
  savedSearches,
  results,
  progress,
  isRunning,
  isSaving,
  assigningServiceIds,
  onKeywordInputChange,
  onKeywordsChange,
  onSelectedServiceChange,
  onSearchNameChange,
  onRun,
  onSave,
  onLoad,
  onDelete,
  onAssignService,
}: {
  keywords: string[];
  keywordInput: string;
  selectedService: string;
  services: string[];
  suggestionGroups: KeywordSuggestionGroup[];
  searchName: string;
  savedSearches: SavedKeywordSearch[];
  results: KeywordSearchResult[];
  progress: KeywordSearchProgress;
  isRunning: boolean;
  isSaving: boolean;
  assigningServiceIds: string[];
  onKeywordInputChange: (value: string) => void;
  onKeywordsChange: (keywords: string[]) => void;
  onSelectedServiceChange: (service: string) => void;
  onSearchNameChange: (value: string) => void;
  onRun: () => void;
  onSave: () => void;
  onLoad: (search: SavedKeywordSearch) => void;
  onDelete: (searchId: string) => void;
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
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Keyword search</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">Scan live booking and website pages for services or wording that may not be saved in the directory yet.</p>
        </div>
        <Button type="button" variant="outline" onClick={onRun} disabled={isRunning || (keywords.length === 0 && !keywordInput.trim())} className="h-10 rounded-none bg-white px-4">
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
          Run search
        </Button>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="text-lg">Search terms</CardTitle>
            <CardDescription>Select a service to load its aliases, or enter a custom keyword to generate related search terms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Directory service</label>
              <Select value={selectedService} onChange={onSelectedServiceChange}>
                <option value="">Custom keyword search</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="inline-flex items-center gap-2 rounded-none border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950"
                >
                  {keyword}
                  <X className="size-3" />
                </button>
              ))}
              {!keywords.length ? (
                <p className="rounded-none border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500">No keywords selected.</p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={keywordInput}
                onChange={(event) => onKeywordInputChange(event.target.value)}
                placeholder="Enter a keyword, e.g. kids, bridal, locs"
                className="h-10 rounded-none bg-white"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="outline" className="h-10 rounded-none bg-white px-4">
                  <Search className="size-4" />
                  Suggest
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onKeywordsChange([]);
                    onSelectedServiceChange("");
                  }}
                  disabled={!keywords.length && !selectedService}
                  className="h-10 rounded-none bg-white px-4"
                >
                  Clear
                </Button>
              </div>
            </form>

            <div className="grid gap-3 border-t border-stone-200 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                value={searchName}
                onChange={(event) => onSearchNameChange(event.target.value)}
                placeholder="Search name, e.g. Kids services"
                className="h-10 rounded-none bg-white"
              />
              <Button type="button" variant="outline" onClick={onSave} disabled={isSaving || !keywords.length} className="h-10 rounded-none bg-white px-4">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save search
              </Button>
            </div>
          </CardContent>
        </Card>

        <SavedKeywordSearchesPanel searches={savedSearches} onLoad={onLoad} onDelete={onDelete} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 border-b border-stone-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Results</h2>
            <p className="mt-1 text-sm text-stone-500">{progressLabel}{progress.skippedCount ? ` · ${progress.skippedCount} skipped` : ""}</p>
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
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">No matches yet</h2>
              <p className="mt-3 max-w-xl text-base text-stone-500">Run a live keyword search to find matching wording across booking and website pages.</p>
              <Button type="button" variant="outline" onClick={onRun} disabled={isRunning || (keywords.length === 0 && !keywordInput.trim())} className="mt-8 h-11 rounded-none bg-white px-4 text-sm">
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
          <KeywordResultLink href={result.websiteUrl} label="Website" />
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

function SavedKeywordSearchesPanel({
  searches,
  onLoad,
  onDelete,
}: {
  searches: SavedKeywordSearch[];
  onLoad: (search: SavedKeywordSearch) => void;
  onDelete: (searchId: string) => void;
}) {
  return (
    <Card className="rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Saved searches</CardTitle>
        <CardDescription>Research searches you may turn into filters later.</CardDescription>
      </CardHeader>
      <CardContent>
        {searches.length ? (
          <div className="max-h-96 space-y-2 overflow-auto">
            {searches.map((search) => (
              <div key={search.id} className="rounded-none border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onLoad(search)} className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold text-stone-950">{search.name}</p>
                    <p className="mt-1 text-xs text-stone-500">{search.resultCount} result{search.resultCount === 1 ? "" : "s"}{search.lastRunAt ? ` · ${formatRelativeTime(search.lastRunAt)}` : ""}</p>
                  </button>
                  <button type="button" onClick={() => onDelete(search.id)} aria-label={`Delete ${search.name}`} className="text-stone-400 transition hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {search.keywords.slice(0, 6).map((keyword) => (
                    <Badge key={keyword} variant="outline" className="bg-white text-[11px]">
                      {keyword}
                    </Badge>
                  ))}
                  {search.keywords.length > 6 ? (
                    <Badge variant="outline" className="bg-white text-[11px]">+{search.keywords.length - 6}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-none border border-dashed border-stone-300 p-4 text-sm text-stone-500">No saved searches yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordSearchSkeleton({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-none border border-stone-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
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
        <div className="space-y-2">
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
        <div className="space-y-2">
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

function DraftEditor({
  draft,
  regions,
  services,
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
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  services: string[];
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
}) {
  const bookingMatchesInstagram = urlsMatch(draft.bookingUrl, draft.instagramUrl);
  const visibleWarnings = showWarnings ? getVisibleDraftWarnings(draft) : [];
  const selectedAreaIds = getDraftAreaIds(draft);
  const selectedLocationLabels = getAreaIdsForLabels(selectedAreaIds)
    .map((areaId) => regions.find((region) => region.id === areaId)?.label || areaLabelFromId(areaId))
    .filter(Boolean);

  function updateInstagramUrl(instagramUrl: string) {
    onChange({
      instagramUrl,
      ...(bookingMatchesInstagram ? { bookingUrl: instagramUrl } : {}),
    });
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

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Links</p>
        <DraftLinkField
          label="Instagram"
          icon={<InstagramIcon className="size-4" />}
          value={draft.instagramUrl}
          onChange={updateInstagramUrl}
          placeholder="@handle or URL"
          href={draft.instagramUrl}
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
              className="size-4 rounded-none border-stone-300 accent-stone-950 disabled:opacity-40"
            />
            Same as Instagram
          </label>
        </DraftLinkField>
      </div>

      <DraftLocationSelector draft={draft} regions={regions} onChange={onChangeLocations} />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Preferences</p>
        <div className="grid gap-2">
          <DraftBooleanOption
            label="Hijabi friendly"
            checked={draft.hijabiFriendly === true}
            onToggle={(checked) => onChange({ hijabiFriendly: checked })}
          />
          <DraftBooleanOption
            label="Can braid without gel"
            checked={draft.canBraidWithoutGel === true}
            onToggle={(checked) => onChange({ canBraidWithoutGel: checked })}
          />
        </div>
      </div>

      <div className="space-y-3">
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
        <Textarea value={(draft.rawServices || []).join("\n")} onChange={(value) => onChange({ rawServices: splitLines(value) })} />
      </Field>
      <ServicePicker services={services} selected={draft.services} onChange={(next) => onChange({ services: next })} />
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
        <DraftReviewRow label="Locations" value={selectedLocationLabels.length ? selectedLocationLabels.join(", ") : getDraftLocationLabel(draft, regions) || "No location selected"} />
        <DraftReviewRow
          label="Preferences"
          value={[
            draft.hijabiFriendly ? "Hijabi friendly" : "",
            draft.canBraidWithoutGel ? "Can braid without gel" : "",
          ].filter(Boolean).join(", ") || "None selected"}
        />
        <DraftReviewRow label="Pricing" value={draft.priceBand ? `${draft.priceBand} (${draft.priceSource || "manual"})` : "Not set"} />
        <DraftReviewRow label="Services">
          <div className="space-y-3">
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

  const stepContent = activeStep === "details" ? detailsContent : activeStep === "services" ? servicesContent : reviewContent;
  const content = (
    <div className="space-y-7">
      {warningsContent}
      {stepContent}
    </div>
  );

  if (isEmbedded) {
    return (
      <div>{content}</div>
    );
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
  placeholder,
  href,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
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
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-none bg-white" />
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

function DraftLocationSelector({
  draft,
  regions,
  onChange,
}: {
  draft: StylistDraft;
  regions: RegionOption[];
  onChange: (areaIds: string[]) => void;
}) {
  const selectedAreaIds = getDraftAreaIds(draft);
  const london = regions.find((region) => region.id === londonParentAreaId);
  const londonRows = regions.filter((region) => londonChildAreaIds.has(region.id));
  const topLevelRows = [londonParentAreaId, "essex", "kent", "mobile"]
    .map((regionId) => regions.find((region) => region.id === regionId))
    .filter((region): region is RegionOption => Boolean(region));
  const showLondonAreas = selectedAreaIds.includes(londonParentAreaId) || selectedAreaIds.some((areaId) => londonChildAreaIds.has(areaId));

  function toggle(areaId: string) {
    onChange(selectedAreaIds.includes(areaId) ? selectedAreaIds.filter((id) => id !== areaId) : [...selectedAreaIds, areaId]);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Locations</p>
      <div className="grid gap-2">
        {topLevelRows.map((region) => (
          <div key={region.id} className="space-y-2">
            <DraftLocationOption region={region} checked={selectedAreaIds.includes(region.id)} onToggle={() => toggle(region.id)} />
            {region.id === london?.id && showLondonAreas ? (
              <div className="grid gap-2 pl-6 sm:grid-cols-2">
                {londonRows.map((londonRegion) => (
                  <DraftLocationOption
                    key={londonRegion.id}
                    region={londonRegion}
                    checked={selectedAreaIds.includes(londonRegion.id)}
                    onToggle={() => toggle(londonRegion.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftLocationOption({
  region,
  checked,
  onToggle,
  className,
}: {
  region: RegionOption;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-none border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:border-stone-300",
        checked ? "border-stone-400 bg-stone-50" : "",
        className,
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 rounded-none border-stone-300 accent-stone-950" />
      {region.label}
    </label>
  );
}

function DraftBooleanOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-none border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 transition hover:border-stone-300",
        checked ? "border-stone-400 bg-stone-50" : "",
      )}
    >
      <input type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} className="size-4 rounded-none border-stone-300 accent-stone-950" />
      {label}
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
        <div className="grid gap-2 sm:grid-cols-2">
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
  return draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : [];
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
    services: Array.isArray(salon.services) ? salon.services : [],
    rawServices: [],
    hijabiFriendly: salon.hijabiFriendly === true,
    canBraidWithoutGel: salon.canBraidWithoutGel === true,
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
  };
}

function getAreaIdsForLabels(areaIds: string[]) {
  const hasSpecificLondonArea = areaIds.some((areaId) => londonChildAreaIds.has(areaId));
  return hasSpecificLondonArea ? areaIds.filter((areaId) => areaId !== londonParentAreaId) : areaIds;
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

function FiltersPage() {
  const [categories, setCategories] = useState<FilterCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [newSubcategoryInputs, setNewSubcategoryInputs] = useState<Record<string, string>>({});
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  // editing state: "catId" -> editing category label; "catId::subName" -> editing that subcategory
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  // track subcategory renames so the server can migrate stylist records on save
  const [renames, setRenames] = useState<{ from: string; to: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/filters", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setCategories(data.categories);
      });
  }, []);

  function addSubcategory(categoryId: string) {
    const name = (newSubcategoryInputs[categoryId] ?? "").trim();
    if (!name) return;
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, subcategories: [...cat.subcategories, name] } : cat,
      ),
    );
    setNewSubcategoryInputs((prev) => ({ ...prev, [categoryId]: "" }));
  }

  function removeSubcategory(categoryId: string, subcategory: string) {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, subcategories: cat.subcategories.filter((s) => s !== subcategory) } : cat,
      ),
    );
  }

  function startEditSubcategory(categoryId: string, sub: string) {
    setEditing({ key: `${categoryId}::${sub}`, value: sub });
  }

  function commitEditSubcategory(categoryId: string, oldName: string) {
    const newName = editing?.value.trim() ?? "";
    if (newName && newName !== oldName) {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, subcategories: cat.subcategories.map((s) => (s === oldName ? newName : s)) }
            : cat,
        ),
      );
      setRenames((prev) => {
        // If oldName was itself the result of a previous rename, chain it so we
        // only keep the original → latest mapping.
        const existing = prev.find((r) => r.to === oldName);
        if (existing) {
          return prev.map((r) => (r.to === oldName ? { ...r, to: newName } : r));
        }
        return [...prev, { from: oldName, to: newName }];
      });
    }
    setEditing(null);
  }

  function startEditCategoryLabel(cat: FilterCategory) {
    setEditing({ key: cat.id, value: cat.label });
  }

  function commitEditCategoryLabel(categoryId: string) {
    const newLabel = editing?.value.trim() ?? "";
    if (newLabel) {
      setCategories((prev) =>
        prev.map((cat) => (cat.id === categoryId ? { ...cat, label: newLabel } : cat)),
      );
    }
    setEditing(null);
  }

  function addCategory() {
    const id = newCategoryId.trim().toLowerCase().replace(/\s+/g, "-");
    const label = newCategoryLabel.trim();
    if (!id || !label || categories.some((cat) => cat.id === id)) return;
    setCategories((prev) => [...prev, { id, label, subcategories: [] }]);
    setNewCategoryId("");
    setNewCategoryLabel("");
  }

  function removeCategory(categoryId: string) {
    setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
  }

  async function save() {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, renames }),
      });
      const data = await res.json();
      if (data.ok) setRenames([]);
      setSaveMessage({ text: data.ok ? "Saved. Reload the page to see changes take effect." : (data.error ?? "Failed to save."), ok: data.ok });
    } catch {
      setSaveMessage({ text: "Failed to save.", ok: false });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-9">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Filters</h1>
          <p className="mt-2 text-sm text-stone-500">Edit the service categories and subcategories shown in the directory filter panel. Click any name to rename it.</p>
        </div>
        <Button type="button" onClick={save} disabled={isSaving} className="h-10 rounded-none px-4">
          {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save changes
        </Button>
      </section>

      {saveMessage ? (
        <p className={cn("text-sm font-medium", saveMessage.ok ? "text-emerald-700" : "text-red-600")}>{saveMessage.text}</p>
      ) : null}

      <div className="space-y-5">
        {categories.map((cat) => {
          const isEditingLabel = editing?.key === cat.id;
          return (
          <div key={cat.id} className="rounded-none border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isEditingLabel ? (
                  <input
                    autoFocus
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onBlur={() => commitEditCategoryLabel(cat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditCategoryLabel(cat.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-7 rounded-none border border-stone-400 bg-white px-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-stone-500"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditCategoryLabel(cat)}
                    className="group flex items-center gap-1.5 font-semibold text-stone-900 hover:text-stone-600"
                    title="Click to rename"
                  >
                    {cat.label}
                    <Pencil className="size-3 opacity-0 group-hover:opacity-50" />
                  </button>
                )}
                <p className="text-xs text-stone-400">{cat.id}</p>
              </div>
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                className="text-xs font-medium text-stone-400 hover:text-red-600"
              >
                Remove category
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {cat.subcategories.map((sub) => {
                const editKey = `${cat.id}::${sub}`;
                const isEditingSub = editing?.key === editKey;
                return isEditingSub ? (
                  <input
                    key={sub}
                    autoFocus
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onBlur={() => commitEditSubcategory(cat.id, sub)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditSubcategory(cat.id, sub);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-7 rounded-none border border-stone-400 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-stone-500"
                  />
                ) : (
                  <span key={sub} className="group inline-flex items-center gap-1.5 rounded-none border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                    <button
                      type="button"
                      onClick={() => startEditSubcategory(cat.id, sub)}
                      className="hover:text-stone-950"
                      title="Click to rename"
                    >
                      {sub}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSubcategory(cat.id, sub)}
                      className="text-stone-400 hover:text-red-600"
                      aria-label={`Remove ${sub}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newSubcategoryInputs[cat.id] ?? ""}
                onChange={(e) => setNewSubcategoryInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcategory(cat.id); } }}
                placeholder="Add subcategory…"
                className="h-8 flex-1 rounded-none border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
              <Button type="button" variant="outline" onClick={() => addSubcategory(cat.id)} className="h-8 rounded-none px-3 text-xs">
                Add
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="rounded-none border border-dashed border-stone-300 p-5">
        <p className="mb-3 text-sm font-semibold text-stone-700">Add new category</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            placeholder="Label (e.g. Curly Hair)"
            className="h-9 flex-1 rounded-none border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          <input
            type="text"
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            placeholder="ID (e.g. curly-hair-services)"
            className="h-9 flex-1 rounded-none border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          <Button type="button" variant="outline" onClick={addCategory} className="h-9 shrink-0 rounded-none px-4 text-sm">
            Add category
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServicePicker({
  services,
  selected,
  onChange,
}: {
  services: string[];
  selected: string[];
  onChange: (services: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const serviceSet = useMemo(() => new Set(services), [services]);
  const groupedServices = serviceGroups
    .map((group) => ({
      ...group,
      services: group.services.filter(
        (service) => serviceSet.has(service) && (!normalizedQuery || service.toLowerCase().includes(normalizedQuery)),
      ),
    }))
    .filter((group) => group.services.length > 0);

  function toggle(service: string) {
    onChange(selected.includes(service) ? selected.filter((item) => item !== service) : [...selected, service]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <Field label="Matched services" className="flex-1">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filters" />
        </Field>
        <Badge variant="secondary">{selected.length} selected</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.map((service) => (
          <button
            key={service}
            type="button"
            onClick={() => toggle(service)}
            aria-label={`Remove ${service}`}
            className="rounded-none bg-stone-950 px-3 py-1 text-xs text-white"
          >
            {service}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-auto rounded-none border border-stone-200 bg-white p-3">
        {groupedServices.length ? (
          <div className="space-y-4">
            {groupedServices.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.services.map((service) => (
                    <button
                      key={`${group.label}-${service}`}
                      type="button"
                      onClick={() => toggle(service)}
                      aria-label={`${selected.includes(service) ? "Remove" : "Add"} ${service}`}
                      className={cn(
                        "rounded-none px-3 py-2 text-left text-xs transition",
                        selected.includes(service) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                      )}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-3 text-sm text-stone-500">No matching services.</p>
        )}
      </div>
    </div>
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
    <div className="grid gap-5 md:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-none border border-stone-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="h-3 w-28 animate-pulse rounded-none bg-stone-200" />
            <div className="size-4 animate-pulse rounded-none bg-stone-100" />
          </div>
          <div className="mt-5 h-10 w-16 animate-pulse rounded-none bg-stone-200" />
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
      className="min-h-28 w-full rounded-none border border-stone-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-400"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-none border border-stone-200 bg-white px-4 text-sm outline-none focus:border-stone-400"
    >
      {children}
    </select>
  );
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
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
  if (update.hijabiFriendly !== true && update.rejectHijabiFriendly !== true) {
    return current;
  }

  return current.filter((suggestion) => suggestion.field !== "hijabiFriendly");
}

function removeReviewedLinkChecks(check: DirectoryCheck, update: FreshnessUpdate) {
  const reviewedLinkTypes = new Set<string>();
  if (update.bookingUrl !== undefined) {
    reviewedLinkTypes.add("booking");
  }
  if (update.websiteUrl !== undefined) {
    reviewedLinkTypes.add("website");
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
          websiteUrl: update.websiteUrl ?? item.websiteUrl,
          areaId: update.areaId ?? item.areaId,
          areaIds: update.areaIds ?? item.areaIds,
          areaLabel: update.areaLabel ?? item.areaLabel,
          locationReviewIgnored: update.rejectLocation === true ? true : item.locationReviewIgnored,
          hijabiFriendly: update.hijabiFriendly === true ? true : item.hijabiFriendly,
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
