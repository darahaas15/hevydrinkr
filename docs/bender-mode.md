# Bender Mode — proof-of-drink sessions

**This branch carries the design only. No implementation, no migration, no code.** It exists so the mechanics, the data model and the honest limits get argued before anything is built. Implementation lands in follow-up PRs off this branch.

---

## What it is

A session mode you opt into at start. While a bender is running, **you cannot log a drink without photographing it first** — a live capture through an in-app camera, not a gallery pick. You cannot start a bender retroactively, and you cannot add drinks to one after it ends.

It is the opposite of the last release. #28 made logging as frictionless as possible (quick add, one-tap repeat, remembered prices). Bender Mode deliberately puts the friction back, for the nights people actually want a record of. The photo is the point: a camera roll of sixteen increasingly poorly-framed drinks is a better artifact of a night than `16 std drinks`, and the requirement to take it is a commitment device that keeps the count honest while you are in no state to be honest.

## The name

`Bender Mode` in all user-facing copy. Internal vocabulary is **proof** — `is_bender` on the session, `proof_photo_url` on the drink. Considered and rejected: *Receipts* (collides with the spend/cost feature from #28, where receipts means prices), *Hard Mode* (generic, hides the mechanic), *Verified Night* (overclaims — see below), *Blackout Mode* (wrong connotation).

## Read this before reviewing: "proof" is soft

A web app **cannot** prove a photo is live. Specifically:

- `<input capture="environment">` opens the camera directly on iOS and Android, and is **silently ignored on desktop**, where it degrades to an ordinary file picker. It is a hint, not a guarantee.
- `getUserMedia` is much stronger — there is no file picker anywhere in the flow — but it can still be fed a virtual camera (OBS and friends), and on desktop a user pointing a webcam at a screen defeats it entirely.

So this ships as a **commitment device, not forensic verification**. The design consequence: use `getUserMedia` with an in-app shutter as the only capture path, record `proof_captured_at` alongside the drink timestamp so the gap is visible, and **never use the word "verified" in the UI.** Copy says *proof*, *shot*, *logged live*. We are not making a claim we cannot back.

Reviewers should push back here if they want a stronger or weaker stance — it sets the copy for the whole feature.

## Rules

1. **Opt in at start only.** A "Bender" toggle on the start screen, next to venue. Once started, the flag is immutable for the life of the session.
2. **No drink without a shot.** Tapping any drink — quick add, picker, repeat-last — opens the camera instead of logging. The entry is created only after the capture uploads.
3. **Live capture only.** `getUserMedia` stream + in-app shutter. No `pickImage()` call reachable from this flow.
4. **No backfill.** `/session/log-past` has no bender toggle; `createPastSession()` hard-refuses a bender payload.
5. **No retroactive drinks.** A completed bender cannot have drinks added via the session edit form.
6. **Ends like any session.** Mood, PRs, feed post, BAC gauge, streaks all behave normally.

## Data model

Two additive columns and nothing else — no new tables.

```sql
-- drink_sessions
is_bender BOOLEAN NOT NULL DEFAULT false   -- mirrors the existing is_party_mode precedent

-- drink_entries
proof_photo_url   TEXT         -- public CDN URL in the existing `images` bucket
proof_captured_at TIMESTAMPTZ  -- shutter time, distinct from `timestamp` (log time)
```

Per-drink proof belongs on `drink_entries`, not `session_photos`. `session_photos` stays what it is — unordered vibe shots for the night. Proof is one-to-one with a drink, ordered by that drink's timestamp, and deleting the drink must take the proof with it (which the existing FK cascade already gives us).

No RLS changes. `drink_entries` policies are already scoped to the owning session and these columns inherit them. Note that the `images` bucket is **public-read by design** (see `20260527_storage_images_bucket.sql`) — anyone with the URL can fetch a proof shot regardless of what the app shows. That is already true of every photo in the app, and it is consistent with the visibility decision below, but it should be a conscious "yes" rather than something we discover later.

### Shipping ahead of the migration

PROD is the only database and app code can land before migrations. A `select()` naming a missing column fails the *whole* query — which here would take out session loading, not just the new feature. So both columns go through the `OptionalColumn` latch in `src/lib/supabase/optional-columns.ts`, following `drinkCostColumn`.

**But the degradation is different from cost, and this is the important bit.** `cost` degrades to "no spend tracking" — harmless. Proof degrading to "column dropped from the insert" would silently log a bender's drinks with the photos thrown away, which is worse than the feature not existing. So:

- **Reads** degrade quietly: no proof column, no proof grid, sessions still load.
- **Writes** do not degrade. If `benderColumns.isSupported()` is false, the Bender toggle is **hidden entirely** and existing benders become read-only. You can never take a shot that goes nowhere.

### Contract-test traps

Per the repo guide, both of these will bite:

- The contract extractor regex-matches literal `.select('...')` strings. The conditional column lists must be **written out in full at each call site** in `src/lib/supabase/drink-entries.ts` — composing them from a variable makes them invisible and `npm run contract:update` will silently *delete* columns from the snapshot. Read the `git diff` of `tests/contract/db-contract.json` and expect it to **grow**.
- The new migration must be added to the `FILES` list in `scripts/test-db-bootstrap.sh`, which does not read `supabase/migrations/`.

## Client architecture

**`src/lib/camera.ts` (new)** — `captureProofPhoto()`: request `{ video: { facingMode: 'environment' } }`, draw the frame to a canvas, export a Blob, wrap as a File, hand it to the existing `uploadImage(file, 'photos')` so compression and the CDN path are unchanged. Always stop every track in a `finally`; a leaked stream leaves the camera light on, which users read as the app spying on them.

**`src/components/session/proof-camera.tsx` (new)** — full-screen viewfinder sheet: live preview, shutter, confirm/retake, uploading state. This is an intentionally always-dark surface (the immersive photo viewer is the existing precedent), so it is an accepted exception in `npm run lint:colors` rather than a token violation. Everything else uses tokens.

**`addDrinkWithProof()` in `use-session-store.ts` (new action)** — and it must **not** be modelled on `addDrink`. `addDrink` is optimistic: it updates state immediately and fires the insert in the background. That is right for a normal session and wrong here, because an optimistic drink whose upload then fails would leave a proof-less drink inside a bender, breaking the one invariant the feature has. The bender path is capture → upload → *then* insert and update state, with the UI showing real progress and a failed upload leaving the count untouched.

**Gating** — `handleAddDrink` in `src/app/(app)/session/page.tsx` branches on `activeSession.isBender` and routes every entry point (quick add, picker, repeat-last) through the camera.

## Feed

Ending a bender publishes a **public proof grid** on the feed post: every shot, in drink order, as the post's photo set. This is the payoff — the post is the night, not a number.

Two things to settle in review:

1. Proof photos flow through `feed_items.photos` (which `createFeedItemFromSession` already populates from `session.photos`), so the grid works with the existing feed card and `PhotoGallery` with little new UI. The cost is that proof and vibe shots merge into one array on the feed item and only stay distinguishable on the session detail page, which reads `drink_entries`.
2. Sixteen photos is a lot of feed card. Needs a collapsed presentation — a 3-across grid with a "+11" overflow tile, opening the existing immersive viewer.

The post also carries a bender badge and the drink count, and the session detail page interleaves each proof shot with its drink and timestamp — a scrollable timeline of the night.

## Edge cases that need answers, not hand-waving

| Case | Proposed behaviour |
|---|---|
| Camera permission denied | Cannot start a bender. Explain why, offer a normal session. Mid-session denial blocks further logging until granted. |
| No camera (desktop) | Bender toggle hidden. Existing benders are read-only on that device. |
| Upload fails | Drink is not logged. Retry sheet on the captured blob; discarding discards the drink. |
| App backgrounded mid-capture | iOS PWAs kill the stream. Re-acquire on `visibilitychange`; never leave a dead black viewfinder. |
| Removing a drink | Allowed only inside the existing undo window; deletes the proof with it. After that a bender is append-only. |
| Ending with an upload in flight | Block the end action until it settles or is discarded. |
| Same photo re-used for every drink | Out of scope for v1. `proof_captured_at` makes it visible after the fact. A perceptual hash guard is a follow-up, not a launch blocker. |

## Testing

- Pure logic in `src/lib/` holds the coverage line: proof-requirement predicate, capture-to-log delta, bender payload refusal in `createPastSession`.
- `src/lib/camera.test.ts` with a mocked `getUserMedia`: permission denied, no device, track cleanup on both success and throw.
- Store tests: `addDrinkWithProof` does not mutate state on upload failure; `isBender` is immutable after start; edit paths refuse to add drinks to a completed bender.
- `optional-columns` tests extended: write path disabled (not degraded) when the columns are missing.
- `npm run typecheck && npm run test` gate as usual.

## Changelog

User-facing, so `src/lib/changelog.ts` gets a new top entry at `1.15.0` — no entry means users are never told.

## Out of scope

Perceptual-hash duplicate detection · bender streaks and badges · group/party benders · video proof · an explicit "I'm done, count me out" safety exit · any claim of verification.

## Open questions for review

1. Is the soft-proof stance (no "verified" anywhere) the one we want, or should we go further and drop `getUserMedia` for the simpler `capture` attribute and accept a weaker guarantee?
2. Public grid was chosen deliberately, but should a user be able to delete a single proof shot from a published bender post — and if so, does the post stop being a bender?
3. Does a bender that ends with one un-photographed drink exist? Under these rules it cannot, by construction. Worth confirming that is the intent rather than a gap.
