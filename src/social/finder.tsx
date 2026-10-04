// Social Studio — stylist finder: brief filters, name/@handle search, result
// cards and the ordered selection tray that feeds "Build carousel".

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ExternalLink, ImageOff, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Brief, type BriefOptions, type Candidate, EMPTY_BRIEF, describeBrief, resolvePhotoUrl, shortServiceLabel } from "./build";
import { locationTagForAreas } from "./model";
import { getServiceDisplayName, serviceFilterRows, subcategoryGroupsByCategory } from "@/lib/serviceTaxonomy";

// ── Data ───────────────────────────────────────────────────────────────────

export function useBriefOptions() {
  const [options, setOptions] = useState<BriefOptions | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const get = (url: string) => fetch(url, { credentials: "include" }).then((response) => response.json());
    Promise.all([get("/api/admin/filters"), get("/api/admin/stylists/options"), get("/api/admin/price-bands")])
      .then(([filters, stylistOptions, priceBands]) => {
        setOptions({
          categories: filters.categories ?? [],
          // "south" is an admin-only pseudo-region; all-london is "no filter".
          regions: (stylistOptions.regions ?? []).filter((region: { id: string }) => !["south", "all-london"].includes(region.id)),
          priceBands: priceBands.bands ?? [],
        });
      })
      .catch(() => setError("Could not load the filter options."));
  }, []);
  return { options, error };
}

function briefQuery(brief: Brief) {
  const params = new URLSearchParams();
  if (brief.category) params.set("category", brief.category);
  if (brief.service) params.set("service", brief.service);
  if (brief.areaIds.length) params.set("areaIds", brief.areaIds.join(","));
  if (brief.priceBands.length) params.set("priceBands", brief.priceBands.join(","));
  return params;
}

type CandidatesResponse = { ok: boolean; total: number; directoryTotal: number; candidates: Candidate[]; message?: string };

// Throws on any failure so callers can tell "no matches" apart from "the
// search didn't run" (e.g. a dev API server started before this route existed).
async function fetchCandidates(params: URLSearchParams): Promise<CandidatesResponse> {
  const response = await fetch(`/api/admin/social/candidates?${params}`, { credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      response.status === 404
        ? "Stylist search isn't available — restart the admin API server (npm run dev) to pick up the Studio routes."
        : payload?.message || "Stylist search failed. Try again.",
    );
  }
  return payload;
}

export function canFeature(candidate: Candidate) {
  // The @handle is always on the slide, so no Instagram means no slide.
  return Boolean(candidate.handle);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Small pieces ───────────────────────────────────────────────────────────

const chipBase = "inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors";
const chipOff =
  "border-stone-300 bg-white text-stone-600 hover:border-stone-500 hover:text-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:text-stone-100";
const chipOn = "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn(chipBase, active ? chipOn : chipOff)}>
      {children}
    </button>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Thumb({ src, className }: { src?: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-[repeating-linear-gradient(135deg,#e7e5e4_0_8px,#f5f5f4_8px_16px)] text-stone-400 dark:bg-[repeating-linear-gradient(135deg,#292524_0_8px,#1c1917_8px_16px)]", className)}>
        <ImageOff className="size-3.5" />
      </div>
    );
  }
  return <img src={resolvePhotoUrl(src)} alt="" loading="lazy" className={cn("object-cover", className)} />;
}

// ── Brief bar ──────────────────────────────────────────────────────────────

export type Sort = "photos" | "reviews" | "recent";

function BriefBar({ brief, onChange, options, sort, onSortChange }: { brief: Brief; onChange: (brief: Brief) => void; options: BriefOptions; sort: Sort; onSortChange: (sort: Sort) => void }) {
  const serviceValue = brief.service ? `svc:${brief.category}:${brief.service}` : brief.category ? `cat:${brief.category}` : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1 space-y-1.5 sm:max-w-sm">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Service</span>
          <select
            value={serviceValue}
            onChange={(event) => {
              const [kind, category, ...rest] = event.target.value.split(":");
              if (!kind) onChange({ ...brief, category: "", service: "" });
              else if (kind === "cat") onChange({ ...brief, category, service: "" });
              else onChange({ ...brief, category, service: rest.join(":") });
            }}
            className="h-10 w-full rounded-none border border-stone-300 bg-white px-3 text-sm text-stone-950 hover:border-stone-400 focus-visible:border-stone-950 focus-visible:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          >
            <option value="">Any service</option>
            {options.categories.map((category) => (
              <optgroup key={category.id} label={category.label}>
                <option value={`cat:${category.id}`}>All {category.label.toLowerCase()}</option>
                {/* Same styles and families as the site's filter list, every family open. */}
                {serviceFilterRows(category.id, category.subcategories, [...category.subcategories, ...(subcategoryGroupsByCategory[category.id] ?? [])]).map(({ service, nested }) => (
                  <option key={service} value={`svc:${category.id}:${service}`}>
                    {`${nested ? "\u00a0\u00a0\u00a0\u00a0" : ""}${getServiceDisplayName(service)}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Sort</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as Sort)}
            className="h-10 rounded-none border border-stone-300 bg-white px-3 text-sm text-stone-950 focus-visible:border-stone-950 focus-visible:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          >
            <option value="photos">Most photos</option>
            <option value="reviews">Most reviews</option>
            <option value="recent">Recently added</option>
          </select>
        </label>
        {brief !== EMPTY_BRIEF && (brief.category || brief.areaIds.length || brief.priceBands.length) ? (
          <button type="button" onClick={() => onChange(EMPTY_BRIEF)} className="h-10 text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-stone-100">
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Area</span>
        {options.regions.map((region) => (
          <Chip key={region.id} active={brief.areaIds.includes(region.id)} onClick={() => onChange({ ...brief, areaIds: toggle(brief.areaIds, region.id) })}>
            {region.label.replace(/ London$/i, "")}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Price</span>
        {options.priceBands.map((band) => (
          <Chip key={band.symbol} active={brief.priceBands.includes(band.symbol)} onClick={() => onChange({ ...brief, priceBands: toggle(brief.priceBands, band.symbol) })}>
            <span className="font-semibold">{band.symbol}</span>
            <span className="opacity-70">{band.label}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Name search ────────────────────────────────────────────────────────────

export function StylistNameSearch({
  brief,
  selectedIds,
  onAdd,
  placeholder = "Add a stylist by name or @handle",
  autoFocus = false,
  dropdownAlign = "right",
  resultsInline = false,
}: {
  brief: Brief;
  selectedIds: Set<string>;
  onAdd: (candidate: Candidate) => void;
  placeholder?: string;
  autoFocus?: boolean;
  // Which edge the (wider-than-input) results panel lines up with.
  dropdownAlign?: "left" | "right";
  // Render results in the flow (inside a popover) instead of as a dropdown.
  resultsInline?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearchError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = briefQuery(brief);
      params.set("q", term);
      params.set("limit", "8");
      fetchCandidates(params)
        .then((payload) => {
          if (cancelled) return;
          setSearchError("");
          setResults(payload.candidates);
        })
        .catch((error: Error) => {
          if (cancelled) return;
          setSearchError(error.message);
          setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, brief]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-none border border-stone-300 bg-white pl-9 pr-9 text-sm text-stone-950 placeholder:text-stone-400 hover:border-stone-400 focus-visible:border-stone-950 focus-visible:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-stone-400" /> : null}
      </div>

      {open && results ? (
        <div
          className={cn(
            "overflow-y-auto border border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900",
            resultsInline
              ? "mt-2 max-h-[300px]"
              : cn(
                  "absolute top-full z-30 mt-1 max-h-[360px] w-[420px] min-w-full max-w-[calc(100vw-2.5rem)] shadow-[0_16px_40px_-12px_rgba(28,25,23,0.35)]",
                  dropdownAlign === "right" ? "right-0" : "left-0",
                ),
          )}
        >
          {searchError ? (
            <p role="alert" className="px-4 py-3 text-sm text-red-600">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-500">No stylists match “{query.trim()}”.</p>
          ) : (
            results.map((candidate) => {
              const added = selectedIds.has(candidate.id);
              const featurable = canFeature(candidate);
              return (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={added || !featurable}
                  onClick={() => {
                    onAdd(candidate);
                    setQuery("");
                    setResults(null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2 text-left last:border-b-0 hover:bg-stone-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:border-stone-800 dark:hover:bg-stone-800"
                >
                  <Thumb src={candidate.photos[0]} className="size-11 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-950 dark:text-stone-50">{candidate.name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {[candidate.handle || "No Instagram", locationTagForAreas(candidate.areaIds), candidate.priceBand, `${candidate.photos.length} photos`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {!candidate.matchesBrief ? (
                    <span className="shrink-0 border border-stone-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500 dark:border-stone-700">Outside brief</span>
                  ) : null}
                  <span className="shrink-0 text-xs font-medium text-stone-500">
                    {added ? (
                      <span className="inline-flex items-center gap-1 text-stone-900 dark:text-stone-100">
                        <Check className="size-3.5" /> Added
                      </span>
                    ) : featurable ? (
                      <span className="inline-flex items-center gap-1 text-stone-900 dark:text-stone-100">
                        <Plus className="size-3.5" /> Add
                      </span>
                    ) : (
                      "Needs Instagram"
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Result card ────────────────────────────────────────────────────────────

function CandidateCard({ candidate, position, onToggle }: { candidate: Candidate; position: number; onToggle: () => void }) {
  const selected = position >= 0;
  const featurable = canFeature(candidate);
  const strip = candidate.photos.slice(0, 4);
  const extra = candidate.photos.length - strip.length;
  const warnings = [
    !candidate.handle ? "No Instagram — can't be featured" : "",
    candidate.photos.length === 0 ? "No photos yet" : candidate.photos.length === 1 ? "Only 1 photo" : "",
    !candidate.bookingUrl ? "No booking link" : "",
  ].filter(Boolean);
  const lastFeatured = candidate.featuredIn[0];

  return (
    <article
      className={cn(
        "flex flex-col border bg-white transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] dark:bg-stone-900",
        selected ? "border-stone-950 shadow-[0_0_0_1px_rgba(12,10,9,1)] dark:border-stone-100 dark:shadow-[0_0_0_1px_rgba(245,245,244,1)]" : "border-stone-200 dark:border-stone-800",
      )}
    >
      <div className="relative grid grid-cols-4 gap-px bg-stone-200 dark:bg-stone-800">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative aspect-[4/5] overflow-hidden">
            <Thumb src={strip[index]} className="size-full" />
            {index === 3 && extra > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-stone-950/55 text-sm font-semibold text-white">+{extra}</span>
            ) : null}
          </div>
        ))}
        {selected ? (
          <span className="absolute left-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-stone-950 text-xs font-bold text-white ring-2 ring-white">{position + 1}</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-stone-950 dark:text-stone-50">{candidate.name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-stone-500">
            {[candidate.handle, locationTagForAreas(candidate.areaIds), candidate.priceBand].filter(Boolean).join(" · ")}
          </p>
        </div>

        {candidate.matchedServices.length ? (
          <div className="flex flex-wrap gap-1">
            {candidate.matchedServices.slice(0, 3).map((service) => (
              <span key={service} className="bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                {shortServiceLabel(service)}
              </span>
            ))}
            {candidate.matchedServices.length > 3 ? <span className="px-1 py-0.5 text-[11px] text-stone-500">+{candidate.matchedServices.length - 3}</span> : null}
          </div>
        ) : null}

        <p className="text-[12px] tabular-nums text-stone-500">
          {candidate.photos.length} photo{candidate.photos.length === 1 ? "" : "s"} · {candidate.googleReviewCount} Google · {candidate.verifiedReviewCount} verified
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium">
          {candidate.instagramUrl ? (
            <a href={candidate.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-700 underline-offset-4 hover:text-stone-950 hover:underline dark:text-stone-300">
              Instagram <ExternalLink className="size-3" />
            </a>
          ) : null}
          {candidate.bookingUrl ? (
            <a href={candidate.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-700 underline-offset-4 hover:text-stone-950 hover:underline dark:text-stone-300">
              {candidate.bookingPlatform && candidate.bookingPlatform !== "Instagram" ? candidate.bookingPlatform : "Booking"} <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>

        {warnings.length || lastFeatured ? (
          <div className="space-y-1">
            {lastFeatured ? (
              <p className="flex items-center gap-1.5 text-[12px] text-stone-600 dark:text-stone-400">
                <Sparkles className="size-3.5 shrink-0" />
                <span className="truncate">
                  Featured in {lastFeatured.title} · {formatShortDate(lastFeatured.postedAt)}
                  {candidate.featuredIn.length > 1 ? ` (+${candidate.featuredIn.length - 1})` : ""}
                </span>
              </p>
            ) : null}
            {warnings.map((warning) => (
              <p key={warning} className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-1">
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            disabled={!featurable && !selected}
            onClick={onToggle}
            className="h-9 w-full gap-1.5 text-xs"
          >
            {selected ? (
              <>
                <Check className="size-3.5" /> In carousel · #{position + 1}
              </>
            ) : (
              <>
                <Plus className="size-3.5" /> Add to carousel
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

function CandidateSkeleton() {
  return (
    <div className="border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="grid animate-pulse grid-cols-4 gap-px">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="aspect-[4/5] bg-stone-200 dark:bg-stone-800" />
        ))}
      </div>
      <div className="animate-pulse space-y-2 p-3.5">
        <div className="h-4 w-2/3 rounded-[4px] bg-stone-200 dark:bg-stone-800" />
        <div className="h-3 w-1/2 rounded-[4px] bg-stone-200 dark:bg-stone-800" />
        <div className="h-9 rounded-[8px] bg-stone-100 dark:bg-stone-800" />
      </div>
    </div>
  );
}

// ── Selection tray ─────────────────────────────────────────────────────────

function SelectionTray({
  selection,
  onMove,
  onRemove,
  onBuild,
  hasExistingSlides,
}: {
  selection: Candidate[];
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  onBuild: () => void;
  hasExistingSlides: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-stone-300 bg-white/95 backdrop-blur dark:border-stone-700 dark:bg-stone-950/95">
      <div className="flex items-center gap-4 px-5 py-3">
        <div className="min-w-0 flex-1">
          {selection.length === 0 ? (
            <p className="text-sm text-stone-500">Add stylists to start a carousel. The order here is the slide order.</p>
          ) : (
            <ol className="flex gap-2 overflow-x-auto pb-0.5">
              {selection.map((candidate, index) => (
                <li key={candidate.id} className="flex shrink-0 items-center gap-2 border border-stone-200 bg-stone-50 py-1 pl-1 pr-1.5 dark:border-stone-800 dark:bg-stone-900">
                  <Thumb src={candidate.photos[0]} className="size-8" />
                  <span className="text-xs">
                    <span className="mr-1 font-semibold tabular-nums">{index + 1}</span>
                    {candidate.handle || candidate.name}
                  </span>
                  <span className="flex">
                    <button type="button" aria-label={`Move ${candidate.name} earlier`} disabled={index === 0} onClick={() => onMove(index, -1)} className="inline-flex size-6 items-center justify-center text-stone-500 hover:text-stone-950 disabled:opacity-30 dark:hover:text-stone-100">
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Move ${candidate.name} later`} disabled={index === selection.length - 1} onClick={() => onMove(index, 1)} className="inline-flex size-6 items-center justify-center text-stone-500 hover:text-stone-950 disabled:opacity-30 dark:hover:text-stone-100">
                      <ArrowRight className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Remove ${candidate.name}`} onClick={() => onRemove(candidate.id)} className="inline-flex size-6 items-center justify-center text-stone-500 hover:text-red-600">
                      <X className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <Button type="button" disabled={!selection.length} onClick={onBuild} className="h-10 shrink-0 gap-1.5 px-4 text-sm">
          {hasExistingSlides ? "Rebuild carousel" : "Build carousel"}
          {selection.length ? <span className="tabular-nums opacity-70">· {selection.length + 2} slides</span> : null}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Finder view ────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

export function FinderView({
  options,
  brief,
  onBriefChange,
  sort,
  onSortChange,
  selection,
  onSelectionChange,
  onBuild,
  hasExistingSlides,
  onDirectoryTotal,
}: {
  options: BriefOptions;
  brief: Brief;
  onBriefChange: (brief: Brief) => void;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  selection: Candidate[];
  onSelectionChange: (selection: Candidate[]) => void;
  onBuild: () => void;
  hasExistingSlides: boolean;
  onDirectoryTotal: (total: number) => void;
}) {
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const selectedIds = useMemo(() => new Set(selection.map((candidate) => candidate.id)), [selection]);

  useEffect(() => {
    let cancelled = false;
    setResults(null);
    setError("");
    const params = briefQuery(brief);
    params.set("sort", sort);
    params.set("limit", String(PAGE_SIZE));
    fetchCandidates(params)
      .then((payload) => {
        if (cancelled) return;
        setResults(payload.candidates);
        setTotal(payload.total);
        onDirectoryTotal(payload.directoryTotal);
      })
      .catch((loadError: Error) => {
        if (cancelled) return;
        setError(loadError.message);
        setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [brief, sort, onDirectoryTotal]);

  const loadMore = () => {
    if (!results) return;
    setLoadingMore(true);
    const params = briefQuery(brief);
    params.set("sort", sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(results.length));
    fetchCandidates(params)
      .then((payload) => setResults((current) => [...(current ?? []), ...payload.candidates]))
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoadingMore(false));
  };

  const toggleCandidate = (candidate: Candidate) => {
    onSelectionChange(selectedIds.has(candidate.id) ? selection.filter((item) => item.id !== candidate.id) : [...selection, candidate]);
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...selection];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onSelectionChange(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6">
          <section className="grid gap-5 border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950 lg:grid-cols-[minmax(0,1fr)_320px]">
            <BriefBar brief={brief} onChange={onBriefChange} options={options} sort={sort} onSortChange={onSortChange} />
            <div className="space-y-1.5 lg:border-l lg:border-stone-200 lg:pl-5 lg:dark:border-stone-800">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Or add by name</span>
              <StylistNameSearch brief={brief} selectedIds={selectedIds} onAdd={(candidate) => onSelectionChange([...selection, candidate])} />
              <p className="text-[12px] leading-snug text-stone-500">Searches the whole directory, ignoring the filters. Anyone outside the brief is tagged so you know.</p>
            </div>
          </section>

          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-stone-950 dark:text-stone-50">
              {results ? `${total.toLocaleString("en-GB")} stylist${total === 1 ? "" : "s"}` : "Finding stylists…"}
              <span className="ml-2 font-normal text-stone-500">{describeBrief(brief, options) || "Whole directory"}</span>
            </h2>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {results
              ? results.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    position={selection.findIndex((item) => item.id === candidate.id)}
                    onToggle={() => toggleCandidate(candidate)}
                  />
                ))
              : Array.from({ length: 8 }, (_, index) => <CandidateSkeleton key={index} />)}
          </div>

          {results && results.length === 0 && !error ? (
            <div className="border border-dashed border-stone-300 px-6 py-12 text-center dark:border-stone-700">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">No stylists match this brief.</p>
              <p className="mt-1 text-sm text-stone-500">Try another area or price band, or add someone by name.</p>
            </div>
          ) : null}

          {results && results.length < total ? (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore} className="h-10 gap-2">
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                Show more · {total - results.length} left
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <SelectionTray
        selection={selection}
        onMove={move}
        onRemove={(id) => onSelectionChange(selection.filter((item) => item.id !== id))}
        onBuild={onBuild}
        hasExistingSlides={hasExistingSlides}
      />
    </div>
  );
}
