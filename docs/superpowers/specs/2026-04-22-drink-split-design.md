# Auto-split oversized drink entries

**Date:** 2026-04-22
**Status:** Approved, implementing

## Problem

A user entered a 300ml custom drink at spirit ABV. This stored as a single `DrinkEntry` worth ~10 standard drinks. The session UI showed "1 drink" (quantity=1) which is misleading — in reality that's 10 shots. Group totals, leaderboards, and +/- quantity counters all feel wrong because the unit isn't a normal serving.

## Goal

Make one `DrinkEntry` ≈ one normal serving. When a user logs a pour larger than a normal serving for that category, split it transparently into N entries of a normal size.

## Non-goals

- No change to the drink library (entries already sized correctly).
- No change to wine entry UX (half-glass picker, ml override, etc.).
- No retroactive splitting of already-saved drinks.
- No cap/validation on custom-drink creation (user can still save a 300ml recipe — it just splits when consumed).

## Design

### Category standard units (ml)

| Category | Unit | Rationale |
|---|---|---|
| `beer`, `cider`, `seltzer` | 500 | pint / large can |
| `wine` | 150 | standard glass |
| `whiskey`, `vodka`, `rum`, `gin`, `brandy`, `tequila`, `shot`, `desi`, `custom` | 30 | shot |
| `cocktail` | 60 | typical pour |

### Split rule

Given a `DrinkEntry` produced by the picker:

1. Let `unit = UNIT_ML[entry.category]`.
2. If `entry.volumeMl <= unit * 1.1`, return `[entry]` unchanged (10% tolerance so 330ml beer cans don't split against the 500ml pint unit).
3. Otherwise compute `n = max(2, round(entry.volumeMl / unit))`.
4. Each sub-entry: same `drinkDefinitionId`, `drinkName`, `emoji`, `category`, `abvPercent`, `notes`, `roundId`; fresh `id`, fresh `timestamp`; `volumeMl = round(entry.volumeMl / n)`; `standardDrinks = calculateStandardDrinks(subVolumeMl, abvPercent)`.

Library drinks always satisfy the tolerance (max `defaultVolumeMl` per category matches the unit), so they pass through unchanged.

### Implementation

**New helper** in `src/lib/utils.ts`:

```ts
export function splitOversizedDrink(entry: DrinkEntry): DrinkEntry[] { ... }
```

**Callsites** in `src/components/session/drink-picker.tsx`:

- `handleSelect` (library/custom-from-list path): build the entry, call `splitOversizedDrink`, invoke `onSelect` for each result.
- `handleCustomDrink` (custom-create path): same pattern.

`onSelect: (drink: DrinkEntry) => void` signature is unchanged — we just call it multiple times for a split. Consumer (`session/page.tsx:478`) closes the picker after the first call via `setShowPicker(false)`; that stays correct.

### Grouping UX

`drink-list.tsx` already groups by `drinkDefinitionId`. N sub-entries of the same custom drink → one row with quantity=N, std-drink total computed correctly via the existing `group.template.standardDrinks * group.quantity` math (safe because each sub-entry has identical `standardDrinks`).

### Out-of-picker flows

`session-form.tsx` (past-session cart) sources entries from `DrinkPicker.onSelect` → covered. `party-mode.tsx` and `post-detail.tsx` also use `DrinkPicker` → covered.

## Files touched

- `src/lib/utils.ts` — add `splitOversizedDrink` + `DRINK_CATEGORY_UNIT_ML`.
- `src/components/session/drink-picker.tsx` — wrap `onSelect` in both handlers.

## Test plan

- Pick a library 500ml Kingfisher → 1 entry (no split).
- Pick a library 150ml wine → 1 entry (no split, under tolerance).
- Create custom 300ml @ 40% spirit → 10 entries, grouped, quantity=10, total std ≈ 6.8.
- Create custom 100ml @ 30% shot → 3 entries of ~33ml.
- Create custom 400ml @ 5% beer → 1 entry (within pint tolerance: 400 < 500 * 1.1).
- Create custom 600ml @ 5% beer → 2 entries of 300ml.
