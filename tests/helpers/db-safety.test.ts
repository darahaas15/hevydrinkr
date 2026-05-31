import { describe, it, expect } from 'vitest';
import { assertLocalSupabase } from './db-safety';

describe('assertLocalSupabase (the DB-safety lynchpin)', () => {
  it('allows localhost and 127.0.0.1 and returns the url', () => {
    expect(assertLocalSupabase('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321');
    expect(assertLocalSupabase('http://localhost:54321')).toBe('http://localhost:54321');
  });

  it('throws when the url is unset', () => {
    expect(() => assertLocalSupabase(undefined)).toThrow(/unset/);
  });

  it('hard-blocks the production project ref by name', () => {
    expect(() => assertLocalSupabase('https://ufflclpzywaxxshicwtm.supabase.co')).toThrow(/PRODUCTION/);
  });

  it('refuses any non-local host', () => {
    expect(() => assertLocalSupabase('https://some-other-project.supabase.co')).toThrow(/not local/);
  });

  it('rejects a malformed url', () => {
    expect(() => assertLocalSupabase('not a url')).toThrow(/valid URL/);
  });
});
