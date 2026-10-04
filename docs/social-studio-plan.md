# Social Studio — plan

A new admin section for making TikTok assets from directory data: **carousels** (multi-slide, swipeable) and **single 9:16 images** (video covers, hook frames, overlays for editing in CapCut). It plugs into the stylist data, photo fetching and crop tools the admin already has.

Source material: the Claude Design "Creative Braids – Carousel" export (`carousel.jsx`, `tweaks-panel.jsx`, `Carousel Template.html`, reference PNGs). This plan keeps its visual language and swaps its hand-typed "Tweaks" panel for data from the directory.

---

## 1. The workflow (what you do, step by step)

```
Brief ──▶ Find stylists ──▶ Pick photos ──▶ Lay out slides ──▶ Export
"boho     East · £           per stylist:     cover / list /     PNGs (zip)
 braids"  overview cards     portfolio +      CTA, layout        + caption
          select 3–8         fetch from IG    per slide          text
```

1. **Brief.** Start a project with a service, area and price band (e.g. *Boho braids · East London · £*), a format (carousel or single image) and an aspect ratio. The brief also drives the cover text.
2. **Find.** You get a results grid of matching stylists. Each card shows:
   - name, @handle, area, price band, the services that matched, Google and verified review counts
   - a strip of the photos we already have (`portfolioPhotos`), with a count
   - Instagram and booking links (they open in a new tab)
   - a badge for **"Featured in: Sew-ins carousel · 12 Sep"** if they've appeared before, so you don't repeat people by accident
   - a warning for **"Only 1 photo"** or **"No booking link"**, because those make a weak slide

   Sort by photo count, reviews or recently added. Tick stylists to add them to a selection tray, the same pattern as `PhotoSearchPicksBar`.

   **Add by name:** a search box above the results, also available inside the editor (e.g. "+ Add stylist" in the slides rail).
   - Type a stylist's name or @handle and pick them from the dropdown. That adds them straight to the selection, or to the carousel as a new slide.
   - It searches the **whole directory**, ignoring the brief's filters, so you can include someone who doesn't strictly match.
   - Matching reuses `stylistMatchesSearch` (name, handle, Instagram and booking URLs). Each result shows a thumbnail, area and price band, so similarly named stylists are easy to tell apart.
   - A stylist added this way who doesn't match the brief gets a small "outside brief" tag. That's a heads-up only; they're still included.
   - Brief-filtered results and name-added stylists end up in the same tray, and you can reorder them before slides are generated.
   - Brief, filters and name search are all optional: you can start a project by name search alone, e.g. a single-stylist spotlight.
3. **Pick photos.** For each selected stylist:
   - the photos we already have are ready to pick
   - **"Fetch more from Instagram"** calls the existing `/api/admin/photo-search/:salonId`, which stays scoped to their own account. Results land in the same picker, and Reel cover frames are available through `ReelFramePicker`.
   - you choose which images go in, in order
   - a fetched image can optionally be saved to their directory portfolio too, through the existing approve route. This is off by default, so using a photo in a carousel doesn't publish it.
4. **Lay out.** Slides are created for you: **Cover → one list slide per stylist → CTA**. For each slide you choose a layout and drag photos into its cells. You can set a focal point per cell (reusing `RepositionableImage` and `computeCoverCropRegion`) and edit any text inline.
5. **Export.** You get PNGs at full resolution, as a zip for the whole carousel or one file per slide, plus a ready-to-paste TikTok caption: hook, stylist @handles, hashtags and `row-k.london`.

## 2. What gets filled in automatically (with no guessing)

Following the existing "no guess without evidence" rule, a field with no data behind it stays blank and is hidden on the slide. It is never invented.

| Slide field | Source |
|---|---|
| @handle | parsed from `instagramUrl` |
| Display name | `name` |
| Location pill (`📍 E LDN`) | `areaId` / `areaIds` mapped to short codes (E, SE, SW, N, NW, W, C, CR, Mobile) |
| Price | `priceBand` with its label from `price-bands.json` |
| Services line | the stylist's `services` that match the brief, in the canonical names from `filters.json` |
| IG profile card (avatar, @handle, display name) | `instagram.profile` via AnyAPI for the avatar, fetched when you ask for it and cached on the project. No post, follower or following counts are shown. |
| Cover title / kicker | Title: the service from the brief (`BOHO BRAIDS`). Kicker: the sibling subservices the selected stylists actually offer. |
| CTA "N stylists" | the live count from the salon index, not the hardcoded "400+" |

## 3. Slide templates and layouts

**Carousel templates**, ported from `carousel.jsx`:
- **Cover:** a full-bleed photo, halftone overlay, Bowlby One headline, italic Junicode "London / recs." and the scribble arrow. Optionally a portrait sits in front with its background removed, either in the tool (see Background removal below) or uploaded already cut out.
- **List:** one slide per stylist, with photo cells, the IG profile card overlay and the location pill (matches `Recommendation carousels - Row K (8).png`). The @handle always appears on every list slide and can't be removed; if the profile card is hidden, the handle falls back to a text label.
- **CTA:** halftone background, "find more / BLACK HAIR SALONS", the search bar holding `www.row-k.london`, and filter checklist cards. The cards are ticked from the brief's own service and area, so they always match the carousel.

**Photo layouts** for each list slide (you asked for "4, 2, 1"):

| Layout | Cells | Use |
|---|---|---|
| `1` | full bleed | one hero shot |
| `2-v` / `2-h` | split side-by-side / stacked | before/after, front/back |
| `3` | one large + two stacked | a hero shot plus detail |
| `4` | 2×2 | the default in the existing reference |

Each layout is a small data object (a grid template plus cell list). Adding a new one means adding one entry, not new code.

**9:16 single-image templates** (the image generator):
- **Video cover / thumbnail:** the cover template at 1080×1920.
- **Hook frame:** big text over a halftone photo ("5 boho braiders in East London under £100").
- **Stylist spotlight:** one stylist, 1–3 photos plus the profile card and location pill, for the end of a video.
- **Overlay pack (transparent PNGs):** the profile card, location pill and `row-k.london` search bar, each exported on transparency to drop into CapCut over footage.

**Aspect ratios:** both carousels and single images can be 4:5 (1080×1350) or 9:16 (1080×1920). You choose per project and can switch at any time. Layouts reflow, and focal points are kept.

**Safe perimeter (deliberately generous, because TikTok crops):**
- Photos and backgrounds still bleed to the edges. All **text, the profile card, the location pill and the handle** are confined to a safe box, and every template lays out inside that box. It's built into the layout, not just shown as a guide.
- Starting margins (in px, adjustable in one `SAFE_ZONES` constant):

  | Size | Top | Bottom | Left | Right |
  |---|---|---|---|---|
  | 9:16 · 1080×1920 | 260 | 560 | 100 | 200 |
  | 4:5 · 1080×1350 | 140 | 200 | 100 | 140 |

  The 9:16 margins leave room for TikTok's top tabs, the right-hand like/comment/share rail, and the caption, username and music area at the bottom. They also cover the extra crop when a 9:16 post is shown at other ratios. The 4:5 margins allow for TikTok zooming or cropping 4:5 into its 9:16 frame.
- A **safe-zone toggle** in the editor shades the danger area. It appears in the editor only and never in exports.
- If a long name or title spills out of the safe box, the slide shows a **red warning** in the slides rail, and text auto-shrinks to fit before it gets there.

## 4. Where it lives in the admin

- A new sidebar group, **"Social"**, containing **Studio** (projects list plus editor), between *Checks* and *Discover* in `ADMIN_NAV_GROUPS`.
- New `AdminView` ids: `"social"` (the projects list) and `"social-editor"`.

**Editor layout** (desktop first; on mobile it falls back to a preview-only view with export):

```
┌ Slides rail ┬──────── Canvas ─────────┬─ Inspector ──────────┐
│ 01 Cover    │                         │ Layout  [1][2][3][4] │
│ 02 @braidsx │    scaled live slide    │ Cells: drag photos   │
│ 03 @hairby  │   (true 1080 px, CSS    │ Text fields          │
│ 04 …        │    transform: scale)    │ Stylist: links,      │
│ 05 CTA      │                         │  fetch more photos   │
│ + add       │  [safe zones] [4:5|9:16]│ Photo tray (picked)  │
└─────────────┴─────────────────────────┴──────────────────────┘
```

Design direction:
- **The admin chrome follows `docs/design-system.md`:** `stone-*`, `rounded-none`, Figtree, sharp borders. The editor stays quiet and neutral so the slides are the loudest thing on screen.
- **The slides carry their own brand system:** Bowlby One, Junicode italic, the off-white / espresso / peach-gold palette from the Claude Design tokens, and the halftone.
- **The finder uses dense, scannable cards** with the photo strip as the main element. You're choosing by look first and metadata second.
- **Motion is minimal:** a 150 ms ease-out on selection and slide reorder, matching the existing `--ease-out` usage.

## 5. Technical design

### Data

A new file, `data/social-projects.json`, consistent with the existing JSON-file store:

```jsonc
{
  "projects": [{
    "id": "boho-east-budget-2026-10-04",
    "kind": "carousel" | "single",
    "aspect": "4:5" | "9:16",
    "brief": { "service": "Boho braids / goddess braids", "areaIds": ["east"], "priceBands": ["£"] },
    "palette": { /* the tokens from TWEAK_DEFAULTS */ },
    "slides": [
      { "type": "cover", "text": {...}, "photo": "<assetId>" },
      { "type": "list", "salonId": "…", "layout": "4",
        "cells": [{ "assetId": "…", "focusX": 50, "focusY": 30 }], "text": {...}, "showProfileCard": true },
      { "type": "cta", "text": {...} }
    ],
    "assets": { "<assetId>": { "url": "/social-assets/…jpg", "salonId": "…", "source": "portfolio|instagram|upload", "contextUrl": "…" } },
    "igProfiles": { "<salonId>": { "avatarAssetId": "…", "displayName": "…", "fetchedAt": "2026-10-04" } },
    "postedAt": null, "createdAt": "2026-10-04", "updatedAt": "2026-10-04"
  }]
}
```

- Dates are date-only, using `today()`.
- `"Featured in"` is derived from this file. There is no separate field on the salon. It counts only projects marked as posted (`postedAt` set on the project; empty until you tick "Mark as posted").

### Images

Instagram CDN URLs expire and aren't CORS-safe, which breaks export. So whenever a fetched image is **selected**, the server downloads it with `safeFetch` (from `outbound-http.mjs`), normalises it with `sharp`, and stores it under `public/social-assets/<projectId>/`. Portfolio photos are already same-origin, so they're referenced directly.

### API (in `server/admin-stylists.mjs`, or better a new `server/admin-social.mjs` registered alongside it)

- `GET /api/admin/social/candidates?service=&areaIds=&priceBands=&sort=`: wraps `searchSalons()` from `salon-index.mjs` so filtering matches the public site exactly, including aliases like "Goddess braids" mapping to Boho. Adds the photo count, thumbnails and featured-in history.
- `GET /api/admin/social/candidates?q=<name or handle>`: name search across the whole directory. It ignores the brief's filters and flags results that fall outside the brief.
- `GET/POST/PATCH/DELETE /api/admin/social/projects[/:id]`, with `proper-lockfile` like the other writers.
- `POST /api/admin/social/projects/:id/assets`: `{ imageUrl, salonId, contextUrl }`. Downloads and stores the image, returns an `assetId`. Also accepts an upload, for the cover portrait.
- `POST /api/admin/social/ig-profile/:salonId`: calls `fetchInstagramProfileViaAnyApi`, caches the avatar as an asset, and returns the avatar and display name only (no counts). Uses `photoSearchRateLimit`.
- Photo fetching reuses `/api/admin/photo-search/:salonId` as is.

### Rendering and export

- Slide components are ported from `carousel.jsx` to TSX in a new `src/social/` folder: `slides/Cover.tsx`, `slides/List.tsx`, `slides/Cta.tsx`, `slides/Single*.tsx`, `layouts.ts`, `Halftone.tsx`, `ScribbleArrow.tsx`, `SafeZones.tsx`.
  - The components are pure functions of `(slide, project, assets)`, rendered at true pixel size and scaled with a CSS transform for preview.
  - This keeps `AdminApp.tsx` (14k lines) from growing further: the page shell lives in the admin, and the studio is lazy-loaded from `src/social/`.
- **Export uses `html-to-image`, in the browser.** It's the same library the Claude Design template used.
  - This works because every image is same-origin (see Images) and the fonts are self-hosted: Junicode is already in `src/fonts/`, and **Bowlby One gets self-hosted too**. Google Fonts CSS can't be embedded reliably.
  - `pixelRatio: 1` at the native size gives exact 1080-wide output.
  - Zipping uses a small dependency (`fflate`).
- **Rejected alternative: Playwright server-side screenshots.** It's already a dependency and would be pixel-perfect, but it doesn't fit the Vercel admin function (60 s limit, browser in the bundle). Keep it as a fallback only if fonts or halftones render differently in client export.

### Background removal (cover photos)

- On the cover slide, you can select a portrait and click **"Remove background"**. It runs **in the browser** with `@imgly/background-removal`, so it's free with no API key. The model (about 40 MB) downloads the first time and is cached after that.
- The result is saved as a transparent PNG asset on the project. The original is kept, so you can toggle back.
- The **cut-out sits in front of the headline**, and the original (or another photo) sits behind it under the halftone, like the WASH & GO and SEW INS references.
- You can still upload a portrait that's already cut out instead.
- Licensing note: that library is AGPL. That's fine for a private admin tool, but it shouldn't ship in the public site bundle. It's lazy-loaded inside the studio only.

### Caption generator

Built from a template, not AI:

```
{hook}

{n}. @{handle} · 📍 {area} · {price}
…

find more → row-k.london
#{service} #londonhair #blackhairlondon …
```

It has a copy button. The hashtags come from a per-service map stored in the project palette or settings.

## 6. Build phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Render core** | Port the slides to TSX, add layouts 1/2/3/4, the 4:5 and 9:16 sizes, safe-zone overlay, self-hosted Bowlby One, and single-slide PNG export. Uses hardcoded sample data. | A slide exports pixel-matching the Claude Design reference |
| **2. Finder** | The candidates endpoint, brief form, name/@handle search, result cards with photo strip, links, warnings and featured-in, plus the selection tray | "Boho · East · £" returns the same set as the public site's filters |
| **3. Projects and auto-fill** | `social-projects.json` CRUD, auto-generated slides from the selection, the field mapping in §2, text editing | Select 5 stylists and get a 7-slide carousel filled in, with no typing |
| **4. Photos** | The per-stylist picker, "Fetch more from Instagram", asset caching, drag into cells, focal point, optional save to portfolio | Fetched IG images survive a reload and export without CORS errors |
| **5. Export and caption** | Zip-all export, caption generator, IG profile card fetch, cover background removal | The full carousel downloads as numbered PNGs plus the caption |
| **6. 9:16 singles** | Hook, spotlight and cover templates, and the transparent overlay pack | An overlay PNG drops cleanly into CapCut |

Phases 1–3 alone already replace the Claude Design workflow.

## 7. Decisions

- **No follower, post or following counts** anywhere.
- **Both sizes are available** for carousels and singles, chosen per project.
- **A generous safe perimeter is enforced** in every template (see §3).
- **Background removal is in the tool,** for cover photos only.
- **The @handle always shows** on every stylist slide.
- **"Featured" counts only posted carousels:** a stylist counts as featured once a project they're in is marked as posted.
