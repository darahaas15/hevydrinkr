import { describe, it, expect, vi, afterEach } from 'vitest';
import { optionalColumn } from './optional-columns';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('optionalColumn', () => {
  it('starts optimistic', () => {
    expect(optionalColumn('cost').isSupported()).toBe(true);
  });

  it('latches off on a Postgres 42703 that names the column', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const col = optionalColumn('cost');
    const disabled = col.disableIfMissing({
      code: '42703',
      message: 'column drink_entries.cost does not exist',
    });
    expect(disabled).toBe(true);
    expect(col.isSupported()).toBe(false);
  });

  it('latches off on a PostgREST schema-cache miss', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const col = optionalColumn('cost');
    expect(
      col.disableIfMissing({
        code: 'PGRST204',
        message: "Could not find the 'cost' column of 'drink_entries' in the schema cache",
      }),
    ).toBe(true);
    expect(col.isSupported()).toBe(false);
  });

  it('ignores unrelated errors so real failures still surface', () => {
    const col = optionalColumn('cost');
    expect(col.disableIfMissing({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(col.disableIfMissing({ message: 'Failed to fetch' })).toBe(false);
    expect(col.disableIfMissing(null)).toBe(false);
    expect(col.isSupported()).toBe(true);
  });

  it('does not latch off when 42703 names a different column', () => {
    const col = optionalColumn('cost');
    expect(
      col.disableIfMissing({ code: '42703', message: 'column drink_entries.tip does not exist' }),
    ).toBe(false);
    expect(col.isSupported()).toBe(true);
  });

  it('only reports the transition once so callers cannot retry-loop', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const col = optionalColumn('cost');
    const err = { code: '42703', message: 'column drink_entries.cost does not exist' };
    expect(col.disableIfMissing(err)).toBe(true);
    expect(col.disableIfMissing(err)).toBe(false);
  });
});
