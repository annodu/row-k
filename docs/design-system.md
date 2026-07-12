# ROW K LDN — Design System

Source of truth for UI conventions used across the storefront (`src/App.tsx`), the admin app (`src/AdminApp.tsx`), and shared primitives (`src/components/ui/*`). This document describes what's actually implemented, not an aspirational spec — update it when the underlying code changes.

Stack: React 19 + Tailwind CSS v4 (`@theme`/CSS variables in `src/index.css`, no `tailwind.config.js`) + shadcn/ui (`new-york` style, `neutral` base, `rounded-none` overrides).

## Brand

- **Name:** ROW K LDN
- **Tagline:** "The hair stylist directory for Black Londoners"
- **Neutral palette:** Tailwind `stone` scale (not the shadcn CSS-variable palette in practice — components mix both, see below).

## Color

Two color systems coexist in this codebase:

### 1. CSS variables (`src/index.css`, `oklch`)

Used by shadcn primitives that reference `bg-[var(--background)]`, `text-[var(--foreground)]`, etc. Defined for `:root` (light) and `html.dark` / `prefers-color-scheme: dark` (dark).

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.97 0.004 75)` | `oklch(0.19 0.01 45)` |
| `--foreground` | `oklch(0.24 0.01 45)` | `oklch(0.94 0.004 75)` |
| `--card` / `--popover` | `oklch(0.99 0.002 75)` | `oklch(0.22 0.01 45)` |
| `--primary` | `oklch(0.2 0.01 45)` | `oklch(0.92 0.004 75)` |
| `--secondary` / `--muted` | `oklch(0.92 0.004 75)` | `oklch(0.28 / 0.26 0.01 45)` |
| `--accent` | `oklch(0.76 0.07 55)` (warm amber) | `oklch(0.82 0.07 55)` |
| `--border` / `--input` | `oklch(0.86 0.004 75)` | `oklch(0.34 0.01 45)` |
| `--ring` | `oklch(0.72 0.01 45)` | `oklch(0.68 0.01 60)` |

`--accent` is the only hue with real chroma (warm amber, ~55° hue) — everything else is near-neutral. Use it sparingly for highlight/CTA moments.

### 2. Literal `stone-*` utilities (dominant pattern)

Most hand-written UI (App.tsx, AdminApp.tsx, and the `ui/` primitives) uses literal Tailwind `stone-{50…950}` classes directly rather than the CSS variables, e.g. `bg-stone-950 text-stone-50`, `border-stone-300`, `text-stone-500` for secondary text. Dark mode is handled per-utility with `dark:` variants (see `html.dark` overrides in `index.css` for the admin surface specifically — `.admin-ui` gets its own dark-mode utility remaps for `bg-white`, `bg-stone-50/100/200`, etc., rather than relying on `dark:` classes everywhere).

**Convention:** when adding new UI, prefer literal `stone-*` classes with explicit `dark:` variants to match the existing codebase, rather than introducing new CSS variables.

**Status/semantic colors:** `red-*` for destructive/error states (e.g. `text-red-500`, `bg-red-50`, `border-red-200`), remapped for dark mode inside `.admin-ui`. No dedicated success/warning palette currently exists — introduce `green-*`/`amber-*` following the same remap pattern in `index.css` if needed.

## Typography

- **Body/UI font:** Figtree — loaded via Google Fonts in `index.html` (weights 400, 500, 600, 700, 800), set as `--font-sans` and applied via `font-sans antialiased` on `<body>`.
- **Display/serif font:** `Instrument Serif` is preconnected/loaded in `index.html` but the one hero `<h1>` in App.tsx currently sets `fontFamily: "Junicode"` inline (not loaded anywhere) instead of using the loaded serif — likely stale/inconsistent. If touching that hero, prefer wiring it to `Instrument Serif` (or add a `--font-serif` token) rather than leaving the unloaded `Junicode` reference.
- **Headings** (`h1`–`h4`) get `font-family: var(--font-sans)` globally via `@layer base` in `index.css`.

**Font sizes in practice:** the storefront leans on arbitrary pixel values rather than Tailwind's default type scale:

| Use | Classes |
|---|---|
| Hero headline | `text-[38px] leading-[40px] sm:text-[56px] sm:leading-[58px] lg:text-[68px] lg:leading-[70px]`, italic, `font-medium`, `tracking-tight` |
| Section/sub headline | `text-[19px]`, `text-[17px]`, `text-[16px]` |
| Body | `text-[15px]`, `text-[14px]` |
| Secondary/meta | `text-[13px]`, `text-[12px]` |
| Micro (badges, counters) | `text-[11px]`, usually `font-bold leading-none` |

Weight usage: `font-medium` for emphasis/labels, `font-semibold` for card/section titles, `font-bold` for micro-badges, `font-normal` for de-emphasized body copy.

## Spacing

Standard Tailwind spacing scale, no custom values. Common patterns observed:

- Padding: `py-2 px-2` (compact controls), `px-4`/`px-6` (cards, containers), `px-10` (generous horizontal), `py-4`–`py-6` (section blocks)
- Gaps: `gap-2`/`gap-3` most common (icon+label, list items), `gap-4` for looser groups

## Radius

**Default is sharp corners.** `rounded-none` is applied explicitly on `Button`, `Badge`, `Card`, and `Input` — this is a deliberate brand choice, not an oversight.

Exceptions:
- `rounded-full` — circular elements only: avatar-style counters/badges (`inline-flex ... rounded-full bg-stone-950 ... text-stone-100`)
- `rounded-[4px]` — skeleton/loading placeholders for text-like blocks
- `rounded-[8px]` — skeleton/loading placeholders for button-like blocks

When adding new components, default to `rounded-none` unless the element is circular or a loading skeleton.

## Breakpoints

Custom breakpoints set in `@theme` (`src/index.css`):

```
--breakpoint-sm: 48.0625rem  /* ~769px */
--breakpoint-lg: 48.0625rem  /* same value as sm */
```

`sm:` and `lg:` therefore currently trigger at the **same** viewport width (~769px) — `md:`/`xl:`/`2xl:` remain at Tailwind defaults. This is unusual and likely intentional for a two-tier (mobile/desktop) layout rather than a full responsive scale; be aware `sm:` and `lg:` won't create a visually distinct third breakpoint against each other.

## Components (`src/components/ui/`)

Built with `class-variance-authority` (cva) + `cn()` (clsx + tailwind-merge, `src/lib/utils.ts`).

### Button (`button.tsx`)
- Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium transition-all`, disabled state `disabled:pointer-events-none disabled:opacity-50`, focus ring `focus-visible:ring-2 focus-visible:ring-stone-600 dark:focus-visible:ring-stone-400`
- **Variants:** `default` (solid stone-950/white, inverted in dark), `secondary` (bordered white/stone-900), `outline` (transparent, bordered), `ghost` (transparent, hover fill)
- **Sizes:** `default` (`h-11 px-4 py-2`), `sm` (`h-11 px-3`), `lg` (`h-12 px-5 text-sm`) — note `default` and `sm` share the same height (`h-11`)
- Supports `asChild` (renders a `<span>`, not a native slot-merge — check before relying on it for real polymorphism)

### Badge (`badge.tsx`)
- Base: `inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium`
- Variants: `default` (solid stone-900/stone-50), `secondary` (stone-100/stone-700), `outline` (bordered, transparent)

### Card (`card.tsx`)
- `Card`: `rounded-none border border-stone-300 bg-white text-stone-950` (dark: `border-stone-800 bg-stone-900 text-stone-50`)
- `CardHeader`: `flex flex-col gap-2 p-6`
- `CardTitle`: `font-semibold tracking-tight`
- `CardDescription`: `text-sm text-stone-500` (dark: `text-stone-400`)
- `CardContent`: `px-6 pb-6`

### Input (`input.tsx`)
- `h-12 w-full rounded-none border border-stone-300 bg-stone-50 px-4 py-3 text-sm`
- States: `hover:border-stone-400`, `focus-visible:border-stone-950` (no ring — border color is the only focus indicator), `placeholder:text-stone-400`
- Dark: `border-stone-700 bg-stone-900 text-stone-100`

### Checkbox (`checkbox.tsx`)
Built on `@radix-ui/react-checkbox`.

## Admin surface (`AdminApp.tsx`)

Wrapped in an `.admin-ui` class that gets its own dark-mode color remapping in `index.css` (`@layer utilities`), separately from the `dark:` variant system used elsewhere. This exists because much of the admin UI was written with literal light-mode `stone-*`/`red-*`/`white` classes without `dark:` variants, so dark mode is patched in via attribute selectors scoped to `.admin-ui` instead of touching every className. **If you add new admin UI with hardcoded light colors, add the corresponding dark override in this block** rather than sprinkling `dark:` classes inline (to stay consistent with the existing pattern) — or better, use `dark:` variants directly if you're touching that code anyway.

## Icons

`lucide-react`.

## Conventions checklist for new UI

- [ ] Use `stone-*` literal classes + explicit `dark:` variants (not new CSS variables) to match existing components
- [ ] Default to `rounded-none`; only use `rounded-full` for circular elements
- [ ] Prefer arbitrary `text-[Npx]` sizes matching the scale above over default Tailwind type sizes, for consistency with existing copy
- [ ] Use `cva` + `cn()` for any new variant-driven primitive, following `button.tsx`/`badge.tsx`
- [ ] If adding admin-only UI without `dark:` variants, add a corresponding `.admin-ui` dark override in `src/index.css`
- [ ] Reserve `--accent` (amber) for genuine highlight/CTA moments, not general UI color
