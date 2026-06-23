# hevydrinkr - agent guide

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 (CSS-first, no `tailwind.config.*`) + zustand + Supabase. Mobile-first PWA.

## Theming (light/dark)

The app supports light and dark mode. Theming is driven by a `data-theme` attribute on `<html>` plus CSS custom properties; there is no `next-themes` and no `dark:` variants.

### How it works

- **Tokens live in `src/app/globals.css`.** `:root` is the **dark** default (the original single-theme look, kept byte-for-byte). `:root[data-theme="light"]` overrides the same variables with light values. `@theme inline { ... }` maps the vars to Tailwind color utilities (`--color-*`), so `--accent` -> `bg-accent`/`text-accent`, etc.
- **`useThemeStore`** (`src/stores/use-theme-store.ts`) holds `preference: 'system' | 'light' | 'dark'` (default `'system'`), persisted **device-local** via zustand `persist` + `safeJSONStorage` under the key `hd-theme`. No Supabase/account sync.
- **`ThemeController`** (`src/components/theme/theme-controller.tsx`, mounted in the root layout) resolves the preference into an effective `light|dark` (tracking the OS via `matchMedia` while on `system`), writes `data-theme` on `<html>`, and syncs `<meta name="theme-color">`. It cross-fades only on a real post-mount switch (gated on `prefers-reduced-motion` via the `.theme-transition` class), never on first paint.
- **Anti-FOUC.** A blocking inline `<head>` script (`themeInitScript()` in `src/lib/theme.ts`) sets `data-theme` + `theme-color` before first paint. It reads the same `localStorage` key/shape the persist store writes (`{ state: { preference }, version }`), so the two never diverge. Pure resolution logic is `resolveEffectiveTheme()` (unit-tested in `src/lib/theme.test.ts`).
- The Settings **Appearance** control (`src/app/(app)/profile/settings/page.tsx`) is a 3-segment System/Light/Dark selector wired to `setPreference` with `hapticSelection()`.

### Token contract - use these, do not hardcode colors

When adding or converting UI, drive colors from tokens so they respond to the theme:

| Instead of | Use |
|---|---|
| `bg-white/[0.03]`, `.glass`, surfaces | `bg-card` |
| `border-white/[0.05]` hairlines | `border-card-border` |
| `hover:bg-white/[0.07]`, faint fills, inputs, tracks | `bg-card-hover` |
| `text-zinc-400` (secondary text) | `text-muted-foreground` |
| `text-zinc-600` / faint placeholders | `text-muted` |
| `text-white` body text | `text-foreground` |
| `bg-black/50`/`/60` scrims | `bg-overlay` |
| modal/sheet inline `rgba(9,9,11,0.92)` panels | `style={{ background: 'var(--sheet-bg)', borderColor: 'var(--sheet-border)' }}` |

**Accent has two roles - pick the right one:**

- `--accent` (`bg-accent`, `text-accent`): teal **fills/CTAs** and large/bold accent headings.
- `--accent-text` (`text-accent-text`): teal **small labels/icons**. Teal-500 fails WCAG AA as small text on white; `--accent-text` is the AA-safe teal (teal-700 in light).
- `--accent-foreground` (`text-accent-foreground`): text/icon color **on top of** an accent fill (replaces the old hardcoded `text-black` on teal buttons).

Semantic colors (`--green/red/violet/cyan/pink`, `text-success`/`text-danger`) keep the bright `-500` value as **fills** but darken to `-700`-ish for **text** in light. The `bg-X-500/20 text-X-400` badge recipe is unreadable on white - use the `Badge` component (driven by per-variant `--badge-*` vars) instead of re-rolling it.

### Staged migration convention

Light mode ships screen-by-screen. The shared primitives in `src/components/ui/*` (card, button, badge, input, tabs, toast, modal, bottom-sheet, skeleton, progress-bar, avatar) and the token foundation are converted. **Most per-screen code is still dark-hardcoded and not yet themed for light - that is expected and intentional.** When you touch a screen, tokenize the colors you encounter per the table above rather than adding new hardcoded `bg-white/`, `text-zinc-`, `text-black`, or inline `rgba(...)` colors. `npm run lint:colors` is an advisory report of remaining hardcoded color usage (non-blocking).

Out of scope for the foundation PR (follow-ups): app-frame glass chrome (sticky headers, bottom nav), the full per-screen sweep, and SVG gauge fills (`bac-gauge.tsx`) / glow softening.

## Conventions

- Per-device state persists via `zustand` `persist` + `safeJSONStorage` (`src/lib/storage/safe-storage.ts`); account data round-trips to Supabase.
- Tests: `npm run test` (Vitest, Node env; opt into jsdom per-file). Pure domain logic is the part held to a coverage line.
- `npm run typecheck` and `npm run test` gate CI (`npm run ci`).
