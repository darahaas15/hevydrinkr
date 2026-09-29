# hevydrinkr iOS app - agent guide

The native iPhone app for hevydrinkr, built with Expo (React Native) and Expo Router.
It is a real native app (UIKit navigation, tab bar, sheets, haptics), not a web view, and it shares its logic with the web app in `../src` so the two stay in sync.

## Sharing code with the web app

- The app imports the web app's shared TypeScript directly: `@/lib/*`, `@/stores/*`, `@/types/*` and `@/hooks/*` resolve to `../src/*`.
  This app's own modules use `~/*` (`./src/*`).
- Put logic in `../src/lib` (or a store), never in a screen, so both apps run the same code.
  Existing examples: `drink-picker.ts`, `drink-groups.ts`, `drink-gauge.ts`, `feed-utils.ts`, `session-actions.ts`, `realtime.ts`.
  If a web component holds logic this app needs, move that logic into `../src/lib` first and have both import it.
- Shared modules must not touch the DOM.
  The few that talk to browser APIs are swapped for native implementations in `metro.config.js` (`NATIVE_REPLACEMENTS`): the Supabase client, haptics and share.
  `src/platform/parity.ts` type-checks every replacement against the web module's API, so a web-side change the native side doesn't match fails `npm run typecheck`.
- `metro.config.js` resolves every package imported from `../src` out of this app's `node_modules`, so there is one React, one zustand and one supabase-js.
  `tsconfig.json` mirrors that with its `"*"` path mapping; both must change together.
- `src/platform/polyfills.ts` (loaded first, from `index.ts`) provides the web APIs the shared stores expect: a synchronous SQLite-backed `localStorage` and `crypto.randomUUID()`.
- The web-only icon packages imported by shared constants map to their React Native builds (`lucide-react` to `lucide-react-native`, `@tabler/icons-react` to `@tabler/icons-react-native`).
  Keep both pinned to the exact versions the web app resolves, so the glyphs match.

## Theme

- Colours come from `src/theme/tokens.generated.ts`, generated from the web tokens in `../src/app/globals.css` (`:root` is dark, `:root[data-theme="light"]` overrides it).
  Never hand-edit it: run `npm run tokens` after changing the web theme; `npm run tokens:check` fails CI when they drift.
- Use `useTheme()` for colours and the `Text` component for type (Geist, with Tailwind's sizes and line heights).
  Sizes are the web's CSS pixels one-for-one, which is what the PWA renders at on an iPhone.
- The Light/Dark choice is device-local (`src/theme/theme-store.ts`), defaults to Dark, and has no System option, matching the web.
  The root layout sets the native appearance from it, so system bars, sheets, alerts and the keyboard follow the in-app choice.

## Native patterns

- Tabs use `expo-router/unstable-native-tabs` (the system tab bar); the live-session banner lives in its bottom accessory (iOS 26+).
- Navigation-bar buttons use `Stack.Toolbar` through `src/components/header-actions.tsx`.
- Pickers and the end-of-session flow are form sheets declared in `src/app/_layout.tsx`.
- Confirmations and text prompts use native alerts (`src/lib/dialogs.ts`); toasts render in a full-window overlay so they stay above sheets.
- Write shared values with `.set()` outside worklets (React Compiler rule).

## Testing

- Native tabs, the toolbar and form sheets need a development build; they do not run in Expo Go.
- `npm run web` serves a browser preview for checking layouts and flows without a Mac.
  It uses web stand-ins (`*.web.tsx`) for the tab bar, header actions and dialogs, so it shows the screens, not the native chrome.
- Shared logic is unit-tested in the web app (`npm test` at the repo root).

## Commands

Use `npx expo install <package>` to add dependencies, so versions match the Expo SDK.

```bash
npm run ios           # build and run the development app in the iOS Simulator (macOS + Xcode)
npm run ios:device    # the same, on a connected iPhone
npm run ios:release   # standalone Release build on the iPhone (runs without Metro)
npm start             # start Metro for an already-installed development build
npm run web           # browser preview
npm run ci            # tokens check, typecheck, lint - run before declaring a change done
npx expo-doctor       # dependency and config diagnostics
```

## Expo has changed - do not trust your training data

Expo ships breaking changes every SDK release.
Before writing code that touches an Expo, EAS or React Native API, read the installed package's types or the versioned docs for the SDK in `package.json` (`https://docs.expo.dev/versions/v<major>.0.0/`); `https://docs.expo.dev/llms.txt` indexes all of them.

## Rules

- `ios/` is generated (Continuous Native Generation) and gitignored: configure native behaviour in `app.json` and config plugins, never by editing `ios/`.
- Routes live in `src/app/`; keep non-route code (components, features, hooks) outside it.
