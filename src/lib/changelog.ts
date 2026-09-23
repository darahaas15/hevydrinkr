export interface ChangelogEntry {
  /** Version this entry ships in, e.g. '1.13.0'. Unique per entry — it's both
   *  the dedup key for the "seen" banner and the version shown in Settings. */
  version: string;
  /** Short headline shown at the top of the entry. */
  title: string;
  /** Human-readable date, e.g. 'May 2026'. */
  date: string;
  /** Bulleted list of what changed. */
  changes: string[];
}

/**
 * Changelog entries, NEWEST FIRST. Single source of truth for both the
 * Settings "Version" label and the in-app changelog.
 *
 * To announce new changes to users:
 *   1. Add a new entry at the TOP of this array with a fresh, higher `version`.
 *   2. Deploy.
 * Everyone who hasn't already seen that `version` gets a one-time banner on
 * their next app open. Opening it (or dismissing it) marks it seen so it never
 * shows again — until you add another entry with a newer version. Add no entry
 * and the banner stays hidden.
 *
 * Intentionally bundled client-side (no DB / network) so it costs zero egress.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.14.1',
    title: 'Links that go where they should',
    date: 'September 2026',
    changes: [
      'Group invite links join the group again instead of saying the code is invalid.',
      'Links to a post, group or session open that page directly, including after a refresh.',
      'The session timer no longer shows a negative time when your devices disagree on the clock.',
      'First-time visitors no longer see a "new version available" banner.',
      'Weekly roast lines read correctly, and the week picker only appears once there is more than one week.',
    ],
  },
  {
    version: '1.14.0',
    title: 'Log faster, track what you spend',
    date: 'July 2026',
    changes: [
      'Quick add: your recent and starred drinks are one tap away, right on the session screen.',
      'Star any drink in the picker to pin it to the top of your list.',
      'Log another of your last drink straight from the session bar, without leaving the page.',
      'Add a price to a drink once and it is remembered — see what a night cost you, plus new Total Spent stats and a Spend leaderboard.',
      'Pick your currency in Settings.',
      'End a session without posting it — it stays in your history and you can share it to the feed later.',
      'Venue suggestions from the places you have been, so the same bar stops showing up three different ways.',
      'Your most-visited venues now appear on your profile.',
    ],
  },
  {
    version: '1.13.0',
    title: 'Tag your crew',
    date: 'May 2026',
    changes: [
      'Tag people you follow when you post a session — right from the post screen or when editing.',
      'Tagged friends get a notification, and everyone can see who was there on the post.',
      'New "Tags" toggle in notification settings to control these alerts.',
    ],
  },
  {
    version: '1.12.0',
    title: 'Faster & lighter',
    date: 'May 2026',
    changes: [
      'Photos now load much faster and use far less data.',
      'Smoother background refreshing across the feed and leaderboard.',
    ],
  },
];

/** The most recent entry, or null if the changelog is empty. */
export const LATEST_CHANGELOG: ChangelogEntry | null = CHANGELOG[0] ?? null;

/** Current app version, shown in Settings — driven by the latest changelog entry. */
export const APP_VERSION = LATEST_CHANGELOG?.version ?? '1.12.0';
