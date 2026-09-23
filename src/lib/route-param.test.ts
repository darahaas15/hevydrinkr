import { describe, it, expect } from 'vitest';
import { resolveRouteParam } from './route-param';

describe('resolveRouteParam', () => {
  it('uses a real param as-is (dev server, or a prerendered id)', () => {
    expect(resolveRouteParam('abc-123', '/feed/abc-123')).toBe('abc-123');
  });

  it('reads the URL when the static export hands back its `_` placeholder', () => {
    expect(resolveRouteParam('_', '/feed/abc-123')).toBe('abc-123');
    expect(resolveRouteParam('_', '/invite/FNC247')).toBe('FNC247');
  });

  it('takes the second path segment for nested routes', () => {
    expect(resolveRouteParam('_', '/groups/g-1/party')).toBe('g-1');
  });

  it('falls back to the URL when there is no param at all', () => {
    expect(resolveRouteParam(undefined, '/session/s-9')).toBe('s-9');
  });

  it('decodes an encoded segment', () => {
    expect(resolveRouteParam('_', '/invite/a%20b')).toBe('a b');
  });

  it('returns an empty string when neither source has a value', () => {
    expect(resolveRouteParam('_', '/feed')).toBe('');
    expect(resolveRouteParam(undefined, null)).toBe('');
  });
});
