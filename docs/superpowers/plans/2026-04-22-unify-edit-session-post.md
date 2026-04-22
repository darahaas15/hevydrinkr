# Unified Edit Session + Edit Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/session/edit?id=<id>` the single edit surface for past sessions — editable venue/times/mood/caption + drinks (with +/- cart UI) + photos — and delete the separate "Edit Post" modal.

**Architecture:** Extract a shared `DrinkCart` component for the grouped +/- drink list. Teach `SessionForm` edit mode to manage a cart and photos (today it's read-only for both). On save, reuse `updateFeedItem` (which already handles DB drink sync) and pass the full `DrinkEntry[]` so real `drinkDefinitionId` and timestamps survive.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand stores, Supabase, Tailwind, framer-motion, lucide-react.

**Verification note:** This project has no test framework installed (see `package.json` — only `lint`, `build`, `dev`). Each task verifies with (a) `npm run lint`, (b) TypeScript compile via `npm run build` on the last task or `npx tsc --noEmit` for quick checks, and (c) manual browser verification via `npm run dev` where UI-observable. There is no test runner to scaffold — do not add one.

**Spec:** `docs/superpowers/specs/2026-04-22-unify-edit-session-post-design.md`

**Route note:** The edit page is `/session/edit?id=<sessionId>` (query param, not path). Use this exact URL shape everywhere.

---

## File Structure

Files created:
- `src/components/session/drink-cart.tsx` — shared presentational component for the grouped +/- drink list.

Files modified:
- `src/types/feed.ts` — extend `FeedItem['sessionSummary']['drinks']` with optional `drinkDefinitionId` and `timestamp`.
- `src/lib/session-utils.ts` — `buildSessionSummary` includes the new fields.
- `src/stores/use-feed-store.ts` — `updateFeedItem` writes through `drinkDefinitionId` and `timestamp` when present.
- `src/components/session/drink-list.tsx` — renders via `DrinkCart`.
- `src/components/session/session-form.tsx` — cart & photos editable in edit mode; save path calls `updateFeedItem` when drinks/photos/caption change; re-spread timestamps on drink-count change.
- `src/app/(app)/feed/[id]/post-detail.tsx` — "Edit Post" menu routes to `/session/edit?id=<sessionId>`; delete the edit modal and its state.

---

## Task 1: Extend sessionSummary type with drinkDefinitionId and timestamp

**Files:**
- Modify: `src/types/feed.ts:18-25`

- [ ] **Step 1: Extend the `drinks` item type on `FeedItem.sessionSummary`**

Replace the existing `drinks` field (lines 18-25) with this block. Keep the fields optional so older rows in Supabase still parse.

```ts
    drinks: {
      name: string;
      emoji: string;
      category: string;
      abvPercent: number;
      volumeMl: number;
      standardDrinks: number;
      // Populated by newer writes so edits round-trip with the real
      // drink_definitions row and per-drink times. Older rows omit these.
      drinkDefinitionId?: string;
      timestamp?: string;
    }[];
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors. (Adding optional fields is additive.)

- [ ] **Step 3: Commit**

```bash
git add src/types/feed.ts
git commit -m "Extend FeedItem.sessionSummary.drinks with optional definition id and timestamp"
```

---

## Task 2: Write definitionId and timestamp into buildSessionSummary output

**Files:**
- Modify: `src/lib/session-utils.ts:58-65`

- [ ] **Step 1: Replace the drinks mapping inside `buildSessionSummary`**

Replace the block at lines 58-65 (`drinks: session.drinks.map(...)`) with:

```ts
    drinks: session.drinks.map((d) => ({
      name: d.drinkName,
      emoji: d.emoji,
      category: d.category,
      abvPercent: d.abvPercent,
      volumeMl: d.volumeMl,
      standardDrinks: d.standardDrinks,
      drinkDefinitionId: d.drinkDefinitionId,
      timestamp: d.timestamp,
    })),
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session-utils.ts
git commit -m "Include drinkDefinitionId and timestamp in buildSessionSummary output"
```

---

## Task 3: Honor provided definitionId and timestamp in updateFeedItem

**Files:**
- Modify: `src/stores/use-feed-store.ts:575-625`

- [ ] **Step 1: Pass through `drinkDefinitionId` and `timestamp` when present**

In `updateFeedItem`, find the block that starts at line 575 (the `newDrinks` construction and insert). Replace lines 575-614 (from `// Generate stable IDs...` through the `.insert(...)` call) with:

```ts
      // Generate stable IDs once so DB rows and local-state drinks match.
      const fallbackTimestamp = new Date().toISOString();
      const newDrinks = (s.drinks ?? []).map((d) => ({
        id: crypto.randomUUID(),
        drink: d,
        // Prefer real IDs/timestamps from the payload; fall back to sentinels
        // only when the payload predates the extended summary shape.
        drinkDefinitionId: d.drinkDefinitionId ?? 'edited',
        timestamp: d.timestamp ?? fallbackTimestamp,
      }));

      // Phase 1: update session metadata and delete old drink entries in parallel.
      const [sessionUpdateRes, deleteRes] = await Promise.all([
        supabase.from('drink_sessions').update({
          total_standard_drinks: s.totalStandardDrinks,
          duration_minutes: s.durationMinutes,
          venue: s.venue,
        }).eq('id', sessionId),
        supabase.from('drink_entries').delete().eq('session_id', sessionId),
      ]);

      if (sessionUpdateRes.error || deleteRes.error) {
        // Couldn't apply the edit cleanly. Roll back the optimistic feed/userPosts
        // state and leave drink_entries alone (delete may not have run).
        console.error('Failed to apply edit:', sessionUpdateRes.error ?? deleteRes.error);
        set({ items: prevItems, userPosts: prevUserPosts });
        useUIStore.getState().addToast('Something went wrong', 'error');
        return;
      }

      // Phase 2: insert the new drink entries (delete already succeeded).
      if (newDrinks.length > 0) {
        const { error: insertErr } = await supabase.from('drink_entries').insert(
          newDrinks.map(({ id, drink, drinkDefinitionId, timestamp }) => ({
            id,
            session_id: sessionId,
            drink_definition_id: drinkDefinitionId,
            drink_name: drink.name,
            emoji: drink.emoji,
            category: drink.category,
            abv_percent: drink.abvPercent,
            volume_ml: drink.volumeMl,
            standard_drinks: drink.standardDrinks,
            timestamp,
          })),
        );
```

- [ ] **Step 2: Update the local session-store sync block to use the same fields**

Right after the insert, the code builds `updatedOwnerHistory` (around lines 631-651). Replace the `drinks: newDrinks.map(...)` segment with:

```ts
          drinks: newDrinks.map(({ id, drink, drinkDefinitionId, timestamp }) => ({
            id,
            drinkDefinitionId,
            drinkName: drink.name,
            emoji: drink.emoji,
            category: drink.category as DrinkCategory,
            abvPercent: drink.abvPercent,
            volumeMl: drink.volumeMl,
            standardDrinks: drink.standardDrinks,
            timestamp,
            roundId: null,
            notes: '',
          } as DrinkSession['drinks'][0])),
```

Also remove the now-unused standalone `timestamp` const (the one defined at line 573 `const timestamp = new Date().toISOString();` just before `newDrinks`) — we use `fallbackTimestamp` inside `newDrinks` now.

- [ ] **Step 3: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/stores/use-feed-store.ts
git commit -m "Preserve real drink_definition_id and timestamps on feed item edit"
```

---

## Task 4: Create shared DrinkCart component

**Files:**
- Create: `src/components/session/drink-cart.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2 } from 'lucide-react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { hapticLight, hapticWarning } from '@/lib/haptics';

export interface DrinkCartItem {
  // Stable identity for this group row (e.g. drinkDefinitionId).
  key: string;
  // Any one drink from the group — used for name/emoji/abv/volume display.
  template: DrinkEntry;
  quantity: number;
}

interface DrinkCartProps {
  items: DrinkCartItem[];
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  onRemove: (key: string) => void;
  // Optional: show the "+ Add" (inc) button. Off when the caller doesn't
  // support adding new drinks of the same type from the row (rare).
  showInc?: boolean;
  // Optional trailing std-drinks total line.
  totalStandardDrinks?: number;
  // Animate list on mount (for live session). Off by default so form usage
  // doesn't animate the cart initializing from existing drinks.
  animate?: boolean;
}

export function DrinkCart({
  items,
  onInc,
  onDec,
  onRemove,
  showInc = true,
  totalStandardDrinks,
  animate = false,
}: DrinkCartProps) {
  const rows = items.map((item) => (
    <motion.div
      key={item.key}
      {...(animate
        ? {
            initial: { opacity: 0, height: 0, y: -10 },
            animate: { opacity: 1, height: 'auto', y: 0 },
            exit: { opacity: 0, height: 0, x: 100 },
            transition: { duration: 0.2 },
          }
        : {})}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]"
    >
      <DrinkIcon category={item.template.category} className="w-5 h-5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.template.drinkName}</p>
        <p className="text-[10px] text-zinc-600">
          {item.template.abvPercent}% · {item.template.volumeMl}ml ·{' '}
          {(item.template.standardDrinks * item.quantity).toFixed(1)} std
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => { hapticLight(); onDec(item.key); }}
          className="w-7 h-7 rounded-lg bg-white/[0.05] active:bg-white/[0.1] flex items-center justify-center"
          aria-label={`Remove one ${item.template.drinkName}`}
        >
          <Minus className="w-3.5 h-3.5 text-zinc-400" />
        </button>
        <span className="w-6 text-center text-sm font-mono font-semibold">
          {item.quantity}
        </span>
        {showInc && (
          <button
            onClick={() => { hapticLight(); onInc(item.key); }}
            className="w-7 h-7 rounded-lg bg-white/[0.05] active:bg-white/[0.1] flex items-center justify-center"
            aria-label={`Add one ${item.template.drinkName}`}
          >
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}
        <button
          onClick={() => { hapticWarning(); onRemove(item.key); }}
          className="w-7 h-7 rounded-lg active:bg-red-500/10 flex items-center justify-center"
          aria-label={`Remove all ${item.template.drinkName}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-zinc-600" />
        </button>
      </div>
    </motion.div>
  ));

  return (
    <div className="space-y-1.5">
      {animate ? <AnimatePresence initial={false}>{rows}</AnimatePresence> : rows}
      {typeof totalStandardDrinks === 'number' && (
        <p className="text-[10px] text-zinc-600 text-center pt-1">
          {totalStandardDrinks.toFixed(1)} std drinks total
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/session/drink-cart.tsx
git commit -m "Add shared DrinkCart component for grouped +/- drink rows"
```

---

## Task 5: Refactor DrinkList (live session) to render via DrinkCart

**Files:**
- Modify: `src/components/session/drink-list.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
'use client';

import { useMemo } from 'react';
import type { DrinkEntry } from '@/types';
import { DrinkIcon } from '@/components/ui/drink-icon';
import { DrinkCart, type DrinkCartItem } from '@/components/session/drink-cart';

interface DrinkListProps {
  drinks: DrinkEntry[];
  onRemove: (drinkId: string) => void;
  onAdd?: (drink: DrinkEntry) => void;
}

interface DrinkGroup extends DrinkCartItem {
  entries: DrinkEntry[];
}

export function DrinkList({ drinks, onRemove, onAdd }: DrinkListProps) {
  // Group drinks by drinkDefinitionId, ordered with most-recent group first.
  const groups = useMemo<DrinkGroup[]>(() => {
    const map = new Map<string, DrinkGroup>();
    const order: string[] = [];
    for (const drink of drinks) {
      const defId = drink.drinkDefinitionId;
      const existing = map.get(defId);
      if (existing) {
        existing.entries.push(drink);
        existing.quantity += 1;
      } else {
        order.push(defId);
        map.set(defId, {
          key: defId,
          template: drink,
          quantity: 1,
          entries: [drink],
        });
      }
    }
    return order.reverse().map((id) => map.get(id)!);
  }, [drinks]);

  if (drinks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <DrinkIcon category="beer" className="w-10 h-10 mb-3" />
        <p className="text-sm text-zinc-500">No drinks yet</p>
        <p className="text-xs text-zinc-600">Tap + to add your first drink</p>
      </div>
    );
  }

  const groupByKey = (key: string) => groups.find((g) => g.key === key);

  const handleInc = (key: string) => {
    if (!onAdd) return;
    const group = groupByKey(key);
    if (!group) return;
    onAdd({
      ...group.template,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      roundId: null,
    });
  };

  const handleDec = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    const latest = group.entries[group.entries.length - 1];
    onRemove(latest.id);
  };

  const handleRemoveAll = (key: string) => {
    const group = groupByKey(key);
    if (!group) return;
    for (const entry of group.entries) onRemove(entry.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500">
          Drinks ({drinks.length})
        </h3>
      </div>
      <DrinkCart
        items={groups}
        onInc={handleInc}
        onDec={handleDec}
        onRemove={handleRemoveAll}
        showInc={!!onAdd}
        animate
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify type compiles and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual check — live session**

Start: `npm run dev`
Open `/session` with an active session. Verify: drinks still render with the +/- UI; minus removes the latest of its group; plus clones and adds; trash clears the whole group. Animations still play when adding a new drink type.

- [ ] **Step 4: Commit**

```bash
git add src/components/session/drink-list.tsx
git commit -m "Delegate DrinkList rendering to shared DrinkCart component"
```

---

## Task 6: Refactor SessionForm create-past cart to use DrinkCart

**Files:**
- Modify: `src/components/session/session-form.tsx` (imports + cart render)

- [ ] **Step 1: Update imports**

At the top of the file (around lines 3-25), remove `Minus, Trash2` from the lucide import and remove the unused `DrinkIcon` import if it becomes unused after this task. Then add `DrinkCart`:

```tsx
import { ChevronLeft, MapPin, Plus, Camera } from 'lucide-react';
```

```tsx
import { DrinkCart, type DrinkCartItem } from '@/components/session/drink-cart';
```

Keep `DrinkIcon` imported — it's still used elsewhere in the file? Check. After this task, `DrinkIcon` is used only in the edit-mode read-only block (which Task 7 deletes). Leave the import for now; Task 7 removes it if unused.

- [ ] **Step 2: Replace the create-past cart render**

Find the block at lines 370-412 (starts with `{mode === 'create-past' && cart.length > 0 && (`). Replace that entire block with:

```tsx
          {mode === 'create-past' && cart.length > 0 && (
            <DrinkCart
              items={cart.map<DrinkCartItem>((c) => ({
                key: c.template.drinkDefinitionId,
                template: c.template,
                quantity: c.quantity,
              }))}
              onInc={(key) => { hapticLight(); incCart(key); }}
              onDec={(key) => { hapticLight(); decCart(key); }}
              onRemove={(key) => { hapticWarning(); removeCart(key); }}
              totalStandardDrinks={totalStandardDrinks}
            />
          )}
```

Note: `DrinkCart` already fires `hapticLight`/`hapticWarning` internally (Task 4 wires them), but the inline wrappers here also call them. That would double-fire. Remove the redundant calls so the form block is:

```tsx
          {mode === 'create-past' && cart.length > 0 && (
            <DrinkCart
              items={cart.map<DrinkCartItem>((c) => ({
                key: c.template.drinkDefinitionId,
                template: c.template,
                quantity: c.quantity,
              }))}
              onInc={incCart}
              onDec={decCart}
              onRemove={removeCart}
              totalStandardDrinks={totalStandardDrinks}
            />
          )}
```

- [ ] **Step 3: Verify type compiles and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual check — create-past cart**

Run: `npm run dev`, navigate to "Log past session", add a couple drinks. Verify +/- and trash behave the same as before and the std-drinks total still renders.

- [ ] **Step 5: Commit**

```bash
git add src/components/session/session-form.tsx
git commit -m "Render create-past cart via shared DrinkCart"
```

---

## Task 7: Enable drinks and photos editing in SessionForm edit mode

**Files:**
- Modify: `src/components/session/session-form.tsx`

- [ ] **Step 1: Initialize cart from existing drinks on edit**

Replace the `cart` state init at line 91 with a version that seeds from `existingSession?.drinks` when in edit mode. Place this helper *above* the component (after the `CartItem` interface, before `MOODS`):

```tsx
function groupDrinksIntoCart(drinks: DrinkEntry[]): CartItem[] {
  const map = new Map<string, CartItem>();
  const order: string[] = [];
  for (const d of drinks) {
    const existing = map.get(d.drinkDefinitionId);
    if (existing) {
      existing.quantity += 1;
    } else {
      order.push(d.drinkDefinitionId);
      map.set(d.drinkDefinitionId, { template: d, quantity: 1 });
    }
  }
  return order.map((id) => map.get(id)!);
}
```

Change the cart init at line 91 from:

```tsx
  const [cart, setCart] = useState<CartItem[]>([]);
```

to:

```tsx
  const [cart, setCart] = useState<CartItem[]>(() =>
    mode === 'edit' && existingSession ? groupDrinksIntoCart(existingSession.drinks) : [],
  );
```

Change the photos init at line 95 from:

```tsx
  const [photos, setPhotos] = useState<string[]>([]);
```

to:

```tsx
  const [photos, setPhotos] = useState<string[]>(
    () => existingSession?.photos ?? [],
  );
```

- [ ] **Step 2: Remove the edit-mode read-only branches**

Delete the `existingDrinks` constant (line 100) and the two edit-mode gates it feeds:

At lines 102-107, replace:

```tsx
  const totalDrinks =
    mode === 'edit' ? existingDrinks.length : cart.reduce((s, c) => s + c.quantity, 0);
  const totalStandardDrinks =
    mode === 'edit'
      ? existingDrinks.reduce((s, d) => s + d.standardDrinks, 0)
      : cart.reduce((s, c) => s + c.template.standardDrinks * c.quantity, 0);
```

with:

```tsx
  const totalDrinks = cart.reduce((s, c) => s + c.quantity, 0);
  const totalStandardDrinks = cart.reduce(
    (s, c) => s + c.template.standardDrinks * c.quantity,
    0,
  );
```

At lines 122-130, replace the `validationError` useMemo with:

```tsx
  const validationError = useMemo(() => {
    return validateSessionForm({
      venue,
      startedAt,
      endedAt,
      drinks: drinksForSubmit,
      mood,
    });
  }, [venue, startedAt, endedAt, drinksForSubmit, mood]);
```

- [ ] **Step 3: Make the Add button and empty state unconditional**

At lines 349-357 the `Add` header button is gated on `mode === 'create-past'`. Remove that gate:

```tsx
            <button
              onClick={() => { hapticLight(); setShowPicker(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
```

At lines 360-368, remove the `mode === 'create-past' &&` gate on the "Add a drink" empty state:

```tsx
          {cart.length === 0 && (
            <button
              onClick={() => { hapticLight(); setShowPicker(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-6 rounded-2xl border border-dashed border-white/[0.08] active:bg-white/[0.03] text-zinc-500 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add a drink
            </button>
          )}
```

At lines 370 (after Task 6 refactor), remove the `mode === 'create-past' &&` gate on the `DrinkCart` render:

```tsx
          {cart.length > 0 && (
            <DrinkCart
              items={cart.map<DrinkCartItem>((c) => ({
                key: c.template.drinkDefinitionId,
                template: c.template,
                quantity: c.quantity,
              }))}
              onInc={incCart}
              onDec={decCart}
              onRemove={removeCart}
              totalStandardDrinks={totalStandardDrinks}
            />
          )}
```

- [ ] **Step 4: Delete the read-only edit-mode drinks block**

Delete the entire `{mode === 'edit' && existingDrinks.length > 0 && (...)` block (approximately lines 414-434 pre-refactor; look for `Drinks aren't editable here`).

- [ ] **Step 5: Make the photos section unconditional**

At lines 469-485 the photos section is gated on `mode === 'create-past'`. Remove the outer gate:

```tsx
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-zinc-500">
              Photos {photos.length > 0 && `(${photos.length})`}
            </span>
            <button
              onClick={handleAddPhoto}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] text-zinc-400 text-[11px] font-semibold active:bg-white/[0.08]"
            >
              <Camera className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {photos.length > 0 && <PhotoGallery photos={photos} onRemove={removePhoto} />}
        </div>
```

- [ ] **Step 6: Clean up unused imports**

Remove `DrinkIcon` from imports if no longer referenced (ESLint will flag). Keep `Plus`, `Minus`, `Trash2` removals from Task 6.

Run: `npm run lint`
Fix any `no-unused-vars` warnings by deleting the offending import.

- [ ] **Step 7: Verify type compiles**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Manual check — edit mode renders cart**

Run: `npm run dev`, navigate to `/session/edit?id=<an existing completed session id>`. Verify the drinks render with +/- controls, Add button appears, photos section renders with existing photos and an Add button.

**Do not try to save yet** — the save path is wired up in Task 8.

- [ ] **Step 9: Commit**

```bash
git add src/components/session/session-form.tsx
git commit -m "Enable drink and photo editing UI in SessionForm edit mode"
```

---

## Task 8: Wire SessionForm edit save path to persist drinks/photos/caption

**Files:**
- Modify: `src/components/session/session-form.tsx` (import and `handleSubmit` edit branch)

- [ ] **Step 1: Add `spreadDrinkTimestamps` to the session-utils import**

At line 19-23, extend the import:

```tsx
import {
  validateSessionForm,
  durationMinutesBetween,
  buildSessionSummary,
  spreadDrinkTimestamps,
} from '@/lib/session-utils';
```

- [ ] **Step 2: Replace the edit branch of `handleSubmit`**

Find the edit branch in `handleSubmit` (starts around line 220 with `// Edit mode`, ends around line 262 with `router.replace(...)`). Replace the entire branch with:

```tsx
    // Edit mode
    if (!existingSession) {
      setSubmitting(false);
      return;
    }

    // Step 1: sync session metadata (venue/times/mood) via updateSession.
    const updates: Parameters<typeof updateSession>[1] = {};
    if (venue.trim() !== existingSession.venue) updates.venue = venue.trim();
    if (startedAt !== existingSession.startedAt) updates.startedAt = startedAt;
    if (endedAt !== (existingSession.endedAt ?? existingSession.startedAt))
      updates.endedAt = endedAt;
    if (mood !== existingSession.mood) updates.mood = mood;

    let updatedSession = existingSession;
    if (Object.keys(updates).length > 0) {
      const result = await updateSession(existingSession.id, updates);
      if (!result) {
        setSubmitting(false);
        return;
      }
      updatedSession = result;
    }

    // Step 2: detect drink / photo / caption changes and sync via updateFeedItem.
    const originalDrinksCount = existingSession.drinks.length;
    const originalGroupCounts = new Map<string, number>();
    for (const d of existingSession.drinks) {
      originalGroupCounts.set(
        d.drinkDefinitionId,
        (originalGroupCounts.get(d.drinkDefinitionId) ?? 0) + 1,
      );
    }
    const newGroupCounts = new Map<string, number>();
    for (const c of cart) newGroupCounts.set(c.template.drinkDefinitionId, c.quantity);

    let drinksChanged = drinksForSubmit.length !== originalDrinksCount;
    if (!drinksChanged) {
      if (originalGroupCounts.size !== newGroupCounts.size) {
        drinksChanged = true;
      } else {
        for (const [key, count] of newGroupCounts) {
          if (originalGroupCounts.get(key) !== count) {
            drinksChanged = true;
            break;
          }
        }
      }
    }

    const originalPhotos = existingSession.photos ?? [];
    const photosChanged =
      photos.length !== originalPhotos.length ||
      photos.some((p, i) => p !== originalPhotos[i]);
    const captionChanged = !!existingFeedItem && caption !== existingFeedItem.caption;

    if (existingFeedItem && (drinksChanged || photosChanged || captionChanged)) {
      // When drink count changes, re-spread timestamps across the (possibly
      // updated) session window so derived analytics stay honest.
      let drinksToPersist = drinksForSubmit;
      if (drinksChanged && drinksToPersist.length > 0) {
        const stamps = spreadDrinkTimestamps(
          updatedSession.startedAt,
          updatedSession.endedAt ?? updatedSession.startedAt,
          drinksToPersist.length,
        );
        drinksToPersist = drinksToPersist.map((d, i) => ({
          ...d,
          timestamp: stamps[i],
        }));
      }

      const nextSession: DrinkSession = {
        ...updatedSession,
        drinks: drinksChanged ? drinksToPersist : updatedSession.drinks,
        totalStandardDrinks: drinksChanged
          ? drinksToPersist.reduce((s, d) => s + d.standardDrinks, 0)
          : updatedSession.totalStandardDrinks,
        totalVolumeMl: drinksChanged
          ? drinksToPersist.reduce((s, d) => s + d.volumeMl, 0)
          : updatedSession.totalVolumeMl,
      };

      const feedUpdates: Parameters<typeof updateFeedItem>[1] = {};
      if (captionChanged) feedUpdates.caption = caption;
      if (photosChanged) feedUpdates.photos = photos;
      if (drinksChanged) {
        // buildSessionSummary uses the session's current venue/duration/mood,
        // so we feed it the post-updateSession state.
        feedUpdates.sessionSummary = buildSessionSummary(nextSession);
      } else if (
        updates.venue !== undefined ||
        updates.startedAt !== undefined ||
        updates.endedAt !== undefined ||
        updates.mood !== undefined
      ) {
        // Metadata-only change: keep the existing behavior of regenerating
        // the summary so the feed card stays in sync.
        feedUpdates.sessionSummary = buildSessionSummary(updatedSession);
      }

      await updateFeedItem(existingFeedItem.id, feedUpdates);
    } else if (
      existingFeedItem &&
      (updates.venue !== undefined ||
        updates.startedAt !== undefined ||
        updates.endedAt !== undefined ||
        updates.mood !== undefined)
    ) {
      // Metadata changed but no drink/photo/caption change — still refresh
      // the feed card's session_summary.
      await updateFeedItem(existingFeedItem.id, {
        sessionSummary: buildSessionSummary(updatedSession),
      });
    }

    hapticSuccess();
    addToast('Session updated', 'success');
    router.replace(`/session?id=${existingSession.id}`);
```

- [ ] **Step 3: Import `DrinkSession` type if not already imported**

Confirm the top-of-file import already has `DrinkSession` from `@/types`. If not, add it. (Existing import at line 7 already includes it.)

- [ ] **Step 4: Verify type compiles and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Manual check — full round-trip**

Run: `npm run dev`.

1. Open `/session/edit?id=<a session with drinks and a feed post>`.
2. Change caption → save → return to `/session?id=...` → check feed post reflects new caption.
3. Edit the session again: add a drink, remove one, change quantity of another → save → verify feed card shows new drink counts and session detail shows new drinks.
4. Edit again: remove a photo, add a different photo → save → verify post detail shows new photos.
5. In the browser Supabase inspector (or `select * from drink_entries where session_id = '<id>'`), confirm the new rows carry the real `drink_definition_id` (not the string `'edited'`) and timestamps spread across the session window.

- [ ] **Step 6: Commit**

```bash
git add src/components/session/session-form.tsx
git commit -m "Persist edited drinks, photos, and caption via updateFeedItem"
```

---

## Task 9: Route feed post "Edit Post" to the session edit page; delete modal

**Files:**
- Modify: `src/app/(app)/feed/[id]/post-detail.tsx`

- [ ] **Step 1: Change the menu "Edit Post" button to navigate**

Find the menu button at lines 692-704 (starts with the `<Pencil`). Replace the `onClick` handler so it navigates instead of opening the modal:

```tsx
              <button
                onClick={() => {
                  setShowMenu(false);
                  router.push(`/session/edit?id=${item.sessionId}`);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4 text-zinc-400" />
                <span className="text-sm">Edit Post</span>
              </button>
```

- [ ] **Step 2: Delete the edit modal and its state**

Delete the entire `{/* Edit Post Modal */} <AnimatePresence> { showEditModal && ( ... ) } </AnimatePresence>` block (lines 722-862).

Delete the following state declarations at lines 45-50:

```tsx
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editDrinks, setEditDrinks] = useState<FeedItem['sessionSummary']['drinks']>([]);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [showDrinkPicker, setShowDrinkPicker] = useState(false);
  const [saving, setSaving] = useState(false);
```

Also delete `updateFeedItem` from the store bindings at line 34 if it's no longer used in this file — search for `updateFeedItem` in the file after the modal is removed. (Only the modal used it.)

- [ ] **Step 3: Clean up unused imports**

Remove from the `lucide-react` import (line 5) any icons no longer used after deleting the modal: `Plus`, `Camera`. Keep `X` — it's still used in other places in the file (likes list close button, replying-to dismiss).

Remove from the top of the file these imports if they're no longer referenced after the modal removal:

```tsx
import { DrinkPicker } from '@/components/session/drink-picker';
import { pickImage, compressImage } from '@/lib/image-utils';
```

Run: `npm run lint`
Fix any unused-var warnings by deleting the offending imports/bindings.

- [ ] **Step 4: Verify type compiles and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Manual check — entry point**

Run: `npm run dev`.

1. Open a feed post you own. Tap `…` → "Edit Post" → confirm the router navigates to `/session/edit?id=...` and the form renders.
2. Make a change → save → confirm navigation back and the feed card updates.
3. Confirm there is no longer any modal-based edit UI anywhere in the post detail.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/feed/\[id\]/post-detail.tsx
git commit -m "Route Edit Post to unified session edit page; delete modal"
```

---

## Task 10: Final verification

**Files:** none.

- [ ] **Step 1: Full type check + lint + build**

Run: `npm run lint && npm run build`
Expected: clean build.

- [ ] **Step 2: Full manual walkthrough**

Run: `npm run dev`. Walk the flows once more:

- Live session page → add/remove drinks with +/- (DrinkList).
- `/session/log-past` → create-past cart with +/-.
- Feed post `…` → Edit Post → lands on edit page → edit drinks, photos, caption, venue, times, mood → save → feed card updates, session detail updates, DB rows carry real `drink_definition_id` and spread timestamps.

- [ ] **Step 3: Merge / PR when satisfied**

The branch name is `darahaas15/edit-session-drinks`. Create a PR from that branch to `main` when manual verification passes. Do not open the PR until the user asks.
