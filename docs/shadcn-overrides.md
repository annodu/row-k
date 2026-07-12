# shadcn/ui overrides

This repo uses `components.json` → style `new-york`, base color `neutral`, CSS variables on. Every component in [src/components/ui](../src/components/ui) has been hand-modified after generation. If you run `npx shadcn add <component>` to pull in something new, or `npx shadcn diff` to check for upstream updates, **reapply these overrides** — the CLI will overwrite them with vanilla defaults otherwise.

Diffed against the current `new-york-v4` registry (`https://ui.shadcn.com/r/styles/new-york-v4/<component>.json`) on 2026-07-10.

## Project-wide overrides (apply to every component)

1. **No border radius.** Every `rounded-md` / `rounded-xl` / `rounded-full` (except literal circles) → `rounded-none`. This is a deliberate brand choice — see [design-system.md](design-system.md#radius).
2. **Literal `stone-*` colors, not CSS variable classes.** Vanilla shadcn uses `bg-primary`, `text-muted-foreground`, `border-input`, etc. This repo replaces those with literal Tailwind `stone-{50…950}` classes plus explicit `dark:` variants, e.g. `bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950` instead of `bg-primary text-primary-foreground`.
3. **No `shadow-*` utilities.** Vanilla adds `shadow-xs`/`shadow-sm` to inputs and cards; this repo drops them entirely (flat, borders-only aesthetic).
4. **Simpler focus ring.** Vanilla: `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`. This repo: `focus-visible:ring-2 focus-visible:ring-stone-600 dark:focus-visible:ring-stone-400` (no border-color change on focus, except Input — see below).
5. **No `aria-invalid:*` styling, no `destructive`/`link` variants, no `radix-ui` unified import.** This repo imports Radix primitives individually (`@radix-ui/react-checkbox`) rather than from the `radix-ui` umbrella package the current registry uses, and doesn't wire up form-validation error states.
6. **Plain function components, not `forwardRef`.** Consistent with React 19 — `ref` is a regular prop now, so no `React.forwardRef` wrapping.

## Per-component deltas

### `button.tsx`
- Sizes: `default`/`sm` are both `h-11` (registry: `h-9`/`h-8`), `lg` is `h-12` (registry: `h-10`). No `xs`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` size variants exist.
- Variants: only `default`, `secondary`, `outline`, `ghost`. **No `destructive` or `link` variant.** Add them if a future feature needs them — follow the `stone-*`/`red-*` pattern, not `bg-destructive`.
- `asChild` renders a `<span>`, not Radix `Slot.Root` — not a true polymorphic slot merge. Don't rely on it for passing all button semantics through to a child element.
- No `data-variant`/`data-size` attributes (registry adds these for variant-based CSS targeting).
- No `[&_svg]:size-4` icon auto-sizing — icon sizing is manual per-usage.

### `badge.tsx`
- `rounded-none` (registry: `rounded-full`).
- Variants: only `default`, `secondary`, `outline`. **No `destructive`, `ghost`, or `link` variant.**
- No `asChild` support at all.
- Padding `px-2.5 py-1` (registry: `px-2 py-0.5`).

### `card.tsx`
- **Missing `CardAction` and `CardFooter`** subcomponents entirely — only `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` exist. Add them (following the registry shape) if a card ever needs an action slot or footer.
- `Card` root: no `flex flex-col gap-6`, no `py-6` — just `border ... bg-white text-stone-950` (dark: `border-stone-800 bg-stone-900 text-stone-50`).
- `CardHeader`: `flex flex-col gap-2 p-6` (registry: CSS-grid-based layout with `@container` support for card actions — not needed since there's no `CardAction`).
- `CardTitle`: `font-semibold tracking-tight` (registry: `leading-none font-semibold`, no `tracking-tight`).
- `CardContent`: `px-6 pb-6` (registry: `px-6` only, relies on parent `gap-6`+`py-6` for vertical spacing — this repo's `Card` doesn't have that, so `CardContent` adds `pb-6` itself).

### `input.tsx`
- `h-12` (registry: `h-9`), `px-4 py-3` (registry: `px-3 py-1`), `bg-stone-50` (registry: `bg-transparent`/`dark:bg-input/30`).
- **Focus state changes border color** (`focus-visible:border-stone-950`, dark: `border-stone-100`) with **no ring at all** — the one component where the project-wide "add a ring" override (#4 above) doesn't apply.
- `hover:border-stone-400` — a hover state the registry doesn't have.
- No `file:*` input-type styling, no `selection:*` styling, no `md:text-sm` responsive text size.

### `checkbox.tsx`
- Imports `CheckboxPrimitive` from `@radix-ui/react-checkbox` directly (registry: `import { Checkbox as CheckboxPrimitive } from "radix-ui"`).
- `h-5 w-5` (registry: `size-4`), `border-stone-500` (registry: `border-input`), `bg-white` (registry: unset/transparent).
- Checked state: `data-[state=checked]:bg-stone-950 data-[state=checked]:border-stone-950` (registry: `data-[state=checked]:bg-primary`).
- No `aria-invalid:*` styles, no `shadow-xs`.
- Missing the `"use client"` directive (irrelevant here — this is a plain Vite SPA, not Next.js/RSC).

## When adding a new shadcn component

1. `npx shadcn add <name>` to generate the vanilla file.
2. Strip all `rounded-*` except `rounded-full` on genuinely circular elements → `rounded-none`.
3. Replace CSS-variable color classes (`bg-primary`, `text-muted-foreground`, `border-input`, etc.) with literal `stone-*` + explicit `dark:` classes, matching the palette in [design-system.md](design-system.md#color).
4. Drop `shadow-*` utilities.
5. Normalize focus styling to `focus-visible:ring-2 focus-visible:ring-stone-600 dark:focus-visible:ring-stone-400` unless the component is border-based like `Input`.
6. Drop `aria-invalid:*`, `destructive`, and `link` variants unless the feature actually needs them.
7. If pulling in an admin-only component with no `dark:` variants, add the corresponding override block to the `.admin-ui` section of [src/index.css](../src/index.css) instead of retrofitting every class with `dark:`.
