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
