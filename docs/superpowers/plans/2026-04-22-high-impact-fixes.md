# High-Impact Safety & UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the highest-impact safety and data-integrity fixes identified in the 2026-04-22 audit: undo for accidental drink deletion, input validation on custom drinks, a prominent in-session BAC-over-limit warning, persistent error toasts, and unambiguous session-cancel copy.

**Architecture:** Extend the existing `useUIStore` toast system with an optional action (label + callback) and a per-toast duration. Use it from the drink-remove flow to show an "Undo" toast that restores the drink via a new `restoreDrink` action on `useSessionStore`. Clamp custom-drink inputs at the picker-save boundary before DB insert. Show a dismissible red banner on the active-session page whenever the live BAC estimate crosses `BAC_LEGAL_LIMIT` (0.03). Rename the ambiguous "Cancel" button to "Abandon" so it isn't confused with cancelling a modal.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand stores, Supabase, Tailwind, framer-motion, lucide-react.

**Verification note:** This project has no test framework installed (see `package.json` — only `lint`, `build`, `dev`). Each task verifies with (a) `npm run lint`, (b) `npx tsc --noEmit` for quick type checks (or `npm run build` on the last task), and (c) manual browser verification via `npm run dev` where UI-observable. Do not add a test runner.

**Source audit:** `.context/audit-2026-04-22.md` (if saved) or conversation context. Specifically items P0-#1 (undo drink delete), P0-#2 (BAC disclaimer prominence), P0-#5 (custom drink validation), P1 (persistent error toasts), and the "Cancel button" bug in the Bugs & Broken Flows list.

**Out of scope (tracked elsewhere):** timezone handling, midnight rollover, photo storage migration from base64, leaderboard pagination, data export, rounds/expenses, session notes UI. These are higher-lift items and need their own plans.

---

## File Structure

Files modified:
- `src/stores/use-ui-store.ts` — extend `Toast` with optional `action` and `durationMs`; default error toasts to persistent (no auto-dismiss); `addToast` accepts an options object.
- `src/components/ui/toast.tsx` — render action button, close button, and honor per-toast duration.
- `src/stores/use-session-store.ts` — add `restoreDrink(drink: DrinkEntry)` that re-inserts a drink locally and re-inserts the row in Supabase.
- `src/components/session/drink-list.tsx` — on `onRemove` capture the removed drink so the caller can undo (pass the full entry to a new `onRemoveWithUndo` handler, OR change `onRemove` signature to receive the `DrinkEntry`).
- `src/app/(app)/session/page.tsx` — wire drink removal to show an undo toast; add BAC-over-limit banner; rename "Cancel" button to "Abandon"; bump the tiny BAC disclaimer font-size.
- `src/components/session/drink-picker.tsx` — clamp + validate custom-drink ABV and volume before save; block save on invalid input with inline error copy.

No new files. No schema migrations.

---

## Task 1: Extend toast store to support actions and custom duration

**Files:**
- Modify: `src/stores/use-ui-store.ts:5-66`

- [ ] **Step 1: Update the `Toast` interface and `addToast` signature**

Replace the `Toast` interface and the `addToast` function in `src/stores/use-ui-store.ts` with:

```ts
interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
  durationMs: number | null; // null = persistent (user must dismiss)
}

interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  action?: ToastAction;
  durationMs?: number | null;
}
```

And in the `UIState` interface, change the `addToast` field to:

```ts
addToast: (message: string, typeOrOptions?: 'success' | 'error' | 'info' | ToastOptions) => void;
```

And change the implementation of `addToast` to:

```ts
addToast: (message, typeOrOptions) => {
  const opts: ToastOptions =
    typeof typeOrOptions === 'string' ? { type: typeOrOptions } : typeOrOptions ?? {};
  const type = opts.type ?? 'info';
  // Errors are persistent by default so users don't miss failures.
  const defaultDuration = type === 'error' ? null : 3000;
  const durationMs = opts.durationMs === undefined ? defaultDuration : opts.durationMs;
  const id = generateId();
  const toast: Toast = { id, message, type, action: opts.action, durationMs };

  set((state) => ({
    toasts: [...state.toasts, toast],
  }));

  if (durationMs !== null) {
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, durationMs);
  }
},
```

- [ ] **Step 2: Verify existing callers still type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Existing callers like `addToast('msg', 'error')` still work because the second arg still accepts the string form.

- [ ] **Step 3: Commit**

```bash
git add src/stores/use-ui-store.ts
git commit -m "feat(ui): toasts support actions and per-toast duration; errors persist"
```

---

## Task 2: Render toast action button and dismiss button

**Files:**
- Modify: `src/components/ui/toast.tsx`

- [ ] **Step 1: Add an action button and an always-visible close button**

Replace the inner `<motion.div key={toast.id} ...>` content (lines ~48-75) so the block reads:

```tsx
<motion.div
  key={toast.id}
  layout
  initial={{ opacity: 0, y: -60 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -60 }}
  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
  drag="y"
  dragConstraints={{ bottom: 0 }}
  dragElastic={0.3}
  onDragEnd={(_: unknown, info: PanInfo) => {
    if (info.offset.y < -50 || info.velocity.y < -300) {
      hapticLight();
      removeToast(toast.id);
    }
  }}
  className="rounded-xl px-3.5 py-2.5 pointer-events-auto flex items-center gap-2.5 cursor-grab active:cursor-grabbing"
  style={{
    background: s.bg,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: s.border,
  }}
>
  <Icon className={cn('w-4 h-4 shrink-0', s.iconColor)} />
  <p className="text-[13px] text-zinc-200 flex-1">{toast.message}</p>
  {toast.action && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        hapticLight();
        toast.action!.onPress();
        removeToast(toast.id);
      }}
      className={cn('text-[13px] font-semibold px-2 py-1 rounded-md', s.iconColor)}
    >
      {toast.action.label}
    </button>
  )}
  <button
    onClick={(e) => {
      e.stopPropagation();
      hapticLight();
      removeToast(toast.id);
    }}
    aria-label="Dismiss"
    className="p-1 -mr-1 text-zinc-500 active:text-zinc-300"
  >
    <X className="w-3.5 h-3.5" />
  </button>
</motion.div>
```

Add the `X` icon to the existing `lucide-react` import at the top:

```tsx
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual verify**

Run: `npm run dev`, open the app, trigger any existing `addToast(..., 'error')` flow (e.g. tap **End** with no drinks added on the session page). Expected: toast appears, does NOT auto-dismiss, can be closed with the X. For an `info`/`success` toast, it auto-dismisses after 3s as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/toast.tsx
git commit -m "feat(ui): render toast action + dismiss buttons"
```

---

## Task 3: Add `restoreDrink` to session store

**Files:**
- Modify: `src/stores/use-session-store.ts` — add next to `addDrink`/`removeDrink` near line 466.

- [ ] **Step 1: Declare `restoreDrink` on the store interface**

Open `src/stores/use-session-store.ts`. Find the interface/type declaring the store actions (search for `removeDrink: (drinkId: string) => void;`). Add, immediately after it:

```ts
restoreDrink: (drink: DrinkEntry) => void;
```

- [ ] **Step 2: Implement `restoreDrink`**

Immediately after the `removeDrink` function body (closing `},` near line 493), insert:

```ts
// -----------------------------------------------------------------------
// Re-insert a previously removed drink (used by undo). Optimistic + DB insert.
// No-op if the session is no longer active or was replaced.
// -----------------------------------------------------------------------
restoreDrink: (drink) => {
  const { activeSession } = get();
  if (!activeSession) return;
  // Prevent duplicate inserts if user taps undo twice or the drink
  // somehow survived removal.
  if (activeSession.drinks.some((d) => d.id === drink.id)) return;

  set({
    activeSession: {
      ...activeSession,
      drinks: [...activeSession.drinks, drink],
      totalStandardDrinks: activeSession.totalStandardDrinks + drink.standardDrinks,
      totalVolumeMl: (activeSession.totalVolumeMl ?? 0) + drink.volumeMl,
    },
  });

  const insertPromise = sessionInsertPromises.get(activeSession.id) ?? Promise.resolve();
  const gen = _sessionGeneration;
  insertPromise.then(() => {
    const current = get().activeSession;
    if (!current || _sessionGeneration !== gen) return;
    const sid = current.id;
    supabase
      .from('drink_entries')
      .insert(drinkEntryToRow(drink, sid))
      .then(({ error }) => {
        if (error) console.error('Failed to restore drink entry:', error);
      });
  });
},
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/stores/use-session-store.ts
git commit -m "feat(session): add restoreDrink for undo-delete"
```

---

## Task 4: Wire up undo toast on drink removal

**Files:**
- Modify: `src/components/session/drink-list.tsx` — change `onRemove` signature so caller receives the full `DrinkEntry` (the remover needs the entry to restore it).
- Modify: `src/app/(app)/session/page.tsx:52,446` — pass a new handler that calls `removeDrink` and shows an undo toast.

- [ ] **Step 1: Change `DrinkList` to pass the full entry on remove**

In `src/components/session/drink-list.tsx`, change the `DrinkListProps` interface (line 8-12) to:

```tsx
interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drink: DrinkEntry) => void;
  onAdd?: (drink: DrinkEntry) => void;
}
```

Then update the two call sites that invoke `onRemove` inside the file:

`handleDec` (line 66-71) becomes:

```tsx
const handleDec = (key: string) => {
  const group = groupByKey(key);
  if (!group) return;
  const latest = group.entries[group.entries.length - 1];
  onRemove(latest);
};
```

`handleRemoveAll` (line 73-77) becomes:

```tsx
const handleRemoveAll = (key: string) => {
  const group = groupByKey(key);
  if (!group) return;
  for (const entry of group.entries) onRemove(entry);
};
```

- [ ] **Step 2: Update session page to show undo toast**

In `src/app/(app)/session/page.tsx`, near line 52, add `restoreDrink` to the store selectors:

```tsx
const restoreDrink = useSessionStore((s) => s.restoreDrink);
```

Immediately above the first `return` of `SessionPageInner` (or anywhere in its body before JSX), add:

```tsx
const handleRemoveDrink = (drink: typeof activeDrinks[number]) => {
  removeDrink(drink.id);
  addToast(`Removed ${drink.drinkName}`, {
    type: 'info',
    durationMs: 6000,
    action: {
      label: 'Undo',
      onPress: () => restoreDrink(drink),
    },
  });
};
```

Find the `DrinkList` JSX usage (around line 446) and change it from:

```tsx
<DrinkList drinks={activeDrinks} onRemove={removeDrink} onAdd={addDrink} />
```

to:

```tsx
<DrinkList drinks={activeDrinks} onRemove={handleRemoveDrink} onAdd={addDrink} />
```

- [ ] **Step 3: Check for any other `DrinkList` usage**

Run grep to confirm only one caller: 

```bash
grep -Rn 'DrinkList' src --include='*.tsx' --include='*.ts'
```

Expected: only `drink-list.tsx` (definition) and `session/page.tsx` (caller) appear as consumers of this component. If any other file imports `DrinkList`, update that caller's `onRemove` prop the same way (accept `DrinkEntry`, pass `d.id` to whatever underlying removal fn it calls).

- [ ] **Step 4: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual verify**

Run: `npm run dev`. Start a session, add a drink, tap the minus button on the drink group. Expected: drink disappears, "Removed {drink name}" toast with **Undo** button appears. Tap Undo within 6s — drink returns to the list, count goes back up, total std drinks is restored. Verify: reload the page after Undo — the restored drink still appears (Supabase reinsert succeeded).

Also verify "Remove all" (swipe/long-press path in `DrinkCart`) restores **each** removed drink when its toast's Undo is tapped. Each removal produces its own toast.

- [ ] **Step 6: Commit**

```bash
git add src/components/session/drink-list.tsx src/app/(app)/session/page.tsx
git commit -m "feat(session): undo toast for drink removal"
```

---

## Task 5: Validate custom drink inputs before save

**Files:**
- Modify: `src/components/session/drink-picker.tsx:119-172` (`handleCustomDrink`) and the inputs section near line 206-258.

Validation rules (rationale: bounds keep BAC math sane and prevent obviously-bogus rows from entering the DB):

| Field | Min | Max | Note |
|---|---|---|---|
| ABV % | 0.1 | 80 | Below 0.1% is non-alcoholic; 80% is above the strongest legally-sold spirits. |
| Volume (ml) | 10 | 2000 | 10ml rejects "0"/empty; 2000ml matches `splitOversizedDrink`'s upper bound logic and covers pitchers. |
| Name | non-empty trimmed, ≤ 60 chars | — | 60 chars is generous for "Dave's Homemade Hot-Pepper Mezcal Margarita". |

- [ ] **Step 1: Add local validation state and helpers**

In `drink-picker.tsx`, near the existing `useState` block (lines 46-53), add an error state:

```tsx
const [customError, setCustomError] = useState<string | null>(null);
```

Above `handleCustomDrink` (line 119), add a pure validator:

```tsx
function validateCustomDrink(name: string, abvStr: string, volStr: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your drink a name.';
  if (trimmed.length > 60) return 'Name is too long (max 60 chars).';
  const abv = parseFloat(abvStr);
  if (!Number.isFinite(abv) || abv < 0.1 || abv > 80) {
    return 'ABV must be between 0.1% and 80%.';
  }
  const vol = parseFloat(volStr);
  if (!Number.isFinite(vol) || vol < 10 || vol > 2000) {
    return 'Volume must be between 10 and 2000 ml.';
  }
  return null;
}
```

- [ ] **Step 2: Guard `handleCustomDrink` with the validator**

Replace the first two lines of `handleCustomDrink` (the early-return and the `parseFloat` fallback lines, around line 119-122) with:

```tsx
const handleCustomDrink = async () => {
  if (!currentUser) return;
  const err = validateCustomDrink(customName, customAbv, customVol);
  if (err) {
    setCustomError(err);
    return;
  }
  setCustomError(null);
  const abv = parseFloat(customAbv);
  const vol = parseFloat(customVol);
  const trimmedName = customName.trim();
```

Then update the rest of the function to use `trimmedName` instead of `customName.trim()` (two call sites: the Supabase insert `name:` field and the `drinkName:` field on the `DrinkEntry`).

- [ ] **Step 3: Render the error below the inputs and disable the button**

In the custom-drink JSX block (around line 246-257), just above the `motion.button` ("Add Drink"), insert:

```tsx
{customError && (
  <p className="text-xs text-red-400 text-center" role="alert">{customError}</p>
)}
```

Change the button's `disabled` prop (line 253) from `disabled={!customName.trim()}` to:

```tsx
disabled={validateCustomDrink(customName, customAbv, customVol) !== null}
```

Also clear the error when any input changes — update the three `onChange` handlers in the custom section:

```tsx
onChange={(e) => { setCustomName(e.target.value); setCustomError(null); }}
onChange={(e) => { setCustomAbv(e.target.value); setCustomError(null); }}
onChange={(e) => { setCustomVol(e.target.value); setCustomError(null); }}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual verify**

Run: `npm run dev`. Start a session, open the drink picker, tap "Custom Drink". Try to save with each of: empty name, ABV = `-1`, ABV = `90`, volume = `0`, volume = `10000`, name with 80 characters. Each should show the specific error message in red and the button should be disabled. Then enter valid values (e.g. "Test", ABV 5, volume 330) — button enables, drink saves, and appears in the list.

- [ ] **Step 6: Commit**

```bash
git add src/components/session/drink-picker.tsx
git commit -m "feat(session): validate custom drink ABV, volume, and name"
```

---

## Task 6: Prominent BAC disclaimer + in-session over-limit warning banner

**Files:**
- Modify: `src/app/(app)/session/page.tsx` — near line 99 (state), near 385-444 (BAC card).

- [ ] **Step 1: Add dismissible-per-session banner state**

In `SessionPageInner` next to the other `useState` hooks (around line 99), add:

```tsx
const [dismissedBacWarning, setDismissedBacWarning] = useState(false);
```

Reset it when `activeSession?.id` changes — add this `useEffect` near the existing session effects:

```tsx
useEffect(() => {
  setDismissedBacWarning(false);
}, [activeSession?.id]);
```

- [ ] **Step 2: Render the warning banner above the BAC gauge**

In the JSX, immediately above `<BacGauge ... />` (around line 385), add:

```tsx
{bacEstimate && bacEstimate.currentBac >= BAC_LEGAL_LIMIT && !dismissedBacWarning && (
  <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 flex items-start gap-3">
    <IconSteeringWheel className="w-5 h-5 text-red-400 shrink-0 mt-0.5" stroke={1.75} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-red-400">Over legal driving limit</p>
      <p className="text-[11px] text-zinc-400 leading-snug">
        Estimated BAC is {bacEstimate.currentBac.toFixed(3)}% — do not drive. BAC is an estimate and can be inaccurate; arrange a ride.
      </p>
    </div>
    <button
      onClick={() => setDismissedBacWarning(true)}
      aria-label="Dismiss warning"
      className="p-1 -mr-1 text-red-400/60 active:text-red-400"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
)}
```

`BAC_LEGAL_LIMIT`, `IconSteeringWheel`, and `X` are already imported (verify top of file; `X` is on line 5, `IconSteeringWheel` on line 6, `BAC_LEGAL_LIMIT` on line 8).

- [ ] **Step 3: Make the disclaimer text readable**

Find the disclaimer render around line 443:

```tsx
<p className="text-[9px] text-zinc-600 mt-3">{BAC_DISCLAIMER}</p>
```

Replace with:

```tsx
<p className="text-[11px] text-zinc-500 mt-3 leading-snug">{BAC_DISCLAIMER}</p>
```

(Rationale: 9px is below iOS/Android minimum recommended legibility. 11px + lighter grey keeps it unobtrusive but actually readable. Color bumped from `zinc-600` to `zinc-500` for contrast.)

- [ ] **Step 4: Typecheck and lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual verify**

Run: `npm run dev`. Start a session and add enough drinks to cross 0.03% BAC (for a 70kg user this is ~2 standard drinks within an hour — easiest with a shot of spirits or a strong cocktail). Expected: the red "Over legal driving limit" banner appears above the BAC gauge once the gauge number crosses 0.030. Tap the X to dismiss — banner disappears and does not reappear while the BAC stays above limit (it's dismissed for the remainder of the active session). End the session and start a new one — the banner re-appears when BAC crosses the limit again.

Also inspect the footer disclaimer: "BAC is an estimate only — never use it to decide if you're OK to drive." should be visibly larger than before and readable without squinting.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/session/page.tsx
git commit -m "feat(session): prominent BAC over-limit banner and readable disclaimer"
```

---

## Task 7: Rename ambiguous "Cancel" button to "Abandon"

**Files:**
- Modify: `src/app/(app)/session/page.tsx:353`

- [ ] **Step 1: Rename the button copy**

At `src/app/(app)/session/page.tsx:353`, change:

```tsx
Cancel
```

to:

```tsx
Abandon
```

(Rationale: "Cancel" next to "End" is ambiguous — users can't tell if it cancels a dialog, cancels their choice to end, or cancels the entire session. "Abandon" matches the confirmation modal's semantics and the underlying `abandonSession` store action.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual verify**

Run: `npm run dev`. Start a session, look at the top bar: the button should now read **Abandon** (previously "Cancel"). Tapping it still opens the existing abandon confirmation modal.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/session/page.tsx
git commit -m "fix(session): rename Cancel -> Abandon for clarity"
```

---

## Task 8: Final verification — build and walkthrough

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: successful build, no TS errors, no ESLint errors.

- [ ] **Step 2: End-to-end walkthrough**

Run: `npm run dev`. Run through this flow exactly once, confirming each step:

1. Start a session at any venue.
2. Add a couple of library drinks, then a custom drink with valid inputs.
3. Attempt another custom drink with ABV `-2`, empty name, volume `5000` — each error is surfaced inline, save button disabled.
4. Remove one of the library drinks with the `-` button — Undo toast appears, persists for 6s. Tap Undo — drink returns.
5. Remove another drink but do NOT tap undo — after 6s the toast auto-dismisses and the drink stays removed.
6. Trigger an error toast (e.g. tap **End** with no drinks by first removing them all) — toast has an X and does NOT auto-dismiss.
7. Add enough drinks that BAC crosses 0.03% — over-limit banner appears. Dismiss it; it stays dismissed for this session.
8. Confirm the top-right button reads **Abandon**, not **Cancel**. Tap it — confirmation modal still opens.
9. End session normally — summary/post-preview still works (smoke test that none of the above broke the ending flow).

- [ ] **Step 3: Commit nothing; all commits already landed**

No-op step — just a reminder this is a verification checkpoint, not a code change.

---

## Self-Review Checklist (completed by plan author)

- **Spec coverage** — Every audit item in scope is mapped to a task: P0-#1 (undo) → Tasks 3+4; P0-#2 (BAC disclaimer) → Task 6; P0-#5 (custom validation) → Task 5; P1 error toast persistence → Tasks 1+2; "Cancel button" bug → Task 7. Items explicitly out of scope are listed in the header.
- **Placeholder scan** — No TBDs, "similar to", or unexplained "handle edge cases". Every step shows the exact code.
- **Type consistency** — `restoreDrink(drink: DrinkEntry)` is defined in Task 3 and consumed in Task 4. `ToastAction`/`ToastOptions` defined in Task 1 are used in Task 4's `handleRemoveDrink`. `validateCustomDrink` defined in Task 5 Step 1 is used in Step 2 and Step 3. `DrinkList.onRemove(drink: DrinkEntry)` is redefined in Task 4 Step 1 and the only caller is updated in Step 2.
- **Test framework caveat** — Project has no test runner. Each task has explicit manual-verification steps; final task runs full build + end-to-end walkthrough.

---

**Plan complete.** 8 tasks, ~25 small steps, no schema changes, no new dependencies, fully scoped commits.
