import { Fragment, useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const regions = [
  { id: "all", label: "All locations" },
  { id: "london", label: "London" },
  { id: "central", label: "Central" },
  { id: "north", label: "North" },
  { id: "east", label: "East" },
  { id: "south-east", label: "South East" },
  { id: "south-west", label: "South West" },
  { id: "west", label: "West" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile" },
] as const;

const nestedLondonRegionIds = ["central", "north", "east", "south-east", "south-west", "west", "croydon"] as const;
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
      "Feed-in braids",
      "French curl",
      "Fulani braids",
      "Half braids, half sew-in",
      "Knotless braids",
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

function makeFilterLabelId(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLocationLabels(result: SalonResult) {
  const shouldUseDisplayLabel =
    Boolean(result.areaLabel) &&
    Boolean(result.areaId) &&
    Boolean(result.areaIds?.length) &&
    !result.areaIds?.includes(result.areaId ?? "");

  const locationLabels = shouldUseDisplayLabel
    ? [result.areaLabel]
    : [
        ...new Set(
          (result.areaIds?.length ? result.areaIds : result.areaId ? [result.areaId] : [])
            .map((areaId) => regionLabelMap[areaId])
            .filter(Boolean),
        ),
      ];

  if (!locationLabels.length && result.areaLabel) {
    locationLabels.push(result.areaLabel);
  }

  return locationLabels.map((label) => resultLocationLabelMap[label.toLowerCase().replace(/\s+/g, "-")] ?? label);
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

export default function App() {
  const [selectedRegions, setSelectedRegions] = useState<RegionId[]>(["all"]);
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategoryId[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<ServiceSubcategoryId[]>([]);
  const [results, setResults] = useState<SalonResult[]>([]);
  const [visibleResultCount, setVisibleResultCount] = useState(RESULTS_BATCH_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedRegions(["all"]);
  }

  function isCategorySelected(categoryId: ServiceCategoryId) {
    return selectedCategories.includes(categoryId);
  }

  function categoryHasSelectedSubcategories(categoryId: ServiceCategoryId) {
    const availableSubcategories = categoryMap[categoryId].subcategories.filter(
      (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
    );

    return availableSubcategories.some((subcategory) => selectedSubcategories.includes(subcategory));
  }

  function toggleCategory(nextCategory: CategoryId) {
    if (nextCategory === "all") {
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      return;
    }

    setSelectedCategories((currentCategories) => {
      const isActive = currentCategories.includes(nextCategory);
      if (isActive) {
        const nextSubcategories = new Set(
          categoryMap[nextCategory].subcategories.filter(
            (subcategory): subcategory is ServiceSubcategoryId => subcategory !== "all",
          ),
        );

        setSelectedSubcategories((currentSubcategories) =>
          currentSubcategories.filter((subcategory) => !nextSubcategories.has(subcategory)),
        );

        return currentCategories.filter((categoryId) => categoryId !== nextCategory);
      }

      return [...currentCategories, nextCategory];
    });
  }

  function toggleSubcategory(nextSubcategory: ServiceSubcategoryId) {
    setSelectedSubcategories((currentSubcategories) =>
      currentSubcategories.includes(nextSubcategory)
        ? currentSubcategories.filter((subcategory) => subcategory !== nextSubcategory)
        : [...currentSubcategories, nextSubcategory],
    );
  }

  function isRegionSelected(regionId: RegionId) {
    return selectedRegions.includes(regionId);
  }

  function toggleRegion(nextRegion: RegionId) {
    setSelectedRegions((currentRegions) => {
      if (nextRegion === "all") {
        return ["all"];
      }

      if (nextRegion === "london") {
        return currentRegions.includes("london") ? ["all"] : ["london"];
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
  }, [selectedCategories, selectedSubcategories, selectedRegions]);

  useEffect(() => {
    setVisibleResultCount(RESULTS_BATCH_SIZE);
  }, [results]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleResultCount >= results.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleResultCount((currentCount) => Math.min(currentCount + RESULTS_BATCH_SIZE, results.length));
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [results.length, visibleResultCount]);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncMobileFilterState = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
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

  const visibleResults = results.slice(0, visibleResultCount);

  return (
    <div className="min-h-screen bg-white text-left">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex w-full max-w-[1280px] items-start px-4 sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1 py-8">
            <div className="flex flex-col items-start gap-2 px-4">
              <p className="w-full text-left text-xs font-medium uppercase tracking-[0.28em] text-neutral-500">
                Row K LDN
              </p>
              <h1 className="-ml-[0.03em] w-full text-left font-figtree text-[32px] font-semibold leading-[40px] tracking-tight text-neutral-900 sm:text-[40px] sm:leading-[48px] lg:text-[48px]">
                Black hair directory
              </h1>
              <p className="mt-1 w-full max-w-3xl text-left text-sm leading-7 text-neutral-600 sm:text-base">
                Find specialists in coily hair and afro hairstyles across London and the surrounding areas.
              </p>
            </div>
          </div>
          <div className="hidden w-72 flex-none border-l border-transparent pl-8 lg:block" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-col px-4 sm:px-6 lg:flex-row lg:items-start lg:px-10">
        <section id="live-results" className="min-w-0 flex-1 py-6">
          <div className="mb-4 flex w-full items-end justify-between border-b border-neutral-100 px-4 pb-6">
            {hasSearched ? (
              <h2 className="text-[14px] font-medium leading-none text-neutral-500">
                {results.length} {results.length === 1 ? "result" : "results"}
              </h2>
            ) : (
              <h2 className="text-[14px] font-medium leading-none text-neutral-500">Results</h2>
            )}

            <div className="flex items-center gap-2 text-[13px] text-neutral-500 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="min-h-11 rounded-[6px] px-3 py-2 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
              >
                Filter
              </button>
            </div>
          </div>

          {searchError ? (
            <div className="border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-700">
              <p>{searchError}</p>
            </div>
          ) : null}

          {!searchError ? (
            <ul className="flex w-full list-none flex-col items-start">
              {visibleResults.map((result) => {
                const locationLabels = getLocationLabels(result);

                return (
                  <li
                    key={result.id}
                    className="flex w-full flex-col items-start gap-2 border-b border-neutral-100 px-4 py-4 text-left"
                  >
                    <article className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 grow">
                        <h3 className="text-[17px] font-semibold text-neutral-900">{result.name}</h3>
                        {locationLabels.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-neutral-500">
                            {locationLabels.map((label, index) => (
                              <Fragment key={label}>
                                {index > 0 ? <span>•</span> : null}
                                <span>{label}</span>
                              </Fragment>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {result.services.map((service) => (
                            <span
                              key={`${result.id}-${service}`}
                              className="rounded-[2px] bg-neutral-100 px-2 py-0.5 text-[11px] font-normal leading-[16.5px] tracking-[0.02em] text-neutral-600"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                        {result.bookingPlatform !== "Instagram" ? (
                          <a
                            href={result.bookingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-neutral-900 px-4 py-2 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-neutral-700 sm:flex-none"
                          >
                            Book
                            <span className="sr-only"> - {result.name} - opens in a new tab</span>
                          </a>
                        ) : null}
                        {result.instagramUrl ? (
                          <a
                            href={result.instagramUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-neutral-200 bg-white px-4 py-2 text-[14px] font-medium text-neutral-900 transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-100"
                          >
                            <InstagramIcon className="size-4" />
                            <span className="sr-only">{result.name} instagram - opens in a new tab</span>
                          </a>
                        ) : null}
                        {result.websiteUrl && result.websiteUrl !== result.bookingUrl ? (
                          <a
                            href={result.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-neutral-200 bg-white px-4 py-2 text-[14px] font-medium text-neutral-900 transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-100"
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

          {!searchError && visibleResultCount < results.length ? <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" /> : null}

          {!searchError && hasSearched && results.length === 0 ? (
            <div className="border border-dashed border-neutral-200 px-4 py-6 text-sm leading-7 text-neutral-500">
              No qualified salons matched the current filters. Try widening the service or location.
            </div>
          ) : null}
        </section>

        <aside
          className={cn(
            "hidden w-full border-t border-neutral-200 py-6",
            "lg:block lg:w-72 lg:flex-none lg:self-stretch lg:border-t-0 lg:border-l lg:py-6 lg:pl-8",
            mobileFiltersOpen &&
              "fixed inset-0 z-50 flex h-screen w-full flex-col border-b-0 bg-white py-0 lg:static lg:z-auto lg:h-auto lg:w-72 lg:bg-transparent",
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 lg:hidden">
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 px-2 py-2 text-[13px] font-medium text-neutral-600 transition hover:text-neutral-800"
            >
              Reset
            </button>
            <h2 className="text-[15px] font-semibold text-neutral-900">Filters</h2>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="min-h-11 px-2 py-2 text-[13px] font-medium text-neutral-500 transition hover:text-neutral-800"
            >
              Close
            </button>
          </div>

          <div className="relative hidden w-full border-b border-neutral-100 px-2 pb-6 lg:block">
            <h2 className="text-[15px] font-semibold leading-none text-neutral-900">Filters</h2>
            <button
              type="button"
              onClick={clearFilters}
              className="absolute right-2 top-0 inline-flex min-h-11 items-start px-2 py-0 text-[13px] font-medium leading-none text-neutral-600 transition hover:text-neutral-800"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-4 lg:mt-0 lg:flex-none lg:space-y-6 lg:px-0 lg:pb-0">
            <div>
              <p className="px-2 text-[15px] font-medium text-neutral-900">Services</p>
              <div className="mt-2 space-y-2">
                {sortedCategoryEntries.map(([id, item]) => {
                  const isAllServices = id === "all";
                  const isActive = isAllServices
                    ? selectedCategories.length === 0 && selectedSubcategories.length === 0
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
                        className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                        onClick={() => toggleCategory(id as CategoryId)}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-stone-500 bg-white text-white transition",
                            isActive && "border-stone-950 bg-stone-950",
                          )}
                        >
                          {isActive ? <Check className="size-3.5" /> : null}
                        </span>
                        <span id={categoryLabelId} className="text-[15px] text-neutral-800">
                          {item.label}
                        </span>
                      </button>

                      {showSubcategories && visibleSubcategories.length > 0 ? (
                        <div className="space-y-2 pl-8">
                          {visibleSubcategories.map((itemSubcategory) => {
                            const subcategoryLabelId = makeFilterLabelId("service-subcategory", id, itemSubcategory);
                            const isSubcategoryActive = selectedSubcategories.includes(itemSubcategory as ServiceSubcategoryId);

                            return (
                              <button
                                type="button"
                                aria-pressed={isSubcategoryActive}
                                aria-labelledby={subcategoryLabelId}
                                key={itemSubcategory}
                                className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                                onClick={() => toggleSubcategory(itemSubcategory as ServiceSubcategoryId)}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-stone-500 bg-white text-white transition",
                                    isSubcategoryActive && "border-stone-950 bg-stone-950",
                                  )}
                                >
                                  {isSubcategoryActive ? <Check className="size-3.5" /> : null}
                                </span>
                                <span id={subcategoryLabelId} className="text-[15px] text-neutral-800">
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
            </div>

            <div>
              <p className="px-2 text-[15px] font-medium text-neutral-900">Locations</p>
              <div className="mt-2 space-y-2">
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
                        className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                        onClick={() => toggleRegion(allLocations.id)}
                        onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(allLocations.id))}
                      >
                        <Checkbox
                          checked={isRegionSelected(allLocations.id)}
                          aria-hidden="true"
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <span id={allLocationsLabelId} className="text-[15px] text-neutral-800">
                          {allLocations.label}
                        </span>
                      </div>

                      <div
                        role="checkbox"
                        tabIndex={0}
                        aria-checked={isRegionSelected(london.id)}
                        aria-labelledby={londonLabelId}
                        className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                        onClick={() => toggleRegion(london.id)}
                        onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(london.id))}
                      >
                        <Checkbox
                          checked={isRegionSelected(london.id)}
                          aria-hidden="true"
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <span id={londonLabelId} className="text-[15px] text-neutral-800">
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
                                className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                                onClick={() => toggleRegion(item.id)}
                                onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(item.id))}
                              >
                                <Checkbox
                                  checked={isRegionSelected(item.id)}
                                  aria-hidden="true"
                                  tabIndex={-1}
                                  className="pointer-events-none"
                                />
                                <span id={regionLabelId} className="text-[15px] text-neutral-800">
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
                      className="flex w-full cursor-pointer items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                      onClick={() => toggleRegion(item.id)}
                      onKeyDown={(event) => handleToggleKeyDown(event, () => toggleRegion(item.id))}
                    >
                      <Checkbox
                        checked={isRegionSelected(item.id)}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <span id={regionLabelId} className="text-[15px] text-neutral-800">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </aside>
      </div>

      <footer className="mt-auto border-t border-neutral-100 px-6 py-4 sm:px-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[14px] text-neutral-600">ROW K © 2026</span>
          <a
            href="https://tally.so/r/VLY10g"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center py-2 text-[14px] text-neutral-500 transition hover:text-neutral-800"
          >
            Submit a stylist
          </a>
        </div>
      </footer>
    </div>
  );
}
