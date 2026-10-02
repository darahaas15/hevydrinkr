# Spec: multi-venue sessions (2026-10-02)

Vocabulary follows `CONTEXT.md` (Session, Drink, Venue, Stop, Route, Post). Respects ADR 0001 (every completed session is a post).

## Problem Statement

A night out often moves between places: dinner at one bar, drinks at another, the last round somewhere else. Today a session has exactly one venue. When someone moves on mid-session, all they can do is overwrite the venue, which erases where they started, and their post claims the whole night happened at the last place. Logging or editing a past night has the same limit. People can't tell the real story of the night, and their venue history undercounts the places they actually went.

## Solution

A session becomes a **route** of one or more **stops**. Each stop is a visit to a venue, starting at its arrival time and lasting until the next stop arrives (or the session ends); the first stop starts with the session. Each drink belongs to whichever stop was underway when it was had, so drinks never need to be assigned by hand.

During a live session, a **New Venue** button adds the next stop, arriving now or at an earlier time the user picks. Log past and Edit replace the single Venue field with an editable stop list. Posts show the route on the feed card ("Bar A → Bar B → Bar C"), and post detail and session detail break the night down stop by stop with each stop's drinks. Every existing session becomes a one-stop route, so nothing changes for single-venue nights.

## User Stories

### Live session

1. As someone in a live session, I want a **New Venue** button, so that I can record that I've moved on without losing where I was before.
2. As someone tapping New Venue, I want to type or pick the venue from my past venues, so that adding a stop is as quick as starting a session.
3. As someone who forgot to tap New Venue when I arrived, I want to set an earlier arrival time, so that the drinks I've had since arriving count at the right place.
4. As someone setting an earlier arrival time, I want drinks had after that time to move to the new stop automatically, so that I don't have to reassign them.
5. As someone setting an arrival time, I want it limited to after the previous stop's arrival and no later than now, so that I can't create an impossible route.
6. As someone who tapped New Venue by mistake, I want an Undo on the confirmation toast, so that I can take it back immediately.
7. As someone who accidentally entered the same venue I'm already at, I want New Venue to refuse it, so that I don't create a meaningless stop.
8. As someone who goes back to a place I visited earlier that night, I want to add it again as a new stop, so that the route reflects the night as it happened.
9. As someone who misspelled the current venue, I want tapping the venue name to just rename it, so that fixing a typo doesn't create a new stop.
10. As someone in a live session, I want to see the current venue prominently with the earlier stops as a small trail, so that I can see the night so far at a glance.
11. As someone whose phone is offline when I tap New Venue, I want the stop saved and synced like my drinks are, so that I don't lose it.

### Ending and posting

12. As someone ending a session, I want the end-of-session review to show my route, so that I can check it before posting.
13. As someone who wants to fix stop times, I want to do that in Edit after posting, so that the end-of-session review stays simple.

### Log past and Edit

14. As someone logging a past session, I want to add several venues with arrival times, so that a past night can have a route too.
15. As someone adding a stop to a past session, I want its arrival time to default sensibly (halfway between the previous stop and the end), so that I usually only need to adjust it slightly.
16. As someone editing a session, I want the first stop to always start when the session starts, and to move with Start, so that there's never a gap before the first stop.
17. As someone editing a session, I want to rename or remove any stop, so that I can correct the route.
18. As someone removing the first stop, I want the next stop to become the first and start when the session starts, so that every drink still belongs to a stop.
19. As someone removing a later stop, I want its drinks to fall to the stop before it, so that no drink is left without a venue.
20. As someone editing stop times, I want the stops to stay sorted by arrival time and the drinks to follow, so that the route always reads in order.
21. As someone moving Start or End so that a stop falls outside the session, I want the save blocked with a message naming that stop, so that I never silently lose a venue.
22. As someone whose venue had no drinks (I walked in and left), I want it to stay on the route, so that the route shows everywhere I went.

### Seeing routes

23. As a friend scrolling the feed, I want a post's card to show the whole route, so that I can see where they went that night.
24. As a friend opening a post, I want each stop listed with its arrival time and the drinks had there, so that I can follow the night.
25. As the owner viewing my session detail, I want the same stop-by-stop breakdown, so that my own history tells the full story.
26. As someone viewing an older post from before this change, I want it to show its single venue as before, so that nothing looks broken.
27. As a person with a long route, I want the route to wrap onto more lines instead of being cut off, so that every venue stays visible.

### Venue history

28. As someone typing a venue, I want my suggestions to count every stop as a visit, so that places I usually go on to later in the night are suggested too.
29. As someone typing a venue in New Venue, Log past or Edit, I want the same past-venue suggestions as when starting a session, so that venues are spelled consistently.

### Privacy and safety

30. As a private-account user, I want my stops visible only to people who can already see my sessions, so that the route doesn't leak where I've been.
31. As a user, I want only myself able to add, change or remove my session's stops, so that nobody else can alter my night.

### Rollout

32. As a user on an older version of the app, I want my sessions to keep showing a sensible venue, so that an out-of-date app still works.
33. As a user of the new app before the database change lands, I want sessions to keep working with a single venue, so that the release can't break session loading.

## Success Criteria

1. Every completed or active session in the database has at least one stop, and the first stop's arrival equals the session's start, after the migration runs on a copy of prod data (integration test on the local stack with seeded sessions).
2. A session's `venue` (the single-venue field older app versions read) always equals its first stop's name after any New Venue, rename, removal or edit (store and integration tests).
3. The stops module unit tests cover, and pass for: drink-to-stop assignment at, before and after stop boundaries; inserting a stop at an earlier time; removing the first, a middle and the last stop; default arrival time; rejecting a stop outside Start and End; rejecting a New Venue matching the current stop's venue; allowing a revisit to an earlier venue; the route label for one and several stops.
4. A user who cannot see a session's owner's data cannot read that session's stops, and a user cannot insert, update or delete stops on someone else's session (`npm run test:rls`).
5. With the new table absent (migration not yet applied), the app still loads sessions, the feed and the live session, showing single venues (store test with the table reported missing, plus a manual check against a local DB without the migration).
6. In the running app, a live session with three stops (one added with an earlier arrival time, one revisit) posts a card whose route reads "A → B → A" in order, and whose post detail lists each stop with exactly the drinks timed inside it.
7. Undo after New Venue restores the previous single stop, both on screen and in the database after a reload.
8. In Edit, moving End before a stop's arrival blocks the save with a message naming that stop.
9. Venue suggestions count a venue visited as a second stop: after the session above, B's visit count goes up by 1.
10. Posts created before this change render their single venue unchanged on the feed card, post detail and session detail.
11. `npm run ci` and `npm run lint` pass (no lint errors), and the change has a new top entry in `src/lib/changelog.ts`.
12. Both themes are checked for every changed screen, with only theme tokens used.

## Implementation Decisions

- **Model.** A stop is (session, position, venue name, arrival time). Drinks are not linked to stops in storage; a drink's stop is derived from its time. The first stop's arrival is always the session's start.
- **Storage.** A new `session_venues` table: session reference (cascade on session delete), position, venue name, arrival time, created timestamp. One row per stop. A backfill migration gives each existing session one stop: its venue, arriving at its start.
- **Single-venue compatibility.** `drink_sessions.venue` stays and is kept equal to the first stop's name on every write, so older app versions and anything reading the single venue keep working.
- **Access rules.** `session_venues` read access mirrors drink entries and session photos (visible when the session owner's data is visible, via the existing `can_view_user_data`); insert, update and delete are allowed only to the session's owner.
- **Out-of-order rollout.** The app tolerates the table being absent: a missing-table error from the database latches stops off for the rest of the app session and falls back to the single venue, following the spirit of the existing optional-column mechanism. Stop reads must never take down session loading.
- **Post summary.** The post's `session_summary` JSON gains an optional ordered list of stops (venue, arrival time). Older posts without it fall back to `venue`. The summary is rebuilt whenever stops change, as it already is for start time and drinks.
- **Stops module (pure).** One domain module owns every stop rule: assigning drinks to stops, adding a stop (with arrival validation against the previous stop and now/End), removing a stop (first-stop removal promotes the next stop to the session start), default arrival time for a new stop, validating stops against Start and End, the same-venue guard, and building the route label. All screens and stores call it.
- **Session store.** The live session gains stops alongside drinks: `addStop` (with optional earlier arrival), undoing the last added stop, and renaming the current stop. Writes follow the existing offline-tolerant pattern used for drinks (wait on the session insert, generation guards). Past-session creation and session editing accept a stop list and write it alongside the session.
- **Venue suggestions.** Suggestion stats are built from stops (one visit per stop) instead of one venue per session.
- **UI.**
  - Live session: the current venue shown large, with a small trail of earlier stops; a New Venue button opening a sheet with the venue input, past-venue suggestions and an optional "arrived earlier" time; an Undo toast after adding.
  - Log past / Edit: the Venue field becomes a stop list (first stop tied to Start; Add venue with a time picker defaulting halfway between the last stop and End; rename; remove; sorted by time).
  - Feed card: the route on one wrapping line in place of the venue, in both the photo and photo-less layouts.
  - Post detail and session detail: a per-stop breakdown (venue, arrival time, that stop's drinks).
  - End-of-session review: the route in the stats summary.
- **Google Places (backlog) later.** When it lands, a place is picked per stop and its fields live on `session_venues`, not on `drink_sessions`.

## Testing Decisions

Good tests here check external behaviour: given stops and drinks, which stop each drink falls in; given an action, what the session and database end up holding. They don't assert on internal helper calls or component structure.

**Pre-agreed seams** (confirmed with the user; every later phase tests at these and no others):

1. **The stops module (main seam)**: Vitest unit tests covering every rule in Success Criterion 3. Prior art: `src/lib/session-utils.test.ts`.
2. **The session store**: Vitest with the mocked Supabase client already in `src/stores/use-session-store.test.ts`. Covers New Venue, its Undo and rename on a live session, the writes sent, `venue` kept equal to the first stop, and the missing-table fallback.
3. **The database**: integration tests under `npm run test:rls` against the local stack. Covers `session_venues` access rules for owner, follower, stranger and private accounts, and that the backfill gives each session exactly one stop at its start. Prior art: `tests/integration/rls.test.ts`, `tests/integration/records.test.ts`.
4. **The UI**: checked in the running app against the local stack with seeded users, in both themes; no automated UI tests (the repo has none).

## Boundaries

**Always**
- Use the glossary vocabulary (`CONTEXT.md`) in code, copy and comments: Stop, Route, Venue.
- Add a new entry at the top of `src/lib/changelog.ts`: "Moved bars? Tap New Venue to add it to your session. Posts now show your whole route."
- Pass `npm run ci` and `npm run lint` (no errors) before each commit.
- Use theme tokens only; check both themes.
- Add each new migration to `FILES` in `scripts/test-db-bootstrap.sh`.
- Write any new `.select()` column lists as full literals, run `npm run contract:update`, and read the `db-contract.json` diff (it should only grow).
- Read route params with `useRouteParam`, never `use(params)`.
- Commit on `kashyap-dev` and push it.

**Ask first**
- Applying any migration to prod, or running anything against the prod database.
- Opening or retargeting a pull request.
- Adding a dependency.
- Changing the schema beyond the `session_venues` table and its backfill.
- Deleting or rewriting existing user data.

**Never**
- Run destructive commands against prod, or rewrite git history.
- Delete, skip or weaken a failing test to get to green.
- Hardcode colours (`bg-white/`, `text-zinc-`, inline `rgba`).
- Let a stop read or write failure break session loading, the feed or the live session.

## Out of Scope

- Real places (Google Places), addresses, maps and coordinates: backlog, built on top of stops afterwards.
- Assigning a drink to a stop by hand; drinks follow time only.
- Editing stop times in the end-of-session review (Edit only).
- Reordering stops other than by changing their times.
- Route-based records, leaderboards or recaps.
- Merging consecutive stops at the same venue, or any automatic cleanup of stops.

## Further Notes

- **Order against PR 4 (decided).** Built after PR 4 (full-screen end-session review), so story 12 lands on that review screen.
- **Undo window.** Undo for New Venue lives on the toast; once the toast is gone, the stop can be removed in Edit after posting. No numbers were set for the toast duration; the app's default toast length applies.
- Very long routes simply wrap; no cap on the number of stops was discussed.
