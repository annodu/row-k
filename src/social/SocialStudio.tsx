// Social Studio — TikTok carousel / 9:16 image editor. "Find stylists" picks
// who to feature (finder.tsx); "Edit" lays out and exports the slides.

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, Download, ExternalLink, ImagePlus, Loader2, Plus, ScanLine, Scissors, Trash2, Undo2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getServiceDisplayName, serviceFilterRows } from "@/lib/serviceTaxonomy";
import { cn } from "@/lib/utils";
import { downloadDataUrl, renderSlidePng } from "./export";
import { type Brief, type BriefOptions, type Candidate, EMPTY_BRIEF, buildCarousel, candidateToListSlide, describeBrief, filterPanelGroups, filtersFromBrief, resolvePhotoUrl } from "./build";
import { fileToDataUrl, fileToSlideImage, removeImageBackground } from "./cutout";
import { type Sort, FinderView, StylistNameSearch, useBriefOptions } from "./finder";
import { type Aspect, type CoverSlideData, type CtaFilters, type CtaLayout, type CtaSlideData, type ElementAdjust, type SheetAdjust, type ChecklistGroup, type CoverLayout, DEFAULT_COVER_LAYOUT, DEFAULT_CTA_LAYOUT, type ListSlideData, type PhotoCell, type PhotoLayoutId, type SlideData, CANVAS, PHOTO_LAYOUTS, getPhotoLayout, layoutCellCount } from "./model";
import { DEFAULT_BACKGROUND, SafeZoneOverlay, SlideContent, SlideFrame, filterSheetGroups } from "./slides";

function slideLabel(slide: SlideData) {
  if (slide.type === "cover") return "Cover";
  if (slide.type === "cta") return "Find more";
  return slide.handle || slide.name;
}

function slideFilename(slide: SlideData, index: number, aspect: Aspect) {
  const slug = slideLabel(slide).replace(/^@/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${String(index + 1).padStart(2, "0")}-${slug || "slide"}-${aspect.replace(":", "x")}.png`;
}

// Renders a slide at true pixel size and scales it to `width` CSS px.
function ScaledSlide({
  slide,
  aspect,
  width,
  showSafeZones = false,
  frameRef,
  onOverflowChange,
}: {
  slide: SlideData;
  aspect: Aspect;
  width: number;
  showSafeZones?: boolean;
  frameRef?: (node: HTMLElement | null) => void;
  onOverflowChange?: (overflowing: boolean) => void;
}) {
  const canvas = CANVAS[aspect];
  const scale = width / canvas.width;
  return (
    <div className="relative overflow-hidden" style={{ width, height: canvas.height * scale }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <SlideFrame ref={frameRef} aspect={aspect} onOverflowChange={onOverflowChange}>
          <SlideContent slide={slide} aspect={aspect} />
        </SlideFrame>
        {showSafeZones ? <SafeZoneOverlay aspect={aspect} /> : null}
      </div>
    </div>
  );
}

// Callback ref (not a ref object) so measuring starts whenever the element
// actually mounts — the canvas only appears once stylists have loaded.
function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size] as const;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex border border-stone-300 dark:border-stone-700">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "h-9 px-3 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950"
              : "bg-white text-stone-600 hover:text-stone-950 dark:bg-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-stone-500">{hint}</span> : null}
    </label>
  );
}

function TextField({ label, value, onChange, hint, multiline = false }: { label: string; value: string; onChange: (value: string) => void; hint?: string; multiline?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full resize-y rounded-none border border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-950 transition-colors outline-none hover:border-stone-400 focus-visible:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-500 dark:focus-visible:border-stone-100"
        />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 py-2" />
      )}
    </Field>
  );
}

function LayoutIcon({ id }: { id: PhotoLayoutId }) {
  const layout = getPhotoLayout(id);
  const names = [...new Set(layout.areas.join(" ").split(" "))];
  return (
    <div
      className="grid size-7 gap-[2px]"
      style={{
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
        gridTemplateAreas: layout.areas.map((row) => `"${row}"`).join(" "),
      }}
    >
      {names.map((name) => (
        <span key={name} className="bg-current opacity-70" style={{ gridArea: name }} />
      ))}
    </div>
  );
}

// True if the browser can load (and, for export, CORS-read) the image now.
function imageLoads(src: string, timeoutMs = 6000) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    image.src = src;
  });
}

async function downloadCarouselCopy(result: { imageUrl: string; thumbnailUrl: string }) {
  const response = await fetch("/api/admin/social/fetch-image", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: result.imageUrl, thumbnailUrl: result.thumbnailUrl }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.dataUrl) {
    throw new Error(
      response.status === 404
        ? "Saved to their profile, but restart the admin API server (npm run dev) so it can show on the slide."
        : payload?.message || "Saved to their profile, but couldn't load it onto the slide yet.",
    );
  }
  return payload.dataUrl as string;
}

function instagramProfileUrl(handle: string) {
  const username = handle.trim().replace(/^@/, "");
  return username ? `https://www.instagram.com/${encodeURIComponent(username)}/` : "";
}

// Same shape the server accepts (admin-stylists validInstagramPostUrl):
// a single post or reel, optionally with the username in the path.
const INSTAGRAM_POST_URL = /^https:\/\/(www\.)?instagram\.com\/(?:[^/?#]+\/)?(p|reel)\/[^/?#]+\/?/;
// Mirrors admin-social isTikTokVideoUrl: one video (or photo post), or a short vm/vt link.
const TIKTOK_VIDEO_URL = /^https:\/\/(?:(?:(?:www|m)\.)?tiktok\.com\/@[^/?#]+\/(?:video|photo)\/\d+\/?(?:[?#].*)?$|(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]+\/?$)/;

type InstagramResult = { imageUrl: string; thumbnailUrl: string; contextUrl?: string; isReel?: boolean; title?: string };

// "Fetch more from Instagram" on a stylist slide: runs the admin's existing
// Photo search (the stylist's own account only); a picked post is saved to
// the stylist's directory profile and added to this slide's photos.
function InstagramPhotoFetcher({ slide, onAddPhoto }: { slide: ListSlideData; onAddPhoto: (salonId: string, src: string) => void }) {
  const [results, setResults] = useState<InstagramResult[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [postLink, setPostLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [reel, setReel] = useState<{ postUrl: string; batch: number; hasMore: boolean; frames: { t: number; dataUrl: string }[] } | null>(null);

  const search = async (cursor?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/admin/photo-search/${encodeURIComponent(slide.salonId)}${query}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Instagram search failed. Try again.");
      setResults((current) => [...(cursor ? current ?? [] : []), ...(payload.results ?? [])]);
      setNextCursor(payload.nextCursor ?? null);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Instagram search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Approves the post to the stylist's portfolio (the same route Photo search
  // uses), then puts it on the slide. Locally the new portfolio file serves
  // straight away; on the hosted admin it only appears once the photo site
  // redeploys, so if it doesn't load yet the slide uses a downloaded copy.
  const addResult = async (result: InstagramResult) => {
    setAdding((current) => new Set(current).add(result.imageUrl));
    setError("");
    try {
      const response = await fetch(`/api/admin/photo-search/${encodeURIComponent(slide.salonId)}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: result.imageUrl, thumbnailUrl: result.thumbnailUrl, isReel: result.isReel }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.photo?.url) throw new Error(payload?.message || "Couldn't add that photo to their profile.");
      const profileSrc = resolvePhotoUrl(payload.photo.url);
      const src = (await imageLoads(profileSrc)) ? profileSrc : await downloadCarouselCopy(result);
      onAddPhoto(slide.salonId, src);
      setAdded((current) => new Set(current).add(result.imageUrl));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Couldn't add that photo.");
    } finally {
      setAdding((current) => {
        const next = new Set(current);
        next.delete(result.imageUrl);
        return next;
      });
    }
  };

  // Same route as Link backlog: a pasted post/reel the search didn't surface.
  // A photo post is added straight away (pasting it is already the pick); a
  // Reel returns frames to choose from.
  // A TikTok link adds the video's cover (via TikTok's oEmbed) — there's no
  // frame choice for TikTok, so pasting it is the pick, like an Instagram photo.
  const fetchTikTokCover = async (videoUrl: string) => {
    setLinkBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/social/tiktok-cover", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.imageUrl) {
        throw new Error(response.status === 404 && !payload ? "Restart the admin API server (npm run dev) to fetch TikTok covers." : payload?.message || "Couldn't fetch that TikTok.");
      }
      setReel(null);
      setPostLink("");
      await addResult({ imageUrl: payload.imageUrl, thumbnailUrl: payload.imageUrl, contextUrl: videoUrl, isReel: false });
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Couldn't fetch that TikTok.");
    } finally {
      setLinkBusy(false);
    }
  };

  const fetchLink = async (postUrl: string, batch = 0) => {
    if (TIKTOK_VIDEO_URL.test(postUrl)) return fetchTikTokCover(postUrl);
    setLinkBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/instagram/extract-media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl, batch }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Couldn't fetch that post.");
      if (payload.type === "photo") {
        setReel(null);
        setPostLink("");
        await addResult({ imageUrl: payload.imageUrl, thumbnailUrl: payload.imageUrl, contextUrl: postUrl, isReel: false });
      } else {
        setReel({ postUrl, batch: payload.batch ?? batch, hasMore: Boolean(payload.hasMore), frames: payload.candidates ?? [] });
      }
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Couldn't fetch that post.");
    } finally {
      setLinkBusy(false);
    }
  };

  const addFrame = async (dataUrl: string) => {
    setAdding((current) => new Set(current).add(dataUrl));
    setError("");
    try {
      const response = await fetch(`/api/admin/photo-search/${encodeURIComponent(slide.salonId)}/approve-frame`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.photo?.url) throw new Error(payload?.message || "Couldn't add that frame to their profile.");
      const profileSrc = resolvePhotoUrl(payload.photo.url);
      // The frame is already image data, so it's its own fallback.
      onAddPhoto(slide.salonId, (await imageLoads(profileSrc)) ? profileSrc : dataUrl);
      setAdded((current) => new Set(current).add(dataUrl));
    } catch (frameError) {
      setError(frameError instanceof Error ? frameError.message : "Couldn't add that frame.");
    } finally {
      setAdding((current) => {
        const next = new Set(current);
        next.delete(dataUrl);
        return next;
      });
    }
  };

  const linkIsValid = INSTAGRAM_POST_URL.test(postLink.trim()) || TIKTOK_VIDEO_URL.test(postLink.trim());

  return (
    <div className="space-y-2.5 border border-stone-200 p-3 dark:border-stone-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Instagram</span>
        {results ? <span className="text-[11px] text-stone-500">{results.length} posts</span> : null}
      </div>

      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (linkIsValid && !linkBusy) fetchLink(postLink.trim());
        }}
      >
        <Input
          value={postLink}
          onChange={(event) => setPostLink(event.target.value)}
          placeholder="Paste a post, reel or TikTok link"
          aria-label="Instagram post, Reel or TikTok video link"
          className="h-9 min-w-0 flex-1 px-3 py-1.5 text-xs"
        />
        <Button type="submit" variant="outline" disabled={!linkIsValid || linkBusy} className="h-9 shrink-0 px-3 text-xs">
          {linkBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Fetch"}
        </Button>
      </form>
      {postLink.trim() && !linkIsValid ? <p className="text-[11px] text-stone-500">Use a link to one post, reel or TikTok video, e.g. instagram.com/p/… or tiktok.com/@name/video/…</p> : null}

      {reel ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-stone-500">That's a Reel — pick a frame:</p>
          <div className="grid grid-cols-4 gap-1.5">
            {reel.frames.map((frame) => {
              const isAdding = adding.has(frame.dataUrl);
              const isAdded = added.has(frame.dataUrl);
              return (
                <button
                  key={`${frame.t}-${frame.dataUrl.length}`}
                  type="button"
                  title={isAdded ? "Added to this slide and their profile" : "Add to this slide and their profile"}
                  disabled={isAdding || isAdded}
                  onClick={() => addFrame(frame.dataUrl)}
                  className="relative aspect-[9/16] overflow-hidden transition hover:opacity-90 disabled:cursor-default"
                >
                  <img src={frame.dataUrl} alt="" className={cn("size-full object-cover", isAdded && "opacity-40")} />
                  {isAdding || isAdded ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-stone-950 text-white">
                        {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {reel.hasMore ? (
              <Button type="button" variant="outline" onClick={() => fetchLink(reel.postUrl, reel.batch + 1)} disabled={linkBusy} className="h-8 flex-1 text-xs">
                More frames
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setReel(null)} className="h-8 flex-1 text-xs">
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {!results ? (
        <Button type="button" variant="outline" onClick={() => search()} disabled={loading} className="h-9 w-full gap-1.5 text-xs">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          {loading ? "Searching their Instagram…" : "Fetch more from Instagram"}
        </Button>
      ) : results.length === 0 ? (
        <p className="text-[12px] text-stone-500">No photos found on their Instagram.</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {results.map((result) => {
              const isAdding = adding.has(result.imageUrl);
              const isAdded = added.has(result.imageUrl);
              return (
                <button
                  key={result.imageUrl}
                  type="button"
                  title={isAdded ? "Added to this slide and their profile" : "Add to this slide and their profile"}
                  disabled={isAdding || isAdded}
                  onClick={() => addResult(result)}
                  className="relative aspect-square overflow-hidden border-2 border-transparent transition hover:opacity-90 disabled:cursor-default"
                >
                  <img src={result.thumbnailUrl || result.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className={cn("size-full object-cover", isAdded && "opacity-40")} />
                  {isAdding || isAdded ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-stone-950 text-white">
                        {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </span>
                    </span>
                  ) : null}
                  {result.isReel ? <span className="absolute bottom-0.5 right-0.5 bg-stone-950/70 px-1 text-[9px] font-semibold uppercase text-white">Reel</span> : null}
                </button>
              );
            })}
          </div>
          {nextCursor ? (
            <Button type="button" variant="outline" onClick={() => search(nextCursor)} disabled={loading} className="h-8 w-full gap-1.5 text-xs">
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              More posts
            </Button>
          ) : null}
          <p className="text-[11px] leading-snug text-stone-500">Click a post to add it to the photos above. It's also saved to their directory profile.</p>
        </>
      )}
      {error ? <p role="alert" className="text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}

function PhotoUploadTile({ onFiles, multiple = false }: { onFiles: (files: File[]) => Promise<void>; multiple?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-stone-300 text-[11px] text-stone-500 hover:border-stone-500 hover:text-stone-900 dark:border-stone-700 dark:hover:text-stone-100"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        Upload
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={async (event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (!files.length) return;
          setBusy(true);
          try {
            await onFiles(files);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function ListInspector({ slide, onChange, onAddPhoto }: { slide: ListSlideData; onChange: (next: ListSlideData) => void; onAddPhoto: (salonId: string, src: string) => void }) {
  const cellCount = layoutCellCount(slide.layout);
  const chosen = slide.cells.map((cell) => cell.src);
  const [framingIndex, setFramingIndex] = useState(0);
  const framed = slide.cells[Math.min(framingIndex, slide.cells.length - 1)];
  const updateFramed = (patch: Partial<PhotoCell>) => onChange({ ...slide, cells: slide.cells.map((cell) => (cell === framed ? { ...cell, ...patch } : cell)) });

  const setLayout = (layout: PhotoLayoutId) => {
    const count = layoutCellCount(layout);
    // Keep the photos already chosen, topping up from the pool in order.
    const srcs = [...chosen, ...slide.photoPool.filter((src) => !chosen.includes(src))].slice(0, count);
    onChange({ ...slide, layout, cells: srcs.map((src) => slide.cells.find((cell) => cell.src === src) ?? { src, focusX: 50, focusY: 50 }) });
  };

  const togglePhoto = (src: string) => {
    if (chosen.includes(src)) {
      onChange({ ...slide, cells: slide.cells.filter((cell) => cell.src !== src) });
    } else if (slide.cells.length < cellCount) {
      onChange({ ...slide, cells: [...slide.cells, { src, focusX: 50, focusY: 50 }] });
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Photo layout">
        <div className="grid grid-cols-5 gap-1.5">
          {PHOTO_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              title={layout.label}
              aria-label={layout.label}
              aria-pressed={slide.layout === layout.id}
              onClick={() => setLayout(layout.id)}
              className={cn(
                "flex h-12 items-center justify-center border transition-colors",
                slide.layout === layout.id
                  ? "border-stone-950 bg-stone-950 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                  : "border-stone-300 bg-white text-stone-500 hover:border-stone-500 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400",
              )}
            >
              <LayoutIcon id={layout.id} />
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Photos · ${slide.cells.length}/${cellCount}`} hint="Click to add or remove. Numbers show the order on the slide. Uploads fill any empty spots.">
        <div className="grid grid-cols-4 gap-1.5">
          {slide.photoPool.map((src) => {
            const position = chosen.indexOf(src);
            const isFull = position === -1 && slide.cells.length >= cellCount;
            return (
              <button
                key={src}
                type="button"
                onClick={() => togglePhoto(src)}
                disabled={isFull}
                className={cn(
                  "relative aspect-square overflow-hidden border-2 transition",
                  position >= 0 ? "border-stone-950 dark:border-stone-100" : "border-transparent",
                  isFull ? "cursor-not-allowed opacity-40" : "hover:opacity-90",
                )}
              >
                <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                {position >= 0 ? (
                  <span className="absolute left-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-stone-950 text-[11px] font-bold text-white">
                    {position + 1}
                  </span>
                ) : null}
              </button>
            );
          })}
          <PhotoUploadTile multiple onFiles={async (files) => {
            for (const file of files) onAddPhoto(slide.salonId, await fileToSlideImage(file));
          }} />
        </div>
      </Field>

      {framed ? (
        <Field label="Photo framing" hint="Zoom in on a photo and choose which part stays in frame.">
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {slide.cells.map((cell, index) => (
                <button
                  key={cell.src}
                  type="button"
                  onClick={() => setFramingIndex(index)}
                  aria-pressed={cell === framed}
                  aria-label={`Frame photo ${index + 1}`}
                  className={cn("relative size-11 overflow-hidden border-2 transition hover:opacity-90", cell === framed ? "border-stone-950 dark:border-stone-100" : "border-transparent")}
                >
                  <img src={cell.src} alt="" className="size-full object-cover" loading="lazy" />
                  <span className="absolute left-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-stone-950 text-[10px] font-bold text-white">{index + 1}</span>
                </button>
              ))}
            </div>
            <RangeField label="Size" value={framed.zoom ?? 100} min={100} max={300} unit="%" onChange={(zoom) => updateFramed({ zoom })} />
            <RangeField label="Left / right" value={framed.focusX} min={0} max={100} unit="%" signed={false} onChange={(focusX) => updateFramed({ focusX })} />
            <RangeField label="Top / bottom" value={framed.focusY} min={0} max={100} unit="%" signed={false} onChange={(focusY) => updateFramed({ focusY })} />
            <Button type="button" variant="outline" onClick={() => updateFramed({ zoom: 100, focusX: 50, focusY: 50 })} className="h-9 w-full text-xs">
              Reset framing
            </Button>
          </div>
        </Field>
      ) : null}

      <InstagramPhotoFetcher slide={slide} onAddPhoto={onAddPhoto} />

      <Field label="Instagram handle" hint="Always shown on stylist slides, as credit for their photos.">
        {instagramProfileUrl(slide.handle) ? (
          <a
            href={instagramProfileUrl(slide.handle)}
            target="_blank"
            rel="noreferrer"
            title="Open their Instagram"
            className="flex h-10 items-center justify-between gap-2 border border-stone-200 bg-stone-100 px-4 text-sm text-stone-700 underline-offset-2 hover:underline dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
          >
            {slide.handle}
            <ExternalLink className="size-3.5 shrink-0 text-stone-500" />
          </a>
        ) : (
          <p className="flex h-10 items-center border border-stone-200 bg-stone-100 px-4 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">—</p>
        )}
      </Field>
      <TextField label="Location" value={slide.locationTag} onChange={(locationTag) => onChange({ ...slide, locationTag })} hint="Shown next to the pin. Leave blank to hide the row." />
    </div>
  );
}

function RangeField({ label, value, min, max, unit, signed = label !== "Size", onChange }: { label: string; value: number; min: number; max: number; unit: string; signed?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {label}
        <span className="font-normal normal-case tracking-normal tabular-nums">
          {signed && value > 0 ? "+" : ""}
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-stone-950" />
    </label>
  );
}

const CHECKERBOARD = "repeating-conic-gradient(#e7e5e4 0% 25%, #fafaf9 0% 50%) 50% / 16px 16px";

function CoverInspector({
  slide,
  onChange,
  onPatch,
  photoChoices,
}: {
  slide: CoverSlideData;
  onChange: (next: CoverSlideData) => void;
  // Merges into the cover by type, so a cut-out that finishes after you've
  // moved to another slide still lands on the cover.
  onPatch: (patch: Partial<CoverSlideData>) => void;
  photoChoices: string[];
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const cutOut = async () => {
    if (!slide.photo) return;
    setWorking(true);
    setError("");
    try {
      const subject = await removeImageBackground(slide.photo, setStatus);
      onPatch({ subject });
    } catch (cutError) {
      setError(cutError instanceof Error && cutError.message ? cutError.message : "Background removal failed. Try another photo.");
    } finally {
      setWorking(false);
      setStatus("");
    }
  };

  const choices = slide.photo && !photoChoices.includes(slide.photo) ? [slide.photo, ...photoChoices] : photoChoices;

  return (
    <div className="space-y-5">
      <Field label="Main image" hint="Pick the person for the cover, then remove the background so they sit over the cityscape.">
        <div className="grid grid-cols-4 gap-1.5">
          {choices.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onChange({ ...slide, photo: src, subject: "" })}
              className={cn("relative aspect-square overflow-hidden border-2 transition hover:opacity-90", slide.photo === src ? "border-stone-950 dark:border-stone-100" : "border-transparent")}
              aria-pressed={slide.photo === src}
            >
              <img src={src} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-stone-300 text-[11px] text-stone-500 hover:border-stone-500 hover:text-stone-900 dark:border-stone-700 dark:hover:text-stone-100"
          >
            <ImagePlus className="size-4" />
            Upload
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onChange({ ...slide, photo: await fileToDataUrl(file), subject: "" });
            }}
          />
        </div>
      </Field>

      {slide.subject ? (
        <div className="space-y-2">
          <div className="flex h-40 items-end justify-center border border-stone-200 dark:border-stone-800" style={{ background: CHECKERBOARD }}>
            <img src={slide.subject} alt="Cut-out preview" className="max-h-full object-contain" />
          </div>
          <RangeField label="Size" value={slide.subjectScale ?? 100} min={50} max={160} unit="%" onChange={(subjectScale) => onChange({ ...slide, subjectScale })} />
          <RangeField label="Left / right" value={slide.subjectOffsetX ?? 0} min={-30} max={50} unit="%" onChange={(subjectOffsetX) => onChange({ ...slide, subjectOffsetX })} />
          <RangeField label="Down / up" value={slide.subjectOffsetY ?? 0} min={-20} max={40} unit="%" onChange={(subjectOffsetY) => onChange({ ...slide, subjectOffsetY })} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ ...slide, subjectScale: 100, subjectOffsetX: 0, subjectOffsetY: 0 })}
              className="h-9 flex-1 text-xs"
            >
              Reset size
            </Button>
            <Button type="button" variant="outline" onClick={() => onChange({ ...slide, subject: "" })} className="h-9 flex-1 gap-1.5 text-xs">
              <Undo2 className="size-3.5" /> Original photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Button type="button" onClick={cutOut} disabled={!slide.photo || working} className="h-10 w-full gap-1.5 text-xs">
            {working ? <Loader2 className="size-3.5 animate-spin" /> : <Scissors className="size-3.5" />}
            {working ? status || "Removing background…" : "Remove background"}
          </Button>
          <p className="text-[12px] text-stone-500">Runs in your browser. The first time downloads a ~40 MB model, then it's cached.</p>
          {error ? <p role="alert" className="text-[12px] text-red-600">{error}</p> : null}
        </div>
      )}

      <TextField label="Title — top line" value={slide.titleTop} onChange={(titleTop) => onChange({ ...slide, titleTop })} hint="Optional." />
      <TextField label="Title" value={slide.title} onChange={(title) => onChange({ ...slide, title })} />
      <TextField label="Kicker" value={slide.kicker} onChange={(kicker) => onChange({ ...slide, kicker })} hint="Press Enter for a new line." multiline />
      <TextField label="Sign-off" value={slide.handle} onChange={(handle) => onChange({ ...slide, handle })} />
      <TextField label="Sign-off subtitle" value={slide.subtitle} onChange={(subtitle) => onChange({ ...slide, subtitle })} />

      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-stone-800 dark:text-stone-200">
        <Checkbox checked={slide.showArrow !== false} onCheckedChange={(checked) => onChange({ ...slide, showArrow: checked === true })} className="size-4" />
        Show arrow
      </label>

      <CoverLayoutControls layout={{ ...DEFAULT_COVER_LAYOUT, ...slide.layout }} onChange={(layout) => onChange({ ...slide, layout })} />
    </div>
  );
}

// Same collapsible pattern as the closing slide's Layout panel. Up is positive
// here, matching the cut-out's "Down / up" slider on this slide.
function CoverLayoutControls({ layout, onChange }: { layout: CoverLayout; onChange: (layout: CoverLayout) => void }) {
  const [open, setOpen] = useState(false);
  const group = (title: string, key: keyof CoverLayout) => (
    <div className="space-y-2 border-t border-stone-200 pt-3 first:border-t-0 first:pt-0 dark:border-stone-800">
      <p className="text-[13px] font-medium text-stone-950 dark:text-stone-50">{title}</p>
      <RangeField label="Size" value={layout[key].size} min={50} max={160} unit="%" onChange={(size) => onChange({ ...layout, [key]: { ...layout[key], size } })} />
      <RangeField label="Left / right" value={layout[key].dx} min={-40} max={40} unit="%" onChange={(dx) => onChange({ ...layout, [key]: { ...layout[key], dx } })} />
      <RangeField label="Down / up" value={layout[key].dy} min={-60} max={60} unit="%" onChange={(dy) => onChange({ ...layout, [key]: { ...layout[key], dy } })} />
    </div>
  );
  return (
    <div className="border border-stone-200 dark:border-stone-800">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex h-10 w-full items-center justify-between px-3 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Text layout</span>
        <ChevronDown className={cn("size-4 text-stone-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 px-3 pb-3">
          {group("Title", "title")}
          {group("Kicker", "kicker")}
          {group("Sign-off", "signoff")}
          <Button type="button" variant="outline" onClick={() => onChange(DEFAULT_COVER_LAYOUT)} className="h-9 w-full text-xs">
            Reset text layout
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_FILTERS: CtaFilters = { categories: [], services: [], areaIds: [], priceBands: [] };
const LONDON_AREA_IDS = ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"];

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterCheckRow({ label, checked, onToggle, indent = 0, trailing }: { label: string; checked: boolean; onToggle: () => void; indent?: boolean | number; trailing?: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2", Number(indent) === 1 && "pl-6", Number(indent) === 2 && "pl-12")}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1 text-[13px] text-stone-800 dark:text-stone-200">
        <Checkbox checked={checked} onCheckedChange={onToggle} className="size-4" />
        <span className="truncate">{label}</span>
      </label>
      {trailing}
    </div>
  );
}

function FilterSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-stone-200 pb-2 last:border-b-0 dark:border-stone-800">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex h-10 w-full items-center justify-between text-left">
        <span className="text-[13px] font-medium text-stone-950 dark:text-stone-50">{title}</span>
        <span className="flex items-center gap-2">
          {count ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-950 px-1.5 text-[11px] font-bold leading-5 text-white dark:bg-stone-100 dark:text-stone-950">{count}</span> : null}
          <ChevronDown className={cn("size-4 text-stone-500 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? <div className="space-y-0.5">{children}</div> : null}
    </div>
  );
}

function AdjustGroup({ title, value, onChange, children }: { title: string; value: ElementAdjust; onChange: (next: ElementAdjust) => void; children?: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-stone-200 pt-3 first:border-t-0 first:pt-0 dark:border-stone-800">
      <p className="text-[13px] font-medium text-stone-950 dark:text-stone-50">{title}</p>
      <RangeField label="Size" value={value.size} min={50} max={160} unit="%" onChange={(size) => onChange({ ...value, size })} />
      {children}
      <RangeField label="Left / right" value={value.dx} min={-40} max={40} unit="%" onChange={(dx) => onChange({ ...value, dx })} />
      <RangeField label="Up / down" value={value.dy} min={-30} max={60} unit="%" onChange={(dy) => onChange({ ...value, dy })} />
    </div>
  );
}

// Sliders for the filter sheets and caption. Positions are relative to the
// area below the search bar; the sheets may run off the bottom, the caption
// gets the red safe-area warning if it leaves the safe box.
function CtaLayoutControls({ layout, checklists, onChange }: { layout: CtaLayout; checklists: ChecklistGroup[]; onChange: (layout: CtaLayout) => void }) {
  const [open, setOpen] = useState(false);
  // "Rows shown" crops a sheet from the bottom; its max is the uncropped sheet.
  const rowsField = (sheet: "services" | "locations") => {
    const { defaultRows } = filterSheetGroups(checklists, sheet);
    const value: SheetAdjust = layout[sheet];
    return (
      <RangeField
        label="Rows shown"
        value={Math.min(value.rows ?? defaultRows, defaultRows)}
        min={1}
        max={defaultRows}
        unit=""
        signed={false}
        onChange={(rows) => onChange({ ...layout, [sheet]: { ...value, rows: rows === defaultRows ? undefined : rows } })}
      />
    );
  };
  return (
    <div className="border border-stone-200 dark:border-stone-800">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex h-10 w-full items-center justify-between px-3 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Layout</span>
        <ChevronDown className={cn("size-4 text-stone-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 px-3 pb-3">
          <AdjustGroup title="Services sheet" value={layout.services} onChange={(services) => onChange({ ...layout, services: { ...layout.services, ...services } })}>
            {rowsField("services")}
          </AdjustGroup>
          <AdjustGroup title="Locations sheet" value={layout.locations} onChange={(locations) => onChange({ ...layout, locations: { ...layout.locations, ...locations } })}>
            {rowsField("locations")}
          </AdjustGroup>
          <AdjustGroup title="Caption" value={layout.caption} onChange={(caption) => onChange({ ...layout, caption: { ...layout.caption, ...caption } })}>
            <RangeField label="Width" value={layout.caption.width} min={50} max={150} unit="%" signed={false} onChange={(width) => onChange({ ...layout, caption: { ...layout.caption, width } })} />
          </AdjustGroup>
          <Button type="button" variant="outline" onClick={() => onChange(DEFAULT_CTA_LAYOUT)} className="h-9 w-full text-xs">
            Reset layout
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CtaInspector({ slide, onChange, options, brief }: { slide: CtaSlideData; onChange: (next: CtaSlideData) => void; options: BriefOptions | null; brief: Brief }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filters = slide.filters ?? EMPTY_FILTERS;
  const setFilters = (next: CtaFilters) => {
    if (!options) return;
    onChange({ ...slide, filters: next, checklists: filterPanelGroups(next, options) });
  };
  const standaloneRegions = (options?.regions ?? []).filter((region) => !LONDON_AREA_IDS.includes(region.id));
  const regionLabel = (id: string) => options?.regions.find((region) => region.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <TextField label="Kicker" value={slide.kicker} onChange={(kicker) => onChange({ ...slide, kicker })} />
      <TextField label="Title — top line" value={slide.titleTop} onChange={(titleTop) => onChange({ ...slide, titleTop })} />
      <TextField label="Title" value={slide.title} onChange={(title) => onChange({ ...slide, title })} />
      <TextField label="Search bar" value={slide.url} onChange={(url) => onChange({ ...slide, url })} />
      <TextField label="Caption" value={slide.caption} onChange={(caption) => onChange({ ...slide, caption })} />

      <Field label="Background" hint="Shown under the halftone. Defaults to the cityscape.">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...slide, photo: "" })}
            aria-pressed={!slide.photo}
            className={cn("relative aspect-square overflow-hidden border-2 transition hover:opacity-90", !slide.photo ? "border-stone-950 dark:border-stone-100" : "border-transparent")}
          >
            <img src={DEFAULT_BACKGROUND} alt="Default cityscape" className="size-full object-cover" />
          </button>
          {slide.photo ? (
            <button type="button" aria-pressed className="relative aspect-square overflow-hidden border-2 border-stone-950 dark:border-stone-100">
              <img src={slide.photo} alt="Uploaded background" className="size-full object-cover" />
            </button>
          ) : null}
          <PhotoUploadTile onFiles={async ([file]) => onChange({ ...slide, photo: await fileToSlideImage(file) })} />
        </div>
      </Field>

      <CtaLayoutControls layout={{ ...DEFAULT_CTA_LAYOUT, ...slide.layout }} checklists={slide.checklists} onChange={(layout) => onChange({ ...slide, layout })} />

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Filters shown</span>
          <button type="button" onClick={() => setFilters(filtersFromBrief(brief))} disabled={!options} className="text-[12px] text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-stone-100">
            Match the brief
          </button>
        </div>
        <p className="text-[12px] text-stone-500">Ticked sections appear on the slide as the site's filter panel.</p>
        {!options ? (
          <p className="flex items-center gap-2 py-2 text-[12px] text-stone-500">
            <Loader2 className="size-3.5 animate-spin" /> Loading filters…
          </p>
        ) : (
          <div className="border border-stone-200 px-3 dark:border-stone-800">
            <FilterSection title="Services" count={filters.categories.length + filters.services.length}>
              {options.categories.map((category) => {
                const rows = serviceFilterRows(category.id, category.subcategories, filters.services);
                const isOpen = expanded.has(category.id) || filters.categories.includes(category.id) || rows.some((row) => filters.services.includes(row.service));
                return (
                  <div key={category.id}>
                    <FilterCheckRow
                      label={category.label}
                      checked={filters.categories.includes(category.id)}
                      onToggle={() => setFilters({ ...filters, categories: toggleIn(filters.categories, category.id) })}
                      trailing={
                        category.subcategories.length ? (
                          <button
                            type="button"
                            aria-label={`${isOpen ? "Hide" : "Show"} ${category.label} styles`}
                            onClick={() => setExpanded((current) => new Set(toggleIn([...current], category.id)))}
                            className="inline-flex size-7 items-center justify-center text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                          >
                            <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        ) : null
                      }
                    />
                    {isOpen
                      ? rows.map(({ service, nested }) => (
                          <FilterCheckRow
                            key={service}
                            indent={nested ? 2 : 1}
                            label={getServiceDisplayName(service)}
                            checked={filters.services.includes(service)}
                            onToggle={() => setFilters({ ...filters, services: toggleIn(filters.services, service) })}
                          />
                        ))
                      : null}
                  </div>
                );
              })}
            </FilterSection>
            <FilterSection title="Locations" count={filters.areaIds.length}>
              <FilterCheckRow label="London" checked={filters.areaIds.includes("all-london")} onToggle={() => setFilters({ ...filters, areaIds: toggleIn(filters.areaIds, "all-london") })} />
              {LONDON_AREA_IDS.map((id) => (
                <FilterCheckRow key={id} indent label={regionLabel(id)} checked={filters.areaIds.includes(id)} onToggle={() => setFilters({ ...filters, areaIds: toggleIn(filters.areaIds, id) })} />
              ))}
              {standaloneRegions.map((region) => (
                <FilterCheckRow key={region.id} label={region.label} checked={filters.areaIds.includes(region.id)} onToggle={() => setFilters({ ...filters, areaIds: toggleIn(filters.areaIds, region.id) })} />
              ))}
            </FilterSection>
            <FilterSection title="Price" count={filters.priceBands.length}>
              {[...options.priceBands.map((band) => ({ id: band.symbol, label: `${band.symbol}: ${band.label}` })), { id: "not-listed", label: "Price not listed" }].map((band) => (
                <FilterCheckRow key={band.id} label={band.label} checked={filters.priceBands.includes(band.id)} onToggle={() => setFilters({ ...filters, priceBands: toggleIn(filters.priceBands, band.id) })} />
              ))}
            </FilterSection>
          </div>
        )}
      </div>
    </div>
  );
}

function SlideInspector({
  slide,
  onChange,
  onPatchCover,
  onAddListPhoto,
  photoChoices,
  options,
  brief,
}: {
  slide: SlideData;
  onChange: (next: SlideData) => void;
  onPatchCover: (patch: Partial<CoverSlideData>) => void;
  onAddListPhoto: (salonId: string, src: string) => void;
  photoChoices: string[];
  options: BriefOptions | null;
  brief: Brief;
}) {
  // Keyed by stylist so Instagram results don't carry over between slides.
  if (slide.type === "list") return <ListInspector key={slide.salonId} slide={slide} onChange={onChange} onAddPhoto={onAddListPhoto} />;
  if (slide.type === "cover") return <CoverInspector slide={slide} onChange={onChange} onPatch={onPatchCover} photoChoices={photoChoices} />;
  return <CtaInspector slide={slide} onChange={onChange} options={options} brief={brief} />;
}

// Survives navigating to another admin page and back within the tab — saved
// projects (phase 3) replace this.
const SESSION_KEY = "socialStudio:v1";

type StudioSession = {
  view: "find" | "edit";
  brief: Brief;
  sort: Sort;
  selection: Candidate[];
  slides: SlideData[];
  aspect: Aspect;
};

function readSession(): Partial<StudioSession> {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

// The search panel is position: fixed so the narrow, scrolling slide rail
// doesn't clip it.
function AddStylistPopover({ brief, selectedIds, onAdd }: { brief: Brief; selectedIds: Set<string>; onAdd: (candidate: Candidate) => void }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setAnchor(null);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setAnchor(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  const panelWidth = Math.min(420, window.innerWidth - 32);
  const opensUp = anchor ? anchor.bottom + 420 > window.innerHeight : false;

  return (
    <>
      <button
        type="button"
        onClick={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
        aria-expanded={Boolean(anchor)}
        className="flex h-10 w-32 shrink-0 items-center justify-center gap-1.5 border border-dashed border-stone-300 text-xs font-medium text-stone-600 hover:border-stone-500 hover:text-stone-950 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-100 md:w-auto"
      >
        <Plus className="size-3.5" /> Add stylist
      </button>
      {anchor ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Add stylist"
          className="fixed z-50 space-y-2 border border-stone-300 bg-white p-3 shadow-[0_16px_40px_-12px_rgba(28,25,23,0.35)] dark:border-stone-700 dark:bg-stone-900"
          style={{
            width: panelWidth,
            left: Math.max(16, Math.min(anchor.left, window.innerWidth - panelWidth - 16)),
            ...(opensUp ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Add stylist</span>
            <button type="button" aria-label="Close" onClick={() => setAnchor(null)} className="text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
              <X className="size-3.5" />
            </button>
          </div>
          <StylistNameSearch
            brief={brief}
            selectedIds={selectedIds}
            resultsInline
            placeholder="Name or @handle"
            autoFocus
            onAdd={(candidate) => {
              onAdd(candidate);
              setAnchor(null);
            }}
          />
          <p className="text-[11px] leading-snug text-stone-500">Searches the whole directory. Added just before the closing slide.</p>
        </div>
      ) : null}
    </>
  );
}

export default function SocialStudio() {
  const initial = useMemo(readSession, []);
  const { options, error: optionsError } = useBriefOptions();
  const [view, setView] = useState<"find" | "edit">(initial.view ?? "find");
  const [brief, setBrief] = useState<Brief>(initial.brief ?? EMPTY_BRIEF);
  const [sort, setSort] = useState<Sort>(initial.sort ?? "photos");
  const [selection, setSelection] = useState<Candidate[]>(initial.selection ?? []);
  const [slides, setSlides] = useState<SlideData[]>(initial.slides ?? []);
  const [aspect, setAspect] = useState<Aspect>(initial.aspect ?? "9:16");
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [overflow, setOverflow] = useState<Record<number, boolean>>({});
  const [exporting, setExporting] = useState<"one" | "all" | null>(null);
  const [exportError, setExportError] = useState("");
  const frameRefs = useRef(new Map<number, HTMLElement>());
  const [canvasRef, canvasSize] = useElementSize<HTMLDivElement>();

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ view, brief, sort, selection, slides, aspect } satisfies StudioSession));
    } catch {
      // Storage full or blocked — the studio still works, it just won't survive a reload.
    }
  }, [view, brief, sort, selection, slides, aspect]);

  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, slides.length - 1));
  const focused = slides[safeFocusedIndex];
  const canvas = CANVAS[aspect];
  const previewWidth = useMemo(() => {
    if (!canvasSize.width || !canvasSize.height) return 0;
    return Math.floor(Math.min(canvasSize.width, (canvasSize.height * canvas.width) / canvas.height));
  }, [canvasSize, canvas]);

  const featuredIds = useMemo(
    () => new Set(slides.flatMap((slide) => (slide.type === "list" ? [slide.salonId] : []))),
    [slides],
  );

  const updateSlide = useCallback((index: number, next: SlideData) => {
    setSlides((current) => current.map((slide, slideIndex) => (slideIndex === index ? next : slide)));
  }, []);

  const patchCover = useCallback((patch: Partial<CoverSlideData>) => {
    setSlides((current) => current.map((slide) => (slide.type === "cover" ? { ...slide, ...patch } : slide)));
  }, []);

  // A fetched Instagram photo joins the stylist's pool and, if the layout has
  // an empty cell, goes straight onto the slide. Merged by salonId so it lands
  // correctly even if you've switched slides while it downloaded.
  const addListPhoto = useCallback((salonId: string, src: string) => {
    setSlides((current) =>
      current.map((slide) => {
        if (slide.type !== "list" || slide.salonId !== salonId || slide.photoPool.includes(src)) return slide;
        const hasRoom = slide.cells.length < layoutCellCount(slide.layout);
        return {
          ...slide,
          photoPool: [...slide.photoPool, src],
          cells: hasRoom ? [...slide.cells, { src, focusX: 50, focusY: 50 }] : slide.cells,
        };
      }),
    );
  }, []);

  // The first few photos of every stylist in the carousel, for the cover picker.
  const coverPhotoChoices = useMemo(
    () => [...new Set(slides.flatMap((slide) => (slide.type === "list" ? slide.photoPool.slice(0, 4) : [])))],
    [slides],
  );

  const reportOverflow = useCallback((index: number, value: boolean) => {
    setOverflow((current) => (current[index] === value ? current : { ...current, [index]: value }));
  }, []);

  const buildFromSelection = () => {
    if (!options) return;
    if (slides.length && !window.confirm("Rebuild the carousel from this selection? Text and photo choices you've edited will be replaced.")) return;
    setSlides(buildCarousel(brief, options, selection, directoryTotal));
    setFocusedIndex(0);
    setOverflow({});
    setView("edit");
  };

  // New stylist slides go just before the closing "find more" slide.
  const addStylistSlide = (candidate: Candidate) => {
    const ctaIndex = slides.findIndex((slide) => slide.type === "cta");
    const insertAt = ctaIndex === -1 ? slides.length : ctaIndex;
    setSlides((current) => [...current.slice(0, insertAt), candidateToListSlide(candidate), ...current.slice(insertAt)]);
    setSelection((current) => (current.some((item) => item.id === candidate.id) ? current : [...current, candidate]));
    setFocusedIndex(insertAt);
  };

  const removeSlide = (index: number) => {
    const slide = slides[index];
    setSlides((current) => current.filter((_, slideIndex) => slideIndex !== index));
    if (slide?.type === "list") setSelection((current) => current.filter((item) => item.id !== slide.salonId));
    setOverflow({});
  };

  const moveSlide = (index: number, delta: -1 | 1) => {
    setSlides((current) => {
      const next = [...current];
      const [slide] = next.splice(index, 1);
      next.splice(index + delta, 0, slide);
      return next;
    });
    setFocusedIndex(index + delta);
    setOverflow({});
  };

  const exportSlides = async (indexes: number[], mode: "one" | "all") => {
    setExporting(mode);
    setExportError("");
    try {
      for (const index of indexes) {
        const node = frameRefs.current.get(index);
        if (!node) continue;
        const dataUrl = await renderSlidePng(node, canvas.width, canvas.height);
        downloadDataUrl(dataUrl, slideFilename(slides[index], index, aspect));
      }
    } catch {
      setExportError("Export failed — usually an image that couldn't be loaded for drawing. Try again, or swap the photo.");
    } finally {
      setExporting(null);
    }
  };

  const overflowCount = slides.filter((_, index) => overflow[index]).length;
  const tabClass = (active: boolean) =>
    cn(
      "relative h-12 px-1 text-sm font-medium transition-colors",
      active
        ? "text-stone-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-stone-950 dark:text-stone-50 dark:after:bg-stone-100"
        : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200",
    );

  return (
    <div className="flex h-[100dvh] min-h-[640px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-stone-200 bg-white px-5 dark:border-stone-800 dark:bg-stone-950">
        <div className="flex min-w-0 items-center gap-6">
          <h1 className="text-lg font-semibold text-stone-950 dark:text-stone-50">Studio</h1>
          <nav aria-label="Studio steps" className="flex gap-5">
            <button type="button" className={tabClass(view === "find")} aria-current={view === "find"} onClick={() => setView("find")}>
              Find stylists
              {selection.length ? <span className="ml-1.5 tabular-nums text-stone-400">{selection.length}</span> : null}
            </button>
            <button type="button" className={tabClass(view === "edit")} aria-current={view === "edit"} onClick={() => setView("edit")}>
              Edit carousel
              {slides.length ? <span className="ml-1.5 tabular-nums text-stone-400">{slides.length}</span> : null}
            </button>
          </nav>
        </div>
        {view === "edit" ? (
          <div className="flex flex-wrap items-center gap-2 py-2">
            <Segmented
              value={aspect}
              onChange={setAspect}
              options={[
                { value: "9:16", label: "9:16 · 1080×1920" },
                { value: "4:5", label: "4:5 · 1080×1350" },
              ]}
            />
            <Button
              type="button"
              variant={showSafeZones ? "default" : "outline"}
              onClick={() => setShowSafeZones((current) => !current)}
              aria-pressed={showSafeZones}
              className="h-9 gap-1.5 px-3 text-xs"
            >
              <ScanLine className="size-3.5" />
              Safe zones
            </Button>
            <Button type="button" variant="outline" className="h-9 gap-1.5 px-3 text-xs" disabled={!focused || exporting !== null} onClick={() => exportSlides([safeFocusedIndex], "one")}>
              {exporting === "one" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              This slide
            </Button>
            <Button type="button" className="h-9 gap-1.5 px-3 text-xs" disabled={!slides.length || exporting !== null} onClick={() => exportSlides(slides.map((_, index) => index), "all")}>
              {exporting === "all" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              All slides
            </Button>
          </div>
        ) : null}
      </header>

      {optionsError || exportError ? (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">
          {optionsError || exportError}
        </p>
      ) : null}

      {view === "find" ? (
        options ? (
          <FinderView
            options={options}
            brief={brief}
            onBriefChange={setBrief}
            sort={sort}
            onSortChange={setSort}
            selection={selection}
            onSelectionChange={setSelection}
            onBuild={buildFromSelection}
            hasExistingSlides={slides.length > 0}
            onDirectoryTotal={setDirectoryTotal}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-stone-500">
            {optionsError ? null : <Loader2 className="size-4 animate-spin" />}
            {optionsError ? null : "Loading filters…"}
          </div>
        )
      ) : slides.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">No carousel yet.</p>
          <p className="max-w-sm text-sm text-stone-500">Pick stylists in Find stylists, then build the carousel — the cover, one slide per stylist and the closing slide are filled in for you.</p>
          <Button type="button" variant="outline" onClick={() => setView("find")} className="mt-2 h-10">
            Find stylists
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[168px_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[168px_minmax(0,1fr)_320px]">
          {/* Phone width: rail, preview and inspector stack and the page scrolls. */}
          {/* Slides rail */}
          <nav aria-label="Slides" className="flex shrink-0 gap-3 overflow-x-auto border-b border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r">
            {options && brief ? (
              <p className="hidden text-[11px] leading-snug text-stone-500 md:block">{describeBrief(brief, options) || "Hand-picked"}</p>
            ) : null}
            {overflowCount ? (
              <p className="hidden items-start gap-1.5 text-[11px] leading-snug text-red-600 md:flex">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                {overflowCount} slide{overflowCount === 1 ? "" : "s"} with text outside the safe area
              </p>
            ) : null}
            {slides.map((slide, index) => (
              <button
                key={`${slide.type}-${slide.type === "list" ? slide.salonId : index}`}
                type="button"
                onClick={() => setFocusedIndex(index)}
                aria-current={index === safeFocusedIndex}
                aria-label={`Slide ${index + 1}: ${slideLabel(slide)}${overflow[index] ? " — text outside the safe area" : ""}`}
                className="group shrink-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-600"
              >
                <div
                  className={cn(
                    "relative border-2 transition-colors",
                    index === safeFocusedIndex ? "border-stone-950 dark:border-stone-100" : "border-transparent group-hover:border-stone-300 dark:group-hover:border-stone-700",
                    overflow[index] ? "!border-red-500" : "",
                  )}
                >
                  <ScaledSlide
                    slide={slide}
                    aspect={aspect}
                    width={136}
                    frameRef={(node) => {
                      if (node) frameRefs.current.set(index, node);
                      else frameRefs.current.delete(index);
                    }}
                    onOverflowChange={(value) => reportOverflow(index, value)}
                  />
                  {overflow[index] ? (
                    <span className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-red-600 text-white" title="Text outside the safe area">
                      <AlertTriangle className="size-3" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex items-baseline gap-1.5 text-[11px] text-stone-500">
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">{String(index + 1).padStart(2, "0")}</span>
                  <span className="truncate">{slideLabel(slide)}</span>
                </p>
              </button>
            ))}
            <AddStylistPopover brief={brief} selectedIds={featuredIds} onAdd={addStylistSlide} />
          </nav>

          {/* Canvas */}
          <div className="flex h-[72dvh] min-h-[420px] min-w-0 shrink-0 flex-col bg-stone-200/70 p-4 dark:bg-stone-900 md:h-auto md:shrink md:p-6">
            <div ref={canvasRef} className="flex min-h-0 flex-1 items-center justify-center">
              {focused && previewWidth > 0 ? (
                <div className="shadow-[0_24px_60px_-20px_rgba(28,25,23,0.45)]">
                  <ScaledSlide slide={focused} aspect={aspect} width={previewWidth} showSafeZones={showSafeZones} />
                </div>
              ) : null}
            </div>
            {focused && overflow[safeFocusedIndex] ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="size-3.5" />
                Some text spills outside the safe area — shorten it so TikTok doesn't crop it.
              </p>
            ) : null}
          </div>

          {/* Inspector */}
          <aside className="shrink-0 border-t md:min-h-0 md:shrink md:overflow-y-auto border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950 md:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
            {focused ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    Slide {safeFocusedIndex + 1} · {slideLabel(focused)}
                  </p>
                  {focused.type === "list" ? (
                    <div className="flex">
                      <button type="button" aria-label="Move slide earlier" disabled={slides[safeFocusedIndex - 1]?.type !== "list"} onClick={() => moveSlide(safeFocusedIndex, -1)} className="inline-flex size-7 items-center justify-center text-stone-500 hover:text-stone-950 disabled:opacity-30 dark:hover:text-stone-100">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button type="button" aria-label="Move slide later" disabled={slides[safeFocusedIndex + 1]?.type !== "list"} onClick={() => moveSlide(safeFocusedIndex, 1)} className="inline-flex size-7 items-center justify-center text-stone-500 hover:text-stone-950 disabled:opacity-30 dark:hover:text-stone-100">
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button type="button" aria-label="Remove slide" onClick={() => removeSlide(safeFocusedIndex)} className="inline-flex size-7 items-center justify-center text-stone-500 hover:text-red-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <SlideInspector
                  slide={focused}
                  onChange={(next) => updateSlide(safeFocusedIndex, next)}
                  onPatchCover={patchCover}
                  onAddListPhoto={addListPhoto}
                  photoChoices={coverPhotoChoices}
                  options={options}
                  brief={brief}
                />
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
