# hevydrinkr - agent guide

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 (CSS-first, no `tailwind.config.*`) + zustand + Supabase. Mobile-first PWA.

## Theming (light/dark)

The app supports light and dark mode. Theming is driven by a `data-theme` attribute on `<html>` plus CSS custom properties; there is no `next-themes` and no `dark:` variants.

### How it works

- **Tokens live in `src/app/globals.css`.** `:root` is the **dark** default (the original single-theme look, kept byte-for-byte). `:root[data-theme="light"]` overrides the same variables with light values. `@theme inline { ... }` maps the vars to Tailwind color utilities (`--color-*`), so `--accent` -> `bg-accent`/`text-accent`, etc.
- **`useThemeStore`** (`src/stores/use-theme-store.ts`) holds `preference: 'system' | 'light' | 'dark'` (default `'system'`), persisted **device-local** via zustand `persist` + `safeJSONStorage` under the key `hd-theme`. No Supabase/account sync.
- **`ThemeController`** (`src/components/theme/theme-controller.tsx`, mounted in the root layout) resolves the preference into an effective `light|dark` (tracking the OS via `matchMedia` while on `system`), writes `data-theme` on `<html>`, syncs `<meta name="theme-color">`, and caches the resolved theme under `hd-theme-effective` for the boot path. It cross-fades only on a real post-mount switch (gated on `prefers-reduced-motion` via the `.theme-transition` class), never on first paint.
- **Anti-FOUC.** A blocking inline `<head>` script (`themeInitScript()` in `src/lib/theme.ts`) sets `data-theme` + `theme-color` before first paint. It reads the same `localStorage` key/shape the persist store writes (`{ state: { preference }, version }`), so the two never diverge. While preference is `system`, boot paints the **cached last effective theme** (`hd-theme-effective`) rather than trusting `matchMedia` - iOS home-screen PWAs report a wrong `prefers-color-scheme` for the first moments after launch, which used to flash the wrong theme on cold start. ThemeController keeps what was painted on first mount and reconciles with the settled OS value ~2s later (`SYSTEM_SETTLE_MS`). Pure resolution logic is `resolveEffectiveTheme()` + `resolveBootTheme()` (unit-tested in `src/lib/theme.test.ts`).
- The Settings **Appearance** control (`src/app/(app)/profile/settings/page.tsx`) is a 3-segment System/Light/Dark selector wired to `setPreference` with `hapticSelection()`.

### Token contract - use these, do not hardcode colors

When adding or converting UI, drive colors from tokens so they respond to the theme:

| Instead of | Use |
|---|---|
| `bg-white/[0.02]` / `[0.03]` / `[0.04]` / `[0.05]` (`bg-white/5`) | `bg-surface-faint` / `bg-card` / `bg-surface-secondary` / `bg-surface-subtle` |
| `bg-white/[0.06]` / `[0.07]` / `[0.08]` / `[0.1]` | `bg-surface-raised` / `bg-card-hover` / `bg-surface-strong` / `bg-surface-hover-strong` |
| `border-white/[0.04]` / `[0.05]` / `[0.06]` / `[0.08]` hairlines | `border-border-faint` / `border-hairline` / `border-card-border` / `border-border-strong` |
| `text-zinc-200` / `300` (bright secondary) | `text-fg-bright` / `text-fg-strong` |
| `text-zinc-400` (secondary text) | `text-muted-foreground` |
| `text-zinc-500` (dominant secondary text) | `text-fg-secondary` |
| `text-zinc-600` / faint placeholders | `text-muted` |
| `text-zinc-700` (very faint / disabled) | `text-fg-faint` |
| `text-white` body text | `text-foreground` |
| opaque `bg-zinc-800` chips / `bg-zinc-700` toggle tracks | `bg-chip` / `bg-track` |
| `bg-black/50`/`/60` scrims | `bg-overlay` |
| modal/sheet inline `rgba(9,9,11,0.92)` panels | `style={{ background: 'var(--sheet-bg)', borderColor: 'var(--sheet-border)' }}` |
| sticky-header / bottom-nav inline `rgba(9,9,11,0.82)` glass | `style={{ background: 'var(--chrome-bg)', borderColor: 'var(--chrome-border)' }}` (`--chrome-strong-bg` for composer/footer bars) |
| floating-menu / popover inline `rgba(20,20,24,0.85/0.95)` glass | `var(--popover-bg)` / `var(--popover-strong-bg)` |
| full-screen `#09090b` / `bg-[#09090b]` / `ring-[#09090b]` | `var(--background)` / `bg-background` / `ring-background` |
| full-screen near-black landing/auth `#06060a` base | `style={{ background: 'var(--background-deep)' }}` (deeper than `--background`; dark = `#06060a`) |
| fully OPAQUE bottom-sheet panel `#111114` (no own backdrop-filter) | `style={{ background: 'var(--sheet-solid-bg)' }}` (stays opaque in dark, unlike the translucent `--popover-strong-bg`) |
| sheet drag-handle pip `bg-white/20` / `bg-white/15` | `bg-[var(--grabber-bg)]` |
| unselected selection-circle outline `border-white/20` | `border-[var(--selection-border)]` |

Semantic **text** colors (the bright `-400` shades that fail AA on white) have AA-safe `*-fg` tokens, vivid in dark and deepened in light: `text-danger-fg` (red-400), `text-warning-fg` (amber-400), `text-success-fg` (emerald/green-400), `text-info-fg` (cyan-400), `text-violet-fg` (violet/purple-400), `text-pink-fg` (pink-400), `text-blue-fg` (blue-400), `text-sky-fg` (sky-400), `text-yellow-fg` (yellow-400), `text-indigo-fg` (indigo-400), `text-orange-fg` (orange-400).
Brand-color **tints** (`bg-X-500/15`, etc.) are theme-neutral and stay as-is - only their text/icon color needs an `*-fg` token.
The BAC/drink gauge uses `var(--gauge-1..5)` (intoxication levels) and `var(--violet)` for its SVG arc strokes + status label; SVG `stroke`/`fill` can't take `var()` as an *attribute*, so set them via `style={{ stroke: ... }}` / a `fill-*` class (`fill-foreground`).

**Accent has two roles - pick the right one:**

- `--accent` (`bg-accent`, `text-accent`): teal **fills/CTAs** and large/bold accent headings.
- `--accent-text` (`text-accent-text`): teal **small labels/icons**. Teal-500 fails WCAG AA as small text on white; `--accent-text` is the AA-safe teal (teal-700 in light).
- `--accent-foreground` (`text-accent-foreground`): text/icon color **on top of** an accent fill (replaces the old hardcoded `text-black` on teal buttons).

Semantic colors (`--green/red/violet/cyan/pink`, `text-success`/`text-danger`) keep the bright `-500` value as **fills** but darken to `-700`-ish for **text** in light. The `bg-X-500/20 text-X-400` badge recipe is unreadable on white - use the `Badge` component (driven by per-variant `--badge-*` vars) instead of re-rolling it.

### Migration status - complete

Light mode is fully themed app-wide: the token foundation, the shared primitives in `src/components/ui/*`, the app-frame glass chrome (sticky headers, bottom nav, composers, popovers), every per-screen surface, and the SVG gauges (`bac-gauge.tsx`).
When adding new UI, drive colors from the tokens above rather than reintroducing hardcoded `bg-white/`, `text-zinc-`, `text-black`, or inline `rgba(...)` colors.
`npm run lint:colors` is an advisory (non-blocking) report; the ~56 remaining hits are intentional keepers - modal/sheet `bg-black/*` scrims (a dark scrim over light content is correct), `text-white`/`text-black` on fixed brand-gradient banners, the always-dark immersive photo viewer, white toggle knobs, the `DRINK_CATEGORY_COLORS` data-viz palette, and `manifest.ts` install colors.
Dark mode is preserved byte-for-byte: every new token's dark value equals the literal it replaced (a few imperceptible consolidations - e.g. `green-400`/`purple-400` text folded into the emerald/violet `*-fg`, and composer glass opacities 0.92/0.94/0.95 unified to `--chrome-strong-bg`).
`color-scheme` is set on `:root`/`:root[data-theme="light"]` so native controls (date pickers) follow the theme - don't reintroduce per-input `[color-scheme:dark]`.
`public/offline.html` is intentionally left dark (standalone, outside React, lowest traffic).

## Conventions

- Per-device state persists via `zustand` `persist` + `safeJSONStorage` (`src/lib/storage/safe-storage.ts`); account data round-trips to Supabase.
- Tests: `npm run test` (Vitest, Node env; opt into jsdom per-file). Pure domain logic is the part held to a coverage line.
- `npm run typecheck` and `npm run test` gate CI (`npm run ci`).
- User-facing changes get a new entry at the top of `src/lib/changelog.ts`. It is the single source of `APP_VERSION` and drives the one-time in-app "what's new" banner - no entry means users are never told.

### Columns that may not be migrated yet

PROD is the only database, so app code and migrations can land out of order, and a `select()` naming a column the DB lacks fails the *whole* query (Postgres 42703 / PostgREST PGRST204) - which would take out session loading, not just the new feature.

`src/lib/supabase/optional-columns.ts` handles this: an `OptionalColumn` starts optimistic and latches off the first time the DB reports the column missing, so callers retry once without it. See `drinkCostColumn` and its use in `src/lib/supabase/drink-entries.ts` for the read + write pattern. Use this for any additive column whose migration might trail the deploy.

**Gotcha:** the contract extractor (`tests/contract/extract-db-contract.ts`) is regex-based on literal `.select('...')` strings. Composing a select list from a variable or helper makes it invisible, and `npm run contract:update` will silently *delete* those columns from the snapshot - a coverage loss that looks like a clean run. Always read the `git diff` of `tests/contract/db-contract.json` and expect it to grow. Conditional column lists must be written out as full literals at each call site. New migrations also need adding to the `FILES` list in `scripts/test-db-bootstrap.sh`, which does not read `supabase/migrations/`.
