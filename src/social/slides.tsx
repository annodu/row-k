// Social Studio slide templates — ported from the Claude Design
// "Creative Braids · Carousel" (carousel.jsx), rebuilt so every piece of text
// lays out inside the TikTok safe box instead of at absolute pixel offsets,
// which is what lets one template serve both 4:5 and 9:16.

import { type CSSProperties, type ReactNode, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import halftoneTexture from "./assets/halftone-texture.jpg";
import {
  type Aspect,
  type ChecklistGroup,
  type CoverSlideData,
  type CtaSlideData,
  type ListSlideData,
  type PhotoCell,
  type SlideData,
  CANVAS,
  DEFAULT_CTA_LAYOUT,
  FONT_DISPLAY,
  FONT_SERIF,
  FONT_UI,
  PALETTE,
  SAFE_ZONES,
  getPhotoLayout,
} from "./model";

export const DEFAULT_BACKGROUND = halftoneTexture;

// ── Primitives ─────────────────────────────────────────────────────────────

function Halftone({ color = PALETTE.espresso, opacity = 0.55 }: { color?: string; opacity?: number }) {
  return (
    <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <pattern id={`dots-${color.replace("#", "")}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="2.4" fill={color} opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dots-${color.replace("#", "")})`} />
    </svg>
  );
}

function ScribbleArrow({ color = PALETTE.offwhite, style }: { color?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 220 340" style={style} aria-hidden>
      <g fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M150,14 C 185,62 195,112 165,144 C 130,174 98,154 122,122 C 142,96 182,128 162,182 C 150,222 130,258 100,278 C 70,295 35,298 15,282" />
        <path d="M15,282 L 42,272" />
        <path d="M15,282 L 30,302" />
      </g>
    </svg>
  );
}

function Photo({ cell, style }: { cell: PhotoCell | undefined; style?: CSSProperties }) {
  if (!cell?.src) {
    return (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: `repeating-linear-gradient(135deg, ${PALETTE.smoky} 0 12px, #342d29 12px 24px)`,
          ...style,
        }}
      />
    );
  }
  return (
    <div style={{ position: "relative", overflow: "hidden", background: PALETTE.smoky, ...style }}>
      <img
        src={cell.src}
        alt=""
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${cell.focusX}% ${cell.focusY}%`,
          display: "block",
        }}
      />
    </div>
  );
}

// Shrinks its font size until the text fits the box it's given (width always,
// height when `maxHeight` is set). Long stylist names and cover titles are the
// usual reason text would otherwise spill out of the safe box.
function FitText({
  children,
  maxSize,
  minSize = 18,
  maxHeight,
  style,
}: {
  children: ReactNode;
  maxSize: number;
  minSize?: number;
  maxHeight?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(maxSize);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    let next = maxSize;
    el.style.fontSize = `${next}px`;
    while (next > minSize && (el.scrollWidth > el.clientWidth + 1 || (maxHeight !== undefined && el.scrollHeight > maxHeight + 1))) {
      next -= 2;
      el.style.fontSize = `${next}px`;
    }
    setSize(next);
  }, [maxSize, minSize, maxHeight]);

  useLayoutEffect(fit, [fit, children]);
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, [fit]);

  return (
    <div ref={ref} data-fit-text style={{ width: "100%", overflowWrap: "normal", ...style, fontSize: size }}>
      {children}
    </div>
  );
}

// Everything that must survive TikTok's UI/cropping goes in here.
function SafeBox({ aspect, children, style }: { aspect: Aspect; children: ReactNode; style?: CSSProperties }) {
  const inset = SAFE_ZONES[aspect];
  return (
    <div
      data-safe-box
      style={{
        position: "absolute",
        top: inset.top,
        right: inset.right,
        bottom: inset.bottom,
        left: inset.left,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Slide frame ────────────────────────────────────────────────────────────

type SlideProps<T> = { data: T; aspect: Aspect };

export const SlideFrame = forwardRef<
  HTMLElement,
  { aspect: Aspect; children: ReactNode; background?: string; onOverflowChange?: (overflowing: boolean) => void }
>(function SlideFrame({ aspect, children, background = PALETTE.espresso, onOverflowChange }, ref) {
  const { width, height } = CANVAS[aspect];
  const innerRef = useRef<HTMLElement | null>(null);

  // A safe box whose content is bigger than the box means something is
  // sitting in TikTok's danger area — flagged in the slides rail.
  useEffect(() => {
    if (!onOverflowChange || !innerRef.current) return;
    const root = innerRef.current;
    // Compares element edges rather than scroll size: a serif italic's line
    // box can report a few px of "overflow" with nothing actually outside.
    const check = () => {
      const scale = root.getBoundingClientRect().width / width || 1;
      const tolerance = 2 * scale;
      const overflowing = [...root.querySelectorAll<HTMLElement>("[data-safe-box]")].some((box) => {
        const bounds = box.getBoundingClientRect();
        const outside = [...box.querySelectorAll<HTMLElement>("*")].some((el) => {
          // Decorative pieces allowed to bleed into TikTok's UI area.
          if (el.closest("[data-safe-exempt]")) return false;
          const rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) return false;
          return (
            rect.left < bounds.left - tolerance ||
            rect.right > bounds.right + tolerance ||
            rect.top < bounds.top - tolerance ||
            rect.bottom > bounds.bottom + tolerance
          );
        });
        // FitText at its minimum size can still be too wide for its box.
        const clipped = [...box.querySelectorAll<HTMLElement>("[data-fit-text]")].some((el) => el.scrollWidth > el.clientWidth + 2);
        return outside || clipped;
      });
      onOverflowChange(overflowing);
    };
    const observer = new ResizeObserver(check);
    root.querySelectorAll("[data-safe-box], [data-safe-box] *").forEach((el) => observer.observe(el));
    document.fonts?.ready.then(check);
    check();
    return () => observer.disconnect();
  });

  return (
    <section
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      style={{
        position: "relative",
        width,
        height,
        background,
        overflow: "hidden",
        color: PALETTE.offwhite,
        flexShrink: 0,
      }}
    >
      {children}
    </section>
  );
});

// ── Cover ──────────────────────────────────────────────────────────────────

function CoverSlide({ data, aspect }: SlideProps<CoverSlideData>) {
  const tall = aspect === "9:16";
  const safe = SAFE_ZONES[aspect];
  const safeHeight = CANVAS[aspect].height - safe.top - safe.bottom;
  const hasSubject = Boolean(data.subject);

  return (
    <>
      {/* Dithered cityscape from the Claude Design reference — always the
          backdrop, so the cut-out reads like the WASH & GO / SEW INS covers. */}
      <Photo cell={{ src: DEFAULT_BACKGROUND, focusX: 50, focusY: 50 }} style={{ position: "absolute", inset: 0 }} />

      {/* Until the main image has its background removed, show it full-bleed
          under a halftone so the cover still works as a draft. */}
      {!hasSubject && data.photo ? (
        <>
          <Photo cell={{ src: data.photo, focusX: 50, focusY: 50 }} style={{ position: "absolute", inset: 0 }} />
          <Halftone color={PALETTE.espresso} opacity={0.55} />
        </>
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(26,21,18,0) 55%, rgba(26,21,18,.45) 100%)" }} />

      {/* Cut-out in front of the headline and kicker, behind the sign-off. */}
      {hasSubject ? (
        <img
          src={data.subject}
          alt=""
          style={{
            position: "absolute",
            left: `${data.subjectOffsetX ?? 0}%`,
            bottom: `${-(data.subjectOffsetY ?? 0)}%`,
            maxWidth: `${80 * ((data.subjectScale ?? 100) / 100)}%`,
            height: `${(tall ? 66 : 76) * ((data.subjectScale ?? 100) / 100)}%`,
            objectFit: "contain",
            objectPosition: "left bottom",
            zIndex: 2,
          }}
        />
      ) : null}

      <SafeBox aspect={aspect}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <FitText
            maxSize={tall ? 300 : 270}
            minSize={110}
            maxHeight={safeHeight * 0.52}
            style={{ fontFamily: FONT_DISPLAY, lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase", color: PALETTE.offwhite }}
          >
            {data.titleTop ? <div>{data.titleTop}</div> : null}
            <div>{data.title}</div>
          </FitText>
          {data.kicker ? (
            <div
              style={{
                marginTop: 30,
                marginLeft: "auto",
                maxWidth: "58%",
                textAlign: "right",
                fontFamily: FONT_DISPLAY,
                fontSize: 42,
                lineHeight: 1.1,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                color: PALETTE.offwhite,
              }}
            >
              {data.kicker}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minHeight: 0 }} />

        <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ color: PALETTE.offwhite, textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,.35)" }}>
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 140, lineHeight: 1 }}>{data.handle}</div>
            {data.subtitle ? <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 52, lineHeight: 1, marginTop: 12 }}>{data.subtitle}</div> : null}
          </div>
          <ScribbleArrow style={{ width: 200, height: 300, flexShrink: 0, opacity: 0.95 }} />
        </div>
      </SafeBox>
    </>
  );
}

// ── List (one stylist) ─────────────────────────────────────────────────────

// Stylist card in the ROW K mobile result-row style (stone-100 panel, Figtree,
// stone-300 rule), sized for TikTok: the Instagram handle and the 📍
// location, each on its own row. No stylist name — the handle is the credit.
const ROW = {
  background: "#f5f5f4", // stone-100 — the site's page background
  ink: "#0c0a09", // stone-950
  secondary: "#44403c", // stone-700
};

function InstagramGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" aria-hidden style={{ flexShrink: 0, display: "block" }}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}

const CARD_PADDING_X = 48;

// Rows keep the spacing a divider used to give them, without the rule.
function CardGap() {
  return <div style={{ height: 63 }} />;
}

function StylistRowCard({ data }: { data: ListSlideData }) {
  const iconSize = 46;
  const lineStyle = { display: "flex", alignItems: "center", gap: 20 } as const;

  return (
    <div
      style={{
        width: "100%",
        background: ROW.background,
        color: ROW.ink,
        fontFamily: FONT_UI,
        padding: `44px ${CARD_PADDING_X}px`,
        boxShadow: "0 24px 60px rgba(12,10,9,.35)",
      }}
    >
      <div style={lineStyle}>
        <InstagramGlyph size={iconSize} color={ROW.ink} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <FitText maxSize={46} minSize={28} style={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
            {data.handle}
          </FitText>
        </div>
      </div>

      {data.locationTag ? (
        <>
          <CardGap />
          <div style={lineStyle}>
            <span style={{ width: iconSize, flexShrink: 0, textAlign: "center", fontSize: 42, lineHeight: 1 }}>📍</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <FitText maxSize={46} minSize={28} style={{ fontWeight: 500, color: ROW.secondary, lineHeight: 1.2, whiteSpace: "nowrap" }}>
                {data.locationTag}
              </FitText>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ListSlide({ data, aspect }: SlideProps<ListSlideData>) {
  const layout = getPhotoLayout(data.layout);
  const cellNames = [...new Set(layout.areas.join(" ").split(" "))];

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: layout.columns,
          gridTemplateRows: layout.rows,
          gridTemplateAreas: layout.areas.map((row) => `"${row}"`).join(" "),
          gap: 6,
          background: PALETTE.espresso,
        }}
      >
        {cellNames.map((name, index) => (
          <Photo key={name} cell={data.cells[index]} style={{ gridArea: name, minWidth: 0, minHeight: 0 }} />
        ))}
      </div>

      {/* Sits at the bottom of the safe box — like the row under its photo
          on the site — while staying clear of TikTok's caption area. */}
      <SafeBox aspect={aspect} style={{ justifyContent: "flex-end" }}>
        <StylistRowCard data={data} />
      </SafeBox>
    </>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────

// The public site's filter panel (App.tsx: "Services" / "Locations" / "Price"
// sections) and its search input, drawn at ~1.6× from the same stone tokens:
// stone-100 panel, stone-300 rules, 20px square stone-500 checkboxes that
// fill stone-950 with a white tick, 15px stone-800 labels, count badge.
const SITE = {
  panel: "#f5f5f4", // stone-100
  rule: "#d6d3d1", // stone-300
  box: "#78716c", // stone-500
  ink: "#0c0a09", // stone-950
  label: "#292524", // stone-800
  chevron: "#44403c", // stone-700
  placeholder: "#a8a29e", // stone-400
};
// Keeps every ticked row (and its order), filling the rest with unticked ones,
// so a long list like Braids' 20 styles can't push a sheet out of the safe box.
function visiblePanelRows(rows: ChecklistGroup["rows"], max: number) {
  if (rows.length <= max) return rows;
  const keep = new Set(rows.filter((row) => row.checked).slice(0, max));
  // Fill from the parent of the first ticked row onwards (e.g. "London" then
  // its areas), so the sheet reads like that section of the real filter list.
  const firstTicked = rows.findIndex((row) => row.checked);
  let start = Math.max(0, firstTicked);
  while (start > 0 && rows[start].indent) start -= 1;
  const ordered = [...rows.slice(start), ...rows.slice(0, start)];
  for (const row of ordered) {
    if (keep.size >= max) break;
    keep.add(row);
  }
  return rows.filter((row) => keep.has(row));
}

function SiteCheckbox({ checked, size }: { checked: boolean; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${checked ? SITE.ink : SITE.box}`,
        background: checked ? SITE.ink : "#fff",
      }}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </span>
  );
}

// A loose sheet of the site's filter list (like a phone screenshot of it):
// no section header, just the checkbox rows with nested styles/areas indented.
// Several groups stack in one sheet (e.g. Locations then Price), separated by
// a gap like the site's panel sections.
function FilterSheet({ groups, scale = 1, style }: { groups: { group: ChecklistGroup; maxRows: number }[]; scale?: number; style?: CSSProperties }) {
  const box = Math.round(30 * scale);
  return (
    // Allowed to run past the safe box (like the Canva slide) — exempt from the overflow check.
    <div data-safe-exempt style={{ background: SITE.panel, fontFamily: FONT_UI, padding: `${Math.round(22 * scale)}px ${Math.round(24 * scale)}px`, boxShadow: "0 18px 44px rgba(0,0,0,.45)", ...style }}>
      {groups.map(({ group, maxRows }, groupIndex) => (
        <div key={group.title} style={{ marginTop: groupIndex ? Math.round(22 * scale) : 0 }}>
          {visiblePanelRows(group.rows, maxRows).map((row) => (
            <div
              key={`${row.indent ? "sub" : "top"}-${row.label}`}
              style={{ display: "flex", alignItems: "flex-start", gap: Math.round(16 * scale), padding: `${Math.round(9 * scale)}px 0`, paddingLeft: Math.round(Number(row.indent || 0) * 34 * scale) }}
            >
              <SiteCheckbox checked={row.checked} size={box} />
              <span style={{ fontSize: Math.round(25 * scale), lineHeight: 1.2, color: SITE.label, paddingTop: Math.round(2 * scale) }}>{row.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// The site's search input: white, stone-300 border, search icon on the left.
function SiteSearchBar({ text }: { text: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: 116,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "0 34px",
        background: "#fff",
        border: `3px solid ${SITE.rule}`,
        fontFamily: FONT_UI,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      }}
    >
      <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke={SITE.placeholder} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span style={{ minWidth: 0, flex: 1, textAlign: "left", fontSize: 48, color: SITE.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}

const CAPTION_BOX = { background: "#5a1915", text: "#f4dcd3" };

// "1,150+ stylists. filter by service & location": the first sentence bold,
// with a maroon highlight that hugs each line (rounded per line, lines
// touching) like the Canva closing slide, rather than one rectangle.
function CaptionBox({ caption, fontSize = 62, style }: { caption: string; fontSize?: number; style?: CSSProperties }) {
  const split = caption.indexOf(". ");
  const lead = split === -1 ? "" : caption.slice(0, split + 1);
  const rest = split === -1 ? caption : caption.slice(split + 2);
  const highlight: CSSProperties = {
    background: CAPTION_BOX.background,
    color: CAPTION_BOX.text,
    padding: "2px 18px 8px",
    borderRadius: 20,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  };
  return (
    // Side padding matches the highlight's, so its rounded ends stay inside the box.
    <div style={{ padding: "0 18px", fontFamily: FONT_SERIF, fontStyle: "italic", fontSize, lineHeight: 1.16, textAlign: "center", filter: "drop-shadow(0 14px 30px rgba(0,0,0,.4))", ...style }}>
      <span style={highlight}>
        {lead ? <span style={{ fontWeight: 700 }}>{lead} </span> : null}
        {rest}
      </span>
    </div>
  );
}

function CtaSlide({ data, aspect }: SlideProps<CtaSlideData>) {
  const tall = aspect === "9:16";
  const services = data.checklists.find((group) => group.title === "Services");
  const locations = data.checklists.find((group) => group.title === "Locations");
  const price = data.checklists.find((group) => group.title === "Price");
  const priceTicked = Boolean(price?.rows.some((row) => row.checked));
  const layout = { ...DEFAULT_CTA_LAYOUT, ...data.layout };

  return (
    <>
      <Photo cell={{ src: data.photo || DEFAULT_BACKGROUND, focusX: 50, focusY: 50 }} style={{ position: "absolute", inset: 0 }} />
      <Halftone color="#000000" opacity={0.9} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,.55) 100%)" }} />

      <SafeBox aspect={aspect} style={{ alignItems: "center", textAlign: "center", gap: tall ? 34 : 22 }}>
        <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 72, lineHeight: 1 }}>{data.kicker}</div>
        {/* Each title line stays whole and shrinks to fit, so "BLACK HAIR" /
            "SALONS" is two lines at both sizes and leaves room for the sheets. */}
        <FitText maxSize={130} minSize={60} style={{ fontFamily: FONT_DISPLAY, lineHeight: 0.92, letterSpacing: "-0.01em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          <div>{data.titleTop}</div>
          <div>{data.title}</div>
        </FitText>

        <SiteSearchBar text={data.url} />

        {/* Two criss-crossing filter sheets (Services on top, tilted left;
            Locations behind, tilted right) with the caption over them — the
            Canva closing-slide composition. The sheets may run off the bottom
            into TikTok's UI area but not off the left; the caption stays
            inside the safe box. */}
        <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", textAlign: "left" }}>
          {locations ? (
            <FilterSheet
              groups={[{ group: locations, maxRows: priceTicked ? 8 : 11 }, ...(price && priceTicked ? [{ group: price, maxRows: 5 }] : [])]}
              scale={0.62 * (layout.locations.size / 100)}
              style={{
                position: "absolute",
                left: `${44 + layout.locations.dx}%`,
                top: `${2 + layout.locations.dy}%`,
                width: `${23 * (layout.locations.size / 100)}%`,
                transform: "rotate(11deg)",
                zIndex: 1,
              }}
            />
          ) : null}
          {services ? (
            <FilterSheet
              groups={[{ group: services, maxRows: 10 }]}
              scale={0.85 * (layout.services.size / 100)}
              style={{
                position: "absolute",
                left: `${10 + layout.services.dx}%`,
                top: `${8 + layout.services.dy}%`,
                width: `${37 * (layout.services.size / 100)}%`,
                transform: "rotate(-12deg)",
                zIndex: 2,
                boxShadow: "18px 22px 40px rgba(0,0,0,.55)",
              }}
            />
          ) : null}
          <CaptionBox
            caption={data.caption}
            fontSize={62 * (layout.caption.size / 100)}
            style={{
              position: "absolute",
              left: `${46 + layout.caption.dx}%`,
              top: `${32 + layout.caption.dy}%`,
              width: `${54 * (layout.caption.width / 100)}%`,
              zIndex: 3,
            }}
          />
        </div>
      </SafeBox>
    </>
  );
}

// ── Public ─────────────────────────────────────────────────────────────────

export function SlideContent({ slide, aspect }: { slide: SlideData; aspect: Aspect }) {
  if (slide.type === "cover") return <CoverSlide data={slide} aspect={aspect} />;
  if (slide.type === "cta") return <CtaSlide data={slide} aspect={aspect} />;
  return <ListSlide data={slide} aspect={aspect} />;
}

// Editor-only shading of the area TikTok's UI covers. Never part of an export.
export function SafeZoneOverlay({ aspect }: { aspect: Aspect }) {
  const { width, height } = CANVAS[aspect];
  const inset = SAFE_ZONES[aspect];
  const shade = "rgba(220, 38, 38, 0.22)";
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, height: inset.top, background: shade }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width, height: inset.bottom, background: shade }} />
      <div style={{ position: "absolute", left: 0, top: inset.top, width: inset.left, bottom: inset.bottom, background: shade }} />
      <div style={{ position: "absolute", right: 0, top: inset.top, width: inset.right, bottom: inset.bottom, background: shade }} />
      <div
        style={{
          position: "absolute",
          top: inset.top,
          left: inset.left,
          right: inset.right,
          bottom: inset.bottom,
          outline: "3px dashed rgba(220, 38, 38, 0.85)",
        }}
      />
    </div>
  );
}
