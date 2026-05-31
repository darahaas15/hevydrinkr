import { describe, it, expect } from 'vitest';
import { getAwardMeta, pickRoastLine } from './roast-copy';
import type { AwardType } from '@/types/roast';

function substitute(tpl: string, vars: Record<string, string>): string {
  let line = tpl;
  for (const [k, v] of Object.entries(vars)) line = line.replaceAll(`{${k}}`, v);
  return line;
}

describe('getAwardMeta', () => {
  it('returns the title, emoji, and lines for an award', () => {
    const meta = getAwardMeta('freight_train');
    expect(meta.title).toBe('Freight Train');
    expect(meta.emoji).toBe('🚂');
    expect(meta.lines.length).toBeGreaterThan(0);
  });
});

describe('pickRoastLine', () => {
  it('is deterministic for the same seed', () => {
    const vars = { name: 'Bob', stat: '12' };
    const a = pickRoastLine('freight_train', vars, 'W11:bob:freight_train');
    const b = pickRoastLine('freight_train', vars, 'W11:bob:freight_train');
    expect(a).toBe(b);
  });

  it('substitutes every placeholder, including repeated ones', () => {
    const vars = { name: 'Bob', drink: 'Negroni', stat: '7' };
    const line = pickRoastLine('one_trick_pony', vars, 'seed-1');
    expect(line).toContain('Bob');
    expect(line).toContain('Negroni');
    expect(line).not.toMatch(/\{\w+\}/); // no leftover placeholders
  });

  it('returns one of the award’s templates with vars applied', () => {
    const type: AwardType = 'mixologist';
    const vars = { name: 'Bob', stat: '9' };
    const expected = getAwardMeta(type).lines.map((t) => substitute(t, vars));
    expect(expected).toContain(pickRoastLine(type, vars, 'any-seed'));
  });

  it('still returns a valid template line when no seed is given', () => {
    const type: AwardType = 'ghost';
    const vars = { name: 'Bob' };
    const expected = getAwardMeta(type).lines.map((t) => substitute(t, vars));
    expect(expected).toContain(pickRoastLine(type, vars));
  });
});
