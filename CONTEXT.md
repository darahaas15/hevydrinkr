# hevydrinkr

A social drink tracker: people log a night out as it happens (or afterwards), and share it with friends as a post.

## Language

### Nights out

**Session**:
One night of drinking by one person, from start to end. It is **active** while it is happening and **completed** once ended.
_Avoid_: night, outing, event

**Past session**:
A session logged after the fact, with its start, end and drinks entered by hand.
_Avoid_: backfill, manual session

**Drink**:
One drink had during a session, at a point in time.
_Avoid_: entry, item

**Venue**:
A named place where people drink: a bar, a restaurant, someone's house.
_Avoid_: location, place, spot

**Stop**:
One visit to a venue during a session, from its arrival time until the next stop's arrival (or the session's end). The first stop begins when the session starts. A drink belongs to the stop that was underway when it was had; a stop may have no drinks and is still part of the route.
_Avoid_: leg, hop, venue (when meaning the visit rather than the place)

**Route**:
A session's stops in arrival order, shown as "Bar A → Bar B → Bar C". A session at a single venue has a one-stop route.
_Avoid_: itinerary, crawl

### Sharing

**Post**:
A completed session as it appears in the feed, with its caption, tagged people, photos, likes and comments. Every completed session has exactly one post, and a post always has its session: deleting either deletes both.
_Avoid_: feed item, share

**Discard**:
Throwing away an active session. The only way to end a session without it becoming a post.
_Avoid_: cancel, abandon, save without posting

### Achievements

**Record**:
A user's personal best in one category (most drinks, longest session, and so on), always held by one of their completed sessions.
_Avoid_: PR, personal record (in UI copy), achievement
