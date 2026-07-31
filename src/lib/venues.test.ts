import { describe, it, expect } from 'vitest';
import {
  normalizeVenue,
  venueKey,
  buildVenueStats,
  suggestVenues,
  canonicalizeVenue,
} from './venues';

const session = (venue: string, startedAt: string, drinks = 1) => ({
  venue,
  startedAt,
  drinks: Array.from({ length: drinks }, (_, i) => i),
});

describe('normalizeVenue', () => {
  it('trims and collapses whitespace but preserves casing', () => {
    expect(normalizeVenue('  Toit   Bangalore ')).toBe('Toit Bangalore');
  });

  it('handles an empty string', () => {
    expect(normalizeVenue('   ')).toBe('');
  });
});

describe('venueKey', () => {
  it('is case- and punctuation-insensitive', () => {
    expect(venueKey('Toit')).toBe(venueKey('  toit '));
    expect(venueKey("O'Malley's")).toBe(venueKey('omalleys'));
  });

  it('collapses spacing differences', () => {
    expect(venueKey('The Pub')).toBe(venueKey('thepub'));
  });
});

describe('buildVenueStats', () => {
  it('merges spellings of the same venue and counts visits + drinks', () => {
    const stats = buildVenueStats([
      session('toit', '2026-03-01T20:00:00.000Z', 3),
      session('Toit', '2026-03-08T20:00:00.000Z', 2),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0].visits).toBe(2);
    expect(stats[0].totalDrinks).toBe(5);
  });

  it('displays the spelling from the most recent visit', () => {
    const stats = buildVenueStats([
      session('TOIT', '2026-03-08T20:00:00.000Z'),
      session('toit', '2026-03-01T20:00:00.000Z'),
    ]);
    expect(stats[0].name).toBe('TOIT');
  });

  it('is order-independent when picking the display spelling', () => {
    const ascending = buildVenueStats([
      session('toit', '2026-03-01T20:00:00.000Z'),
      session('TOIT', '2026-03-08T20:00:00.000Z'),
    ]);
    expect(ascending[0].name).toBe('TOIT');
  });

  it('skips blank venues instead of bucketing them', () => {
    const stats = buildVenueStats([
      session('   ', '2026-03-01T20:00:00.000Z'),
      session('Toit', '2026-03-02T20:00:00.000Z'),
    ]);
    expect(stats.map((s) => s.name)).toEqual(['Toit']);
  });

  it('sorts most-recent first', () => {
    const stats = buildVenueStats([
      session('Old Bar', '2026-01-01T20:00:00.000Z'),
      session('New Bar', '2026-03-01T20:00:00.000Z'),
    ]);
    expect(stats.map((s) => s.name)).toEqual(['New Bar', 'Old Bar']);
  });
});

describe('suggestVenues', () => {
  const stats = buildVenueStats([
    session('Toit', '2026-03-08T20:00:00.000Z'),
    session('The Permit Room', '2026-03-05T20:00:00.000Z'),
    session('Arbor Brewing', '2026-03-01T20:00:00.000Z'),
  ]);

  it('returns recent venues for an empty query', () => {
    expect(suggestVenues(stats, '').map((v) => v.name)).toEqual([
      'Toit',
      'The Permit Room',
      'Arbor Brewing',
    ]);
  });

  it('matches case-insensitive substrings', () => {
    expect(suggestVenues(stats, 'brew').map((v) => v.name)).toEqual(['Arbor Brewing']);
  });

  it('ranks prefix matches above mid-string matches', () => {
    const withBoth = buildVenueStats([
      session('Arbor Brewing', '2026-03-01T20:00:00.000Z'),
      session('The Arbor', '2026-03-08T20:00:00.000Z'),
    ]);
    expect(suggestVenues(withBoth, 'arbor').map((v) => v.name)).toEqual([
      'Arbor Brewing',
      'The Arbor',
    ]);
  });

  it('omits an exact match so it does not suggest what is already typed', () => {
    expect(suggestVenues(stats, 'Toit')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(suggestVenues(stats, '', 2)).toHaveLength(2);
  });
});

describe('canonicalizeVenue', () => {
  const stats = buildVenueStats([session('Toit', '2026-03-08T20:00:00.000Z')]);

  it('snaps a variant spelling onto the known one', () => {
    expect(canonicalizeVenue('  toit ', stats)).toBe('Toit');
  });

  it('passes unknown venues through normalized', () => {
    expect(canonicalizeVenue('  New   Place ', stats)).toBe('New Place');
  });

  it('handles an empty input', () => {
    expect(canonicalizeVenue('   ', stats)).toBe('');
  });
});
