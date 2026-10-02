# Change notes: implementation plan (2026-09-27)

Source: `change notes.md` at the repo root, refined through a grilling session.
Four changes are in scope, each shipped as its own PR in the order below. Location support and recaps are in the [backlog](#backlog) with their decisions recorded.

Every PR:

- adds a new entry at the top of `src/lib/changelog.ts` (next version up), or users are never told;
- passes `npm run ci` and `npm run lint`;
- is checked in the running app against the local stack (`colima start && supabase start`, `npm run db:seed-users`, `npm run dev`; log in as `alice@test.local` / `password123`), in both light and dark theme;
- uses theme tokens only (see the token contract in `CLAUDE.md`), no hardcoded `bg-white/`, `text-zinc-`, `rgba(...)`.

| # | PR | Size | DB change |
|---|---|---|---|
| 1 | Centre the auth forms | S | none |
| 2 | Records open their session + stay correct | M | migration (functions + triggers + backfill) |
| 3 | Feed card for photo-less posts + start time on every post | M | none (JSON field) |
| 4 | Full-screen end-session review; every session is a post | L | migration (one post per session) + one-off prod cleanup |

---

## PR 1 - Centre the auth forms

**Decision.** Sign-in, sign-up, forgot-password and reset-password: "Back" stays pinned top-left; the form is vertically centred in the space below it. When the form doesn't fit (keyboard open, small phone, sign-up's longer form), it top-aligns and scrolls instead of clipping.

**Current state.** In `src/app/page.tsx` the sign-in and sign-up panels (`screen === 'signin' | 'signup'`, around lines 303-460) are `flex flex-col ... pt-3 flex-1` with content flowing from the top. The landing screen centres itself with `flex-1` spacers. `src/app/forgot-password/page.tsx` has the same top-flow layout; `src/app/reset-password/page.tsx` pushes its form down with a fixed `pt-16`.

**Approach.** Keep each panel as the scroll container (`flex flex-col flex-1 overflow-y-auto`), keep the Back button as its first child, and wrap everything after it in a `my-auto` block.
In a flex column, auto margins centre the block when there's spare space and collapse to 0 when there isn't, so it top-aligns and scrolls, which gives exactly the fallback we want with no JS or keyboard detection. (`justify-center` would clip the top of an overflowing form, so don't use it.)
Apply the same wrapper to forgot-password and reset-password (replacing `pt-16`). Reset-password's loading/success states already centre with `justify-center flex-1`; leave them.

**Verify.** Phone-sized viewport (e.g. 390x844 and a short 375x667): form centred; tap into an input so the keyboard opens and the form stays reachable and scrollable; sign-up (tallest form) scrolls on the short viewport. The landing -> sign-in slide animation is unchanged.

**Changelog.** "The sign-in and sign-up screens now sit in the middle of the screen."

---

## PR 2 - Records open their session, and stay correct when sessions change

**Decisions.**

- Tapping a record on your profile opens the session that set it: `/session?id=<id>` (the app's existing link style; it renders the same detail page as `/session/[id]`).
- A record must always belong to an existing, completed session. When a session is deleted or edited (drinks, times), the affected records are recomputed from the remaining sessions: the runner-up takes over, or the record disappears if nothing qualifies.
- Recompute runs in the database (it sees the full history, which the client may not have loaded).
- A one-time run of the same recompute repairs existing orphaned records.

**Current state (facts).**

- Records render only on your own profile, `src/app/(app)/profile/page.tsx` ~line 440, as non-interactive rows.
- `personal_records` has a unique `(user_id, category)` and `session_id ... ON DELETE SET NULL`, so deleting a post (which deletes its session, `use-feed-store.ts` ~line 576) leaves an orphaned record that still shows.
- Only 5 categories are ever written, all per-session: `most_drinks_session`, `most_standard_drinks`, `longest_session`, `most_unique_drinks`, `fastest_drink` (`src/lib/algorithms/pr-detection.ts`). `longest_streak` and `most_sessions_week` exist in the type but are never detected, so they are out of scope here.
- The client writes records: `detectPRs()` at session end, then `addPR()` upserts to `personal_records` (`use-profile-store.ts` ~line 83).

### 2a. Migration `supabase/migrations/<date>_recompute_personal_records.sql`

1. `recompute_personal_records(p_user_id uuid)`, `SECURITY DEFINER`, `SET search_path = public` (per `20260923_pin_function_search_path.sql`). For each of the 5 categories, over the user's `status = 'completed'` sessions only (a live session must never hold a record):
   - `most_drinks_session`: `count(drink_entries)`;
   - `most_standard_drinks`: `drink_sessions.total_standard_drinks`;
   - `longest_session`: `drink_sessions.duration_minutes`;
   - `most_unique_drinks`: `count(distinct drink_definition_id)`;
   - `fastest_drink`: smallest gap in whole minutes between consecutive `drink_entries.timestamp` (window `lag()`), rounded like the TS; sessions with < 2 drinks or a gap <= 0 don't qualify (mirrors `computeSessionMetric` + the `value <= 0` skip). Lower is better.
   - Holder = best value; ties go to the **earliest** session (the original holder keeps it). `value`, `session_id`, `achieved_at` = holder's `ended_at`, `previous_value` = runner-up's value (or null), `formatted_value` mirrors `formatPrValue()` exactly (old app versions still display it).
   - Upsert on `(user_id, category)`; delete the row when no session qualifies. Preserve `celebrated` when the holder is unchanged.
2. Triggers (all call the function once per affected user):
   - `drink_sessions` AFTER DELETE, and AFTER UPDATE when `status`, `started_at`, `ended_at`, `duration_minutes` or `total_standard_drinks` changed. Row-level is fine (few rows per statement). This also covers session completion, so records exist even if the client never writes them.
   - `drink_entries` AFTER INSERT/UPDATE/DELETE, **statement-level** with transition tables, collecting the distinct owners of affected **completed** sessions. Log-past bulk-inserts N drinks in one statement, and a live session's drink adds must not trigger work. Verify locally that Postgres accepts the chosen trigger forms (transition tables can't be combined with column lists).
   - A session delete cascades to its drinks; make sure that path recomputes once and doesn't error when the parent row is already gone.
3. Backfill: `SELECT recompute_personal_records(id) FROM profiles;` at the end of the migration.
4. Housekeeping per `CLAUDE.md`: add the file to `FILES` in `scripts/test-db-bootstrap.sh`; apply to PROD by hand (it's the only DB). App code is safe before or after the migration (see 2b).

### 2b. App changes

- **DB is the only writer.** In `use-profile-store.ts`, `addPR` keeps its optimistic local update (for the celebration) but stops upserting. After `endSession`, and after a session edit or delete, call `fetchPRs(userId, true)` so the profile shows the DB's result. If the migration trails the deploy, records simply stop updating until it lands; nothing breaks. Keep `detectPRs()` for the celebration trigger only.
- **Display from value.** Export `formatPrValue` and render `formatPrValue(pr.category, pr.value)` on the profile rather than trusting `formatted_value`.
- **Tappable rows.** Each record row becomes a button -> `router.push('/session?id=' + pr.sessionId)`, the link style the rest of the app uses. Add a chevron to signal tappability. Confirm `session-detail.tsx` loads a session not already in the local store (older sessions beyond the loaded history); if it doesn't, fetch it by id.
- Remove `markCelebrated` / `getUncelebratedPRs` / `getPRsByUser` (dead, found in the 2026-09-27 sweep) while in this file.

### 2c. Tests

- `tests/integration/records.test.ts` (runs under `npm run test:rls`): complete two sessions -> holder is the bigger one; delete it -> runner-up takes over; delete both -> record gone; remove drinks via edit -> recompute; an active session with many drinks never holds a record; `fastest_drink` lower-is-better and 1-drink sessions excluded; formatted_value matches `formatPrValue` for each category.
- `pr-detection.test.ts`: cover the newly exported `formatPrValue`.

**Changelog.** "Tap a personal record to see the session where you set it." / "Records now update when you edit or delete a session."

---

## PR 3 - Feed card for photo-less posts, and start time on every post

**Decisions.**

- Posts **without photos** get a "stats hero" card: header = venue + start time; three large numbers (drinks, drink score/std, duration); then every drink as an icon.
- Posts **with photos** keep the current compact stats box, plus the start time.
- **Drink icons (revised 2026-09-29, replacing a grouped name list):** both card types show every drink as a 20px icon, wrapping onto as many lines as needed, with no "+N" cap. Order is when each drink was drunk (sorted by drink time, since an undone drink is re-appended to the end; older rows without times keep stored order). Very old posts that saved only emojis show generic icons. Post detail keeps its grouped list.
- **Every** post shows the start time, e.g. "Fri · 9:40 PM".
- The start time is stored in the post's `session_summary` JSON (no migration). Older posts fall back to their earliest drink time, else show no time.
- The post always shows the **session's** start time. It changes only when the user edits the session's Start field in the edit screen (already exists); other edits leave it alone. There is no separate post time.

**Current state.** `src/components/feed/feed-card.tsx` ~lines 139-176 render a small `bg-card` box (tiny venue, icons row, one tiny stats line) for every post. `FeedItem.sessionSummary` (`src/types/feed.ts`) has no start time. `buildSessionSummary()` (`src/lib/session-utils.ts` ~line 40) builds it, and `session-form.tsx` (~lines 340-370) already rebuilds the summary whenever `startedAt` changes on edit, so adding the field there covers the edit rule automatically.

**Steps.**

1. `src/types/feed.ts`: add `startedAt?: string` to `sessionSummary` (optional; older rows omit it). `buildSessionSummary` writes `session.startedAt`.
2. Pure helpers in `src/lib/session-utils.ts` (unit-tested):
   - `postStartTime(summary): string | null` = `summary.startedAt` ?? earliest `drinks[].timestamp` ?? `null`;
   - `formatPostStartTime(iso, now)`: weekday + time within the last 6 days ("Fri · 9:40 PM"), else day + month ("12 Sep · 9:40 PM"), plus the year if it's not the current year;
   - `orderedPostDrinks(drinks)`: drinks in the order they were drunk (see above).
   - `groupDrinks(drinks, keyOf)`: the cart's grouping, extracted from `groupDrinksIntoCart` in `session-form.tsx` for reuse in PR 4.
3. `feed-card.tsx`: branch on `item.photos.length`. The photo-less branch renders the hero card; the photo branch keeps today's box. Both show the start time next to the venue.
4. Post detail (`src/app/(app)/feed/[id]/`): show the start time in its stats too.
5. The hero card must not change feed virtualization/row-height assumptions, if any. Check `feed/page.tsx` and fix any fixed-height estimate.

**Tests.** Unit tests for the three helpers (legacy summary without `startedAt` or drink timestamps -> `null`; ordering by drink time, ties and rows without times). Visual check with seeded users: post a session with and without a photo, a 30-drink session that wraps, in both themes.

**Changelog.** "Posts without photos now show a proper summary of the night: what you drank and when it started." / "Every post now shows what time the session started."

---

## PR 4 - Full-screen end-session review, and every session is a post

**Decisions.**

- **A completed session and its post are one thing (decided 2026-10-02).** Neither exists without the other. There is no "save without posting"; finishing always posts. Discarding an **active** session (the existing abandon flow) is unchanged, since an active session isn't in history.

- "End" opens a **full-screen review** (not a popup), one scrolling page, top to bottom: stats summary -> drink list -> photos + **Add photo** -> mood -> caption -> tag people; **Post** pinned at the bottom; "Back to session" at the top.
- Drink list = grouped rows with **remove** and **+/- count** (reuse `DrinkCart`). No per-drink time or price editing here; that stays in the edit screen after posting.
- Edits apply **immediately** to the live session (same store actions as removing a drink mid-session), so "Back to session" keeps them and nothing is lost if the app is killed.
- Records preview and BAC are **not** shown (the celebration covers records).
- The **Share** button on session detail goes (it only existed for unposted sessions).
- **Self-healing posting.** If the post fails after the session ends, the session is kept and the post is retried in the background. Caption and tags are saved on the device before posting; on app start and on reconnect, any of your completed sessions without a post is posted with its saved caption and tags (or none), then the device copy is cleared. This covers live sessions and "Log past session". A unique-violation on insert counts as success.
- **The database enforces it.** `feed_items.session_id` becomes `NOT NULL`, `UNIQUE` and `ON DELETE CASCADE` (today it is nullable, `ON DELETE SET NULL`, `supabase/schema.sql:128`).

**Current state.** `src/app/(app)/session/page.tsx` ~lines 580-690: a centred `max-w-sm` modal (`showPostPreview`) with a summary line, up to 6 drink icons, photos, mood, caption, `TagPeopleField`, Back / Post / Save without posting. `finishSession(share)` (~line 209) handles the end; `share: false` ends without a post. Session detail offers **Share** for unposted sessions (`session-detail.tsx` ~line 66). `createPastSession` inserts the session, then `createFeedItemFromSession` posts it, so a failure there also leaves a session without a post. Photo adding already exists on this page (~line 187, `pickImage` -> `uploadImage` -> `addPhoto`).

**Steps.**

1. New `src/components/session/session-review.tsx`: a full-screen layer with the same z-index as today's modal, `var(--background)` base, sticky header (`var(--chrome-bg)`) holding "Back to session" and the title, scrolling body, and a bottom action bar (`var(--chrome-strong-bg)`) respecting `safe-bottom`. It takes the active session and page-owned state (mood, caption, tags) plus callbacks, so `finishSession` and its state stay in `page.tsx`.
2. Drink rows: `DrinkCart` over `groupDrinks(activeDrinks, ...)` (from PR 3), keyed like the edit screen's cart:
   - `onInc`: `addDrink` with a copy of the group's template (new id, `timestamp: now`);
   - `onDec`: `removeDrink` on the group's most recent drink;
   - `onRemove`: remove every drink in the group, with an undo toast via `restoreDrink` if the page already offers one for removals.
3. Photos: `PhotoGallery` + an "Add photo" button reusing the existing handler (move it into a shared function rather than duplicating it).
4. Zero drinks: disable Post with a hint ("Add a drink, or go back to discard the session"). Discarding stays on the session screen's existing abandon flow.
5. Replace the modal in `page.tsx` with `<SessionReview>`; delete the old modal markup. `finishSession` loses its `share` flag and always posts.
6. Motion: slide up on open, down on Back; respect `prefers-reduced-motion`. Keep `posting` guarding double-submits.
7. Remove the Share button and `canShare` logic from `session-detail.tsx`.
8. Self-healing posting: a small persisted store (`persist` + `safeJSONStorage`) of pending `{ sessionId, caption, taggedUserIds }`, written before the post insert and cleared on success. A `ensureSessionsPosted(userId)` pass, run on app start and on `online`, loads the user's completed sessions with no post (one query, left join on `feed_items`), posts each with its pending caption/tags if any, and treats Postgres `23505` (unique violation) as already posted. `createFeedItemFromSession` returns success/failure instead of only toasting.
9. Migration `supabase/migrations/<date>_one_post_per_session.sql`: `feed_items.session_id` `NOT NULL`, a unique constraint, and the foreign key recreated `ON DELETE CASCADE`. Add it to `FILES` in `scripts/test-db-bootstrap.sh`. It fails while prod holds posts without a session or duplicate posts, so it runs after the cleanup below. `deleteFeedItem` can keep deleting the session explicitly; the cascade makes deleting from either side safe.
10. One-off prod cleanup script (run by hand, not a migration), `scripts/cleanup-unposted-sessions.sql`, in two parts:
    - **Count and list** (read-only): completed sessions with no post, per user; posts with no session; sessions with more than one post, flagging any duplicate that has likes or comments.
    - **Delete**, after review: unposted completed sessions (cascades drinks, photos, rounds; the PR 2 triggers recompute records), posts with no session, and all but the earliest post of each duplicated session. Never touches active sessions.

**Prod rollout, in order (by hand):** apply the PR 2 records migration and merge #34 -> run the cleanup count, review, run the delete -> apply the one-post-per-session migration -> deploy PR 4.

**Tests.** Unit-test any new pure logic (which drink `onDec` removes). Manual, with seeded users:

- Review shows the drinks grouped; +/- and remove update the stats live.
- Back -> session keeps the edits; End again -> review reflects them.
- Add a photo from the review; tag Bob; add a caption.
- Post -> feed card (PR 3) shows caption, tag, photo.
- There is no Save without posting; session detail has no Share button.
- Post with the network blocked -> session kept; restore the network or reload -> the post appears with its caption and tags, once.
- Same for Log past session.
- Integration (`npm run test:rls`): a second post for the same session is rejected; a post without a session is rejected; deleting a session deletes its post.
- Removing every drink disables Post.
- Kill and reload mid-review -> live session intact.
- Check both themes and a short viewport with the keyboard open on the caption.

**Changelog.** "Ending a session now shows a full review of your night: fix any drinks, add a photo, then post." / "Finished sessions are now always posted to your feed."

---

## Backlog

### Real locations (Google Places): decided, deferred

Held on 2026-09-27 before any Google Cloud setup. Decisions made so far:

- **Provider:** Google Places, called from the browser (Maps JavaScript API, Places library, Places API (New)) with **session tokens**, so an autocomplete burst plus one details call bills as a single session and fits the ~10k/month free allowance. Use our own themed suggestion list, not Google's widget.
- **Search:** bias to the user's location when permission is granted, otherwise no bias; **no** bar-only type restriction (house parties); always offer "Use '<typed text>'" as a free-text fallback.
- **Storage:** keep `drink_sessions.venue` as the display name; add optional `venue_place_id`, `venue_address`, `venue_lat`, `venue_lng` via the `OptionalColumn` pattern (`src/lib/supabase/optional-columns.ts`). The suggestion list shows your own past venues first (with their stored place data), then Google results. Old sessions stay plain text; no automatic matching.
- **Where used:** start session, log past, edit.
- **Display:** the venue name on posts and session detail becomes tappable and opens Google Maps, **only for business-type places**; posts never show an address. No static map images for now (separately billed).
- **Privacy:** add a line to `/legal/privacy` about storing the place picked for a session.
- **Setup still needed (user):** a GCP project; enable Maps JavaScript API + Places API (New); a browser key restricted to `hevydrinkr.com/*`, Vercel preview URLs and `localhost:3000/*`; set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel and `.env.local`. Guard spend with a daily quota cap (~300/day) and a budget alert, and degrade quietly to past venues + free text when quota is exhausted. (Recommended; not yet confirmed.)

### Keep drink order when a session is edited

The edit screen regroups drinks by type (its cart) and, when the drink count changes, re-spreads their times in that grouped order, so an edited session's post shows drinks grouped rather than in the order they were drunk. Logged past sessions are grouped the same way. Fix in the edit screen's save path: unchanged drinks keep their ids and times, and added drinks go at the end.

(The former "drink and photo edits on unposted sessions don't save" item is gone: PR 4 removes unposted sessions.)

### Recaps

Monthly and yearly recaps ("Photos memories" / "Spotify Wrapped" style). Not designed yet. Location data from the item above would feed "top bars of the year".

### Related findings from the 2026-09-27 sweep

- Private-account follower edges are visible to strangers (`follows_select` was loosened from AND to OR by `20260425_launch_readiness`). The RLS test in `tests/integration/rls.test.ts` stays red until this is decided.
- Dead code and abandoned features (unused UI primitives, mock data, party mode, rounds, challenges/wagers tables) are awaiting a cleanup PR.
