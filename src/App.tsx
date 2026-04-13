import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, string | number | boolean | null>) => void;
    };
  }
}

const regions = [
  { id: "all", label: "All locations" },
  { id: "london", label: "London" },
  { id: "central", label: "Central" },
  { id: "north", label: "North" },
  { id: "north-west", label: "North West" },
  { id: "east", label: "East" },
  { id: "south-east", label: "South East" },
  { id: "south-west", label: "South West" },
  { id: "west", label: "West" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile" },
] as const;

const nestedLondonRegionIds = ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"] as const;
const standaloneRegionIds = ["kent", "essex", "mobile"] as const;

const categoryMap = {
  all: {
    label: "All services",
    subcategories: ["all"],
  },
  "braiding-services": {
    label: "Braids",
    subcategories: [
      "all",
      "Boho braids",
      "Braid take-down",
      "Box braids",
      "Creative braids",
      "Feed in / All back braids",
      "French curl",
      "Fulani braids",
      "Half braids, half sew-in",
      "Knotless braids",
      "Microbraids",
      "Pre-parting",
      "Stitch braids",
      "Twists",
    ],
  },
  "colour-services": {
    label: "Colour",
    subcategories: ["all", "Balayage", "Full head colour", "Highlights", "Wig colour"],
  },
  "extension-services": {
    label: "Extensions",
    subcategories: ["all", "Clip-ins", "K-tips", "LA weave", "Microlinks", "Tape-ins"],
  },
  "locs-services": {
    label: "Locs",
    subcategories: ["all", "Butterfly locs", "Faux locs", "Microlocs / Sisterlocs", "Retwist", "Starter locs"],
  },
  "sew-in-weave": {
    label: "Sew in / weave",
    subcategories: [
      "all",
      "Closure sew-in",
      "Flipover / Versatile sew-in",
      "Frontal sew-in",
      "Hybrid sew-in",
      "Quick weave",
      "Sew-in take-down",
      "Tracks sewn in",
      "Traditional sew-in",
    ],
  },
  "styling-services": {
    label: "Style / Finish (Sew-in / Relaxer)",
    subcategories: ["all", "Half up half down", "Pixie / finger waves", "Ponytail", "Updo"],
  },
  "straightening-treatments": {
    label: "Treatments",
    subcategories: [
      "all",
      "Hair Botox",
      "Japanese straightening",
      "K-18 treatment",
      "Keratin treatment",
      "Moisturising treatment",
      "Olaplex treatment",
      "Relaxer",
      "Scalp care",
      "Texture release",
    ],
  },
  "natural-hair-services": {
    label: "Wash / Style / Finish (Natural hair)",
    subcategories: [
      "all",
      "Cornrows",
      "Curly cut / Wash & go",
      "Silk press",
      "Trim / Hair cut",
      "Twist out",
      "Wash & blowdry",
    ],
  },
  "wig-services": {
    label: "Wigs",
    subcategories: ["all", "Custom wig", "Wig colour", "Wig install"],
  },
} as const;

type RegionId = (typeof regions)[number]["id"];
type CategoryId = keyof typeof categoryMap;
type SubcategoryId = (typeof categoryMap)[CategoryId]["subcategories"][number];
type ServiceCategoryId = Exclude<CategoryId, "all">;
type ServiceSubcategoryId = Exclude<SubcategoryId, "all">;
type SortOption = "default" | "alphabetical-asc" | "alphabetical-desc" | "most-specialised" | "most-services";

type SalonResult = {
  id: string;
  name: string;
  areaId?: string;
  areaIds?: string[];
  areaLabel: string;
  neighbourhood?: string;
  postcode?: string;
  bookingPlatform: string;
  bookingUrl: string;
  instagramUrl?: string;
  websiteUrl?: string;
  services: string[];
  hijabiFriendly?: boolean;
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
  "north-west": "North West London",
  east: "East London",
  "south-east": "South East London",
  "south-west": "South West London",
  west: "West London",
  south: "South London",
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
  { id: "alphabetical-asc", label: "A → Z" },
  { id: "alphabetical-desc", label: "Z → A" },
  { id: "most-specialised", label: "Most specialised" },
  { id: "most-services", label: "Most services" },
];

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

function sortResults(
  results: SalonResult[],
  sortOption: SortOption,
  _hasActiveFilters: boolean,
  _selectedCategories: ServiceCategoryId[],
  _selectedSubcategories: ServiceSubcategoryId[],
) {
  switch (sortOption) {
    case "alphabetical-asc":
      return [...results].sort(compareSalonNames);
    case "alphabetical-desc":
      return [...results].sort(compareSalonNamesDesc);
    case "most-services":
      return [...results].sort((left, right) => right.services.length - left.services.length || compareSalonNames(left, right));
    case "most-specialised":
      return [...results].sort((left, right) => left.services.length - right.services.length || compareSalonNames(left, right));
    case "default":
    default:
      return [...results].sort(compareSalonNames);
  }
}

function trackUmamiEvent(eventName: string, data?: Record<string, string | number | boolean | null>) {
  window.umami?.track(eventName, data);
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

function orderServicesBySelection(
  services: string[],
  selectedCategories: ServiceCategoryId[],
  selectedSubcategories: ServiceSubcategoryId[],
) {
  if (selectedCategories.length === 0 && selectedSubcategories.length === 0) {
    return services;
  }

  const prioritizedServices = new Set<string>(selectedSubcategories);

  selectedCategories.forEach((categoryId) => {
    categoryMap[categoryId].subcategories.forEach((subcategory) => {
      if (subcategory !== "all") {
        prioritizedServices.add(subcategory);
      }
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

function ServicesSummary({ services }: { services: string[] }) {
  const lineRef = useRef<HTMLDivElement | null>(null);
  const separatorMeasureRef = useRef<HTMLSpanElement | null>(null);
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

      let nextVisibleCount = services.length;

      for (let count = services.length; count >= 0; count -= 1) {
        const hiddenCount = services.length - count;
        const visibleServicesWidth = serviceWidths.slice(0, count).reduce((sum, width) => sum + width, 0);
        const visibleSeparatorsWidth = Math.max(0, count - 1) * separatorWidth;
        const suffixWidth =
          hiddenCount > 0 ? (suffixMeasureRefs.current[hiddenCount]?.offsetWidth ?? 0) + (count > 0 ? separatorWidth : 0) : 0;

        if (visibleServicesWidth + visibleSeparatorsWidth + suffixWidth <= availableWidth - safetyBuffer) {
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
  }, [services]);

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
  const isExpandableOnMobile = isMobileViewport && hiddenCount > 0;
  const isExpandableOnDesktop = !isMobileViewport && hiddenCount > 0;
  const showExpandedList = isExpandableOnMobile && isExpandedOnMobile;
  const showExpandedOnDesktop = isExpandableOnDesktop && isHoveredOnDesktop;
  const collapsedSummary = (
    <>
      {services.slice(0, visibleCount).map((service, index) => (
        <Fragment key={`${service}-${index}`}>
          {index > 0 ? <span className="text-stone-500/70 dark:text-stone-500/80"> · </span> : null}
          <span>{service}</span>
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
            aria-label={fullServicesLabel}
          >
            {showExpandedList ? fullServicesLabel : collapsedSummary}
          </div>
        </>
      ) : showExpandedOnDesktop ? (
        <div ref={lineRef} className="whitespace-normal" aria-label={fullServicesLabel}>
          {fullServicesLabel}
        </div>
      ) : (
        <div ref={lineRef} className="overflow-hidden whitespace-nowrap" aria-label={fullServicesLabel}>
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
            {service}
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

export default function App() {
  const [selectedRegions, setSelectedRegions] = useState<RegionId[]>(["all"]);
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategoryId[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<ServiceSubcategoryId[]>([]);
  const [results, setResults] = useState<SalonResult[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical-asc");
  const [draftSelectedRegions, setDraftSelectedRegions] = useState<RegionId[]>(["all"]);
  const [draftSelectedCategories, setDraftSelectedCategories] = useState<ServiceCategoryId[]>([]);
  const [draftSelectedSubcategories, setDraftSelectedSubcategories] = useState<ServiceSubcategoryId[]>([]);
  const [draftSelectedHijabiFriendly, setDraftSelectedHijabiFriendly] = useState(false);
  const [draftSortOption, setDraftSortOption] = useState<SortOption>("alphabetical-asc");
  const [visibleResultCount, setVisibleResultCount] = useState(RESULTS_BATCH_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedHijabiFriendly, setSelectedHijabiFriendly] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [hijabiHoverLocked, setHijabiHoverLocked] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMobileModalEditing = mobileFiltersOpen && !isDesktopViewport;
  const currentSelectedRegions = isMobileModalEditing ? draftSelectedRegions : selectedRegions;
  const currentSelectedCategories = isMobileModalEditing ? draftSelectedCategories : selectedCategories;
  const currentSelectedSubcategories = isMobileModalEditing ? draftSelectedSubcategories : selectedSubcategories;
  const currentSelectedHijabiFriendly = isMobileModalEditing ? draftSelectedHijabiFriendly : selectedHijabiFriendly;
  const currentSortOption = isMobileModalEditing ? draftSortOption : sortOption;

  function syncDraftFiltersFromApplied() {
    setDraftSelectedRegions(selectedRegions);
    setDraftSelectedCategories(selectedCategories);
    setDraftSelectedSubcategories(selectedSubcategories);
    setDraftSelectedHijabiFriendly(selectedHijabiFriendly);
    setDraftSortOption(sortOption);
  }

  function openMobileFilters() {
    syncDraftFiltersFromApplied();
    trackUmamiEvent("filter_opened", { source: "results_header" });
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
    setSelectedHijabiFriendly(draftSelectedHijabiFriendly);
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

  function updateHijabiFriendly(updater: boolean | ((current: boolean) => boolean)) {
    if (isMobileModalEditing) {
      setDraftSelectedHijabiFriendly(updater);
      return;
    }

    setSelectedHijabiFriendly(updater);
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
      }
      trackUmamiEvent("filter_section_toggled", {
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
      }
      trackUmamiEvent("filter_section_toggled", {
        section: "locations",
        expanded: nextIsOpen,
      });
      return nextIsOpen;
    });
  }

  function clearFilters() {
    trackUmamiEvent("filter_reset", {
      selected_services: currentSelectedCategories.length + currentSelectedSubcategories.length,
      selected_locations: currentSelectedRegions.filter((region) => region !== "all").length,
      hijabi_friendly: currentSelectedHijabiFriendly,
    });
    updateCategories([]);
    updateSubcategories([]);
    updateRegions(["all"]);
    updateHijabiFriendly(false);
    updateSortOption("alphabetical-asc");
  }

  function isCategorySelected(categoryId: ServiceCategoryId) {
    return currentSelectedCategories.includes(categoryId);
  }

  function categoryHasSelectedSubcategories(categoryId: ServiceCategoryId) {
    const availableSubcategories = categoryMap[categoryId].subcategories.filter(
      (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
    );

    return availableSubcategories.some((subcategory) => currentSelectedSubcategories.includes(subcategory));
  }

  function toggleCategory(nextCategory: CategoryId) {
    if (nextCategory === "all") {
      trackUmamiEvent("service_filter_selected", {
        selection: "all",
        selected: currentSelectedCategories.length > 0 || currentSelectedSubcategories.length > 0,
      });
      updateCategories([]);
      updateSubcategories([]);
      return;
    }

    const nextCategoryLabel = categoryMap[nextCategory].label;
    const isCurrentlyActive = currentSelectedCategories.includes(nextCategory as ServiceCategoryId);
    trackUmamiEvent("service_filter_selected", {
      selection: nextCategoryLabel,
      selected: !isCurrentlyActive,
      type: "category",
    });

    updateCategories((currentCategories) => {
      const isActive = currentCategories.includes(nextCategory);
      if (isActive) {
        const nextSubcategories = new Set(
          categoryMap[nextCategory].subcategories.filter(
            (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
          ),
        );

        updateSubcategories((currentSubcategories) =>
          currentSubcategories.filter((subcategory) => !nextSubcategories.has(subcategory)),
        );

        return currentCategories.filter((categoryId) => categoryId !== nextCategory);
      }

      const nextSubcategories = new Set(
        categoryMap[nextCategory].subcategories.filter(
          (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
        ),
      );

      updateSubcategories((currentSubcategories) =>
        currentSubcategories.filter((subcategory) => !nextSubcategories.has(subcategory)),
      );

      return [...currentCategories, nextCategory];
    });
  }

  function toggleSubcategory(nextSubcategory: ServiceSubcategoryId) {
    trackUmamiEvent("service_filter_selected", {
      selection: nextSubcategory,
      selected: !currentSelectedSubcategories.includes(nextSubcategory),
      type: "subcategory",
    });

    const parentCategory = (Object.entries(categoryMap) as [CategoryId, (typeof categoryMap)[CategoryId]][]).find(
      ([categoryId, category]) =>
        categoryId !== "all" && category.subcategories.includes(nextSubcategory as SubcategoryId),
    )?.[0] as ServiceCategoryId | undefined;

    updateSubcategories((currentSubcategories) => {
      const isCurrentlySelected = currentSubcategories.includes(nextSubcategory);
      const nextSubcategories = isCurrentlySelected
        ? currentSubcategories.filter((subcategory) => subcategory !== nextSubcategory)
        : [...currentSubcategories, nextSubcategory];

      if (parentCategory) {
        const parentSubcategories = categoryMap[parentCategory].subcategories.filter(
          (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
        );
        const hasSelectedSiblingSubcategory = parentSubcategories.some((subcategory) => nextSubcategories.includes(subcategory));

        updateCategories((currentCategories) => {
          const categoriesWithoutParent = currentCategories.filter((categoryId) => categoryId !== parentCategory);

          if (hasSelectedSiblingSubcategory) {
            return categoriesWithoutParent;
          }

          return [...categoriesWithoutParent, parentCategory];
        });
      }

      return nextSubcategories;
    });
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

    trackUmamiEvent("location_filter_selected", {
      selection: regionLabel,
      selected: !isCurrentlyActive,
    });

    updateRegions((currentRegions) => {
      if (nextRegion === "all") {
        return ["all"];
      }

      if (nextRegion === "london") {
        return currentRegions.includes("london") ? ["all"] : ["london"];
      }

      if (nestedLondonRegionIds.includes(nextRegion as (typeof nestedLondonRegionIds)[number])) {
        const currentLondonSubregions = currentRegions.filter((regionId) =>
          nestedLondonRegionIds.includes(regionId as (typeof nestedLondonRegionIds)[number]),
        );
        const isActive = currentLondonSubregions.includes(nextRegion);
        const nextLondonSubregions = isActive
          ? currentLondonSubregions.filter((regionId) => regionId !== nextRegion)
          : [...currentLondonSubregions, nextRegion];

        if (nextLondonSubregions.length === 0) {
          return ["london"];
        }

        const nonLondonRegions = currentRegions.filter(
          (regionId) => regionId !== "all" && regionId !== "london" && !nestedLondonRegionIds.includes(regionId as (typeof nestedLondonRegionIds)[number]),
        );

        return [...nonLondonRegions, ...nextLondonSubregions];
      }

      const withoutUmbrellas = currentRegions.filter((regionId) => regionId !== "all" && regionId !== "london");
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
  }, [selectedCategories, selectedSubcategories, selectedRegions, selectedHijabiFriendly]);

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
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFiltersOpen]);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubcategories.length > 0 ||
    selectedHijabiFriendly ||
    selectedRegions.length !== 1 ||
    selectedRegions[0] !== "all";
  const sortedResults = sortResults(results, sortOption, hasActiveFilters, selectedCategories, selectedSubcategories);

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
  const selectedServiceCount = sortedCategoryEntries.reduce((count, [id]) => {
    if (id === "all") {
      return count;
    }

    const categoryId = id as ServiceCategoryId;
    return isCategorySelected(categoryId) || categoryHasSelectedSubcategories(categoryId) ? count + 1 : count;
  }, 0);
  const selectedLocationCount = currentSelectedRegions.filter((regionId) => regionId !== "all").length;

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
                className="min-h-11 px-0 py-2 text-[13px] font-medium text-stone-500 transition hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
              >
                Filter / Sort
              </button>
            </div>
          </div>

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
              {visibleResults.map((result) => {
                const locationLabels = getLocationLabels(result);
                const orderedServices = orderServicesBySelection(result.services, selectedCategories, selectedSubcategories);

                return (
                  <li
                    key={result.id}
                    className="flex w-full flex-col items-start gap-2 border-b border-stone-300 px-0 py-5 text-left last:border-b-0 dark:border-stone-800"
                  >
                    <article className="flex w-full flex-col gap-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-4 sm:gap-y-2.5">
                      <div className="min-w-0">
                        <div className="min-w-0 grow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-end gap-2">
                                <h3 className="text-[17px] font-semibold text-stone-950 dark:text-stone-50">{result.name}</h3>
                                {result.hijabiFriendly ? (
                                  <span className="mb-[3.5px] inline-flex items-center rounded-none bg-emerald-100 p-1 text-[11px] font-medium lowercase leading-none text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    hijabi-friendly
                                  </span>
                                ) : null}
                              </div>
                              {locationLabels.length > 0 ? (
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px] text-stone-500 dark:text-stone-400">
                                  {locationLabels.map((label, index) => (
                                    <Fragment key={label}>
                                      {index > 0 ? <span>•</span> : null}
                                      <span>{label}</span>
                                    </Fragment>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            {result.instagramUrl ? (
                              <a
                                href={result.instagramUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() =>
                                  trackUmamiEvent("instagram_click", {
                                    salon: result.name,
                                    placement: "mobile",
                                  })
                                }
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 sm:hidden"
                              >
                                <InstagramIcon className="size-4" />
                                <span className="sr-only">{result.name} instagram - opens in a new tab</span>
                              </a>
                            ) : null}
                          </div>
                        </div>

                      </div>

                      <div className="order-2 my-1 w-full rounded-none border-l-4 border-stone-300 bg-stone-200/45 pl-2 pr-3 py-2 text-[12px] font-normal lowercase leading-[18px] tracking-[0.02em] text-stone-700 dark:border-stone-700 dark:bg-stone-900/48 dark:text-stone-300 sm:order-3 sm:col-span-2 sm:my-0 lg:mt-2">
                        <ServicesSummary services={orderedServices} />
                      </div>

                      <div className="order-3 mt-2 flex w-full shrink-0 items-center gap-2 sm:order-2 sm:mt-0 sm:h-full sm:w-auto sm:self-stretch sm:items-stretch sm:justify-self-end">
                        {result.instagramUrl ? (
                          <a
                            href={result.instagramUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackUmamiEvent("instagram_click", {
                                salon: result.name,
                                placement: "desktop",
                              })
                            }
                            className="hidden min-h-[46px] items-center justify-center gap-2 rounded-none bg-transparent px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:bg-stone-200 dark:bg-transparent dark:text-stone-100 dark:hover:bg-stone-800 sm:inline-flex sm:h-full sm:min-h-0"
                          >
                            <InstagramIcon className="size-4" />
                            <span className="sr-only">{result.name} instagram - opens in a new tab</span>
                          </a>
                        ) : null}
                        {result.bookingPlatform !== "Instagram" ? (
                          <a
                            href={result.bookingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackUmamiEvent("book_click", {
                                salon: result.name,
                                platform: result.bookingPlatform,
                                location: result.areaLabel,
                              })
                            }
                            className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-none bg-stone-950 px-5 py-2 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300 sm:h-full sm:min-h-0 sm:flex-none sm:px-6"
                          >
                            Book
                            <span className="sr-only"> - {result.name} - opens in a new tab</span>
                          </a>
                        ) : null}
                        {result.websiteUrl && result.websiteUrl !== result.bookingUrl ? (
                          <a
                            href={result.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center rounded-none border border-stone-300 bg-stone-50 px-4 py-2 text-[14px] font-medium text-stone-950 transition-colors duration-150 hover:border-stone-400 hover:bg-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-600 dark:hover:bg-stone-800"
                          >
                            <Globe className="size-4" />
                          </a>
                        ) : null}
                      </div>
                    </article>
                  </li>
                );
              })}
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
              "fixed inset-0 z-50 flex h-dvh min-h-dvh w-full flex-col overflow-hidden border-b-0 bg-stone-100 px-4 py-0 dark:bg-stone-950 sm:px-6 lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:w-72 lg:bg-transparent",
          )}
        >
          <div className="flex items-center justify-between border-b border-stone-300 px-0 py-4 dark:border-stone-800 lg:hidden">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 px-0 py-2 text-[13px] font-medium text-stone-700 transition hover:text-stone-500 dark:text-stone-300 dark:hover:text-stone-50"
              >
                Reset
              </button>
              <h2 className="text-[15px] font-semibold text-stone-950 dark:text-stone-50">Filter / Sort</h2>
              <button
                type="button"
                onClick={cancelMobileFilters}
                className="min-h-11 px-0 py-2 text-[13px] font-medium text-stone-500 transition hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
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
            className="mt-0 flex-1 space-y-6 overflow-y-auto px-0 pt-0 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] [scrollbar-gutter:stable_both-edges] lg:min-h-0 lg:flex-1 lg:space-y-6 lg:overflow-y-scroll lg:px-0 lg:pt-0 lg:pb-6"
          >
            <div className="pt-6">
              <div className="space-y-2">
                <label className="block">
                  <span className="sr-only">Sort results</span>
                  <div className="relative">
                    <select
                      value={currentSortOption}
                      onChange={(event) => {
                        const nextSort = event.target.value as SortOption;
                        trackUmamiEvent("sort_changed", { sort: nextSort });
                        updateSortOption(nextSort);
                      }}
                      className="min-h-11 w-full appearance-none rounded-none border border-stone-300 bg-stone-50 pl-4 pr-12 py-2 text-[13px] text-stone-900 outline-none transition-colors hover:border-stone-400 focus:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500 dark:focus:border-stone-100"
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
                </label>
              </div>
            </div>

            <div className="pt-1">
                <button
                  type="button"
                  aria-pressed={currentSelectedHijabiFriendly}
                  onClick={() => {
                    trackUmamiEvent("hijabi_toggle_changed", {
                      enabled: !currentSelectedHijabiFriendly,
                    });
                    updateHijabiFriendly((current) => !current);
                    setHijabiHoverLocked(true);
                  }}
                  onMouseLeave={() => setHijabiHoverLocked(false)}
                  className="group flex min-h-11 w-full items-center justify-between rounded-none px-0 py-2 text-left"
                >
                  <span
                    className={cn(
                      "text-[15px] font-medium text-stone-950 transition-colors dark:text-stone-100",
                      !hijabiHoverLocked && "group-hover:text-stone-500 dark:group-hover:text-stone-500",
                    )}
                  >
                    Hijabi-friendly
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 rounded-full bg-stone-500 transition-colors dark:bg-stone-500",
                      !hijabiHoverLocked && "group-hover:bg-stone-400 dark:group-hover:bg-stone-600",
                      currentSelectedHijabiFriendly && "bg-stone-950 dark:bg-stone-100",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform dark:bg-stone-950",
                        currentSelectedHijabiFriendly && "translate-x-5",
                      )}
                    />
                  </span>
                </button>
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
                    <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500">Services</span>
                    <span className="flex items-center gap-2">
                      {selectedServiceCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                          {selectedServiceCount}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-500", servicesOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </div>

                <AnimatedCollapsible open={servicesOpen}>
                  <div className="space-y-2 pt-3">
                    {sortedCategoryEntries.map(([id, item]) => {
                      const isAllServices = id === "all";
                      const isActive = isAllServices
                        ? currentSelectedCategories.length === 0 && currentSelectedSubcategories.length === 0
                        : isCategorySelected(id as ServiceCategoryId);
                      const categoryLabelId = makeFilterLabelId("service-category", id);
                      const visibleSubcategories = item.subcategories
                        .filter((subItem) => subItem !== "all")
                        .sort((left, right) => left.localeCompare(right));
                      const showSubcategories =
                        !isAllServices &&
                        (isCategorySelected(id as ServiceCategoryId) || categoryHasSelectedSubcategories(id as ServiceCategoryId));

                      return (
                        <div key={id} className="space-y-2">
                          <button
                            type="button"
                            aria-pressed={isActive}
                            className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
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
                                    className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
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
                                      {itemSubcategory}
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
                      <span className="text-[15px] font-medium text-stone-950 transition-colors group-hover:text-stone-500 dark:text-stone-100 dark:group-hover:text-stone-500">Locations</span>
                      <span className="flex items-center gap-2">
                        {selectedLocationCount > 0 ? (
                          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-stone-950 px-2 text-[11px] font-bold leading-none text-stone-100 transition-colors group-hover:bg-stone-500 dark:bg-stone-100 dark:text-stone-950 dark:group-hover:bg-stone-500">
                            {selectedLocationCount}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn("size-4 text-stone-700 transition-colors transition-transform group-hover:text-stone-500 dark:text-stone-200 dark:group-hover:text-stone-400", locationsOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <AnimatedCollapsible open={locationsOpen}>
                  <div className="space-y-2 pt-3">
                    {(() => {
                      const allLocations = regions.find((item) => item.id === "all");
                      const london = regions.find((item) => item.id === "london");
                      const londonExpanded = isRegionSelected("london") || nestedLondonRegionIds.some((regionId) => isRegionSelected(regionId));
                      const allLocationsLabelId = allLocations ? makeFilterLabelId("region", allLocations.id) : "";
                      const londonLabelId = london ? makeFilterLabelId("region", london.id) : "";

                      return allLocations && london ? (
                        <>
                          <div
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isRegionSelected(allLocations.id)}
                            aria-labelledby={allLocationsLabelId}
                            className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
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

                          <div
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isRegionSelected(london.id)}
                            aria-labelledby={londonLabelId}
                            className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
                            onClick={() => toggleRegion(london.id)}
                            onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(london.id))}
                          >
                            <Checkbox
                              checked={isRegionSelected(london.id)}
                              aria-hidden="true"
                              tabIndex={-1}
                              className="pointer-events-none mt-0.5"
                            />
                            <span id={londonLabelId} className="translate-y-[1.5px] text-[15px] text-stone-800 dark:text-stone-200">
                              {london.label}
                            </span>
                          </div>

                          {londonExpanded ? (
                            <div className="space-y-2 pl-8">
                              {nestedLondonRegionIds.map((regionId) => {
                                const item = regions.find((regionItem) => regionItem.id === regionId);
                                if (!item) return null;
                                const regionLabelId = makeFilterLabelId("region", item.id);

                                return (
                                  <div
                                    role="checkbox"
                                    tabIndex={0}
                                    aria-checked={isRegionSelected(item.id)}
                                    aria-labelledby={regionLabelId}
                                    key={item.id}
                                    className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
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
                        </>
                      ) : null;
                    })()}

                    {standaloneRegionIds.map((regionId) => {
                      const item = regions.find((regionItem) => regionItem.id === regionId);
                      if (!item) return null;
                      const regionLabelId = makeFilterLabelId("region", item.id);

                      return (
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={isRegionSelected(item.id)}
                          aria-labelledby={regionLabelId}
                          key={item.id}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-none px-2 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-stone-900"
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
          </section>
        </aside>
        {mobileFiltersOpen ? (
          <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-stone-300 bg-stone-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-stone-800 dark:bg-stone-950 sm:px-6 lg:hidden">
            <button
              type="button"
              onClick={applyMobileFilters}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-none bg-stone-950 px-5 py-3 text-[14px] font-medium text-stone-100 transition-colors duration-150 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>

      <footer className="mt-auto border-t border-stone-300 px-6 py-4 dark:border-stone-800 sm:px-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[14px] text-stone-700 dark:text-stone-300">ROW K 2026</span>
          <a
            href="https://tally.so/r/VLY10g"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center py-2 text-[14px] text-stone-500 transition hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Submit a stylist
            <span className="sr-only"> - opens in a new tab</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
