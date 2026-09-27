import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, createUser, deleteAllUsers, type TestUser } from './helpers';
import { formatPrValue } from '@/lib/algorithms/pr-detection';
import type { PRCategory } from '@/types/pr';

// personal_records are recomputed by the database (recompute_personal_records +
// triggers on drink_sessions / drink_entries): a record always belongs to the
// best existing completed session, whatever the app does to sessions.

beforeEach(async () => {
  await deleteAllUsers();
});
afterAll(async () => {
  await deleteAllUsers();
});

interface DrinkSpec {
  def?: string;
  std?: number;
  /** Minutes after the session start. */
  at: number;
}

const BASE = Date.parse('2026-09-01T20:00:00.000Z');
const iso = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString();

/**
 * Insert a session the way the app does (the session row, then its drinks in
 * one bulk insert), as the user, under RLS. `day` offsets the start by whole
 * days so sessions have distinct, ordered end times.
 */
async function addSession(
  user: TestUser,
  opts: { day?: number; minutes?: number; status?: 'active' | 'completed'; drinks?: DrinkSpec[] } = {},
): Promise<string> {
  const start = (opts.day ?? 0) * 24 * 60;
  const minutes = opts.minutes ?? 60;
  const drinks = opts.drinks ?? [];
  const status = opts.status ?? 'completed';
  const { data, error } = await user.client
    .from('drink_sessions')
    .insert({
      user_id: user.id,
      status,
      venue: 'X',
      started_at: iso(start),
      ended_at: status === 'completed' ? iso(start + minutes) : null,
      duration_minutes: status === 'completed' ? minutes : 0,
      total_standard_drinks: drinks.reduce((s, d) => s + (d.std ?? 1), 0),
    })
    .select('id')
    .single();
  if (error) throw new Error(`insert session: ${error.message}`);
  if (drinks.length > 0) {
    const { error: dErr } = await user.client.from('drink_entries').insert(
      drinks.map((d) => ({
        session_id: data.id,
        drink_definition_id: d.def ?? 'beer',
        drink_name: d.def ?? 'Beer',
        emoji: '🍺',
        category: 'beer',
        abv_percent: 5,
        volume_ml: 330,
        standard_drinks: d.std ?? 1,
        timestamp: iso(start + d.at),
      })),
    );
    if (dErr) throw new Error(`insert drinks: ${dErr.message}`);
  }
  return data.id;
}

/** `n` drinks of one type, 10 minutes apart. */
const beers = (n: number): DrinkSpec[] => Array.from({ length: n }, (_, i) => ({ at: i * 10 }));

async function records(user: TestUser) {
  const { data, error } = await adminClient()
    .from('personal_records')
    .select('category, value, formatted_value, previous_value, session_id, achieved_at')
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((r) => [r.category as PRCategory, r]));
}

async function remove(client: SupabaseClient, table: string, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(`delete ${table}: ${error.message}`);
}

describe('personal records follow the best existing session', () => {
  it('a completed session sets records, with the runner-up as previous_value', async () => {
    const u = await createUser();
    await addSession(u, { day: 0, minutes: 90, drinks: beers(3) });
    const best = await addSession(u, { day: 1, minutes: 60, drinks: beers(5) });

    const r = await records(u);
    expect(r.most_drinks_session).toMatchObject({ value: 5, previous_value: 3, session_id: best });
    // achieved_at is when the holder session ended.
    expect(Date.parse(r.most_drinks_session.achieved_at)).toBe(Date.parse(iso(24 * 60 + 60)));
    expect(r.longest_session).toMatchObject({ value: 90, previous_value: 60 });
  });

  it('deleting the holder hands the record to the runner-up, and deleting every session removes it', async () => {
    const u = await createUser();
    const small = await addSession(u, { day: 0, drinks: beers(2) });
    const big = await addSession(u, { day: 1, drinks: beers(4) });
    expect((await records(u)).most_drinks_session.session_id).toBe(big);

    await remove(u.client, 'drink_sessions', big);
    expect((await records(u)).most_drinks_session).toMatchObject({ value: 2, session_id: small, previous_value: null });

    await remove(u.client, 'drink_sessions', small);
    expect(await records(u)).toEqual({});
  });

  it('editing drinks away (delete + re-insert, as the edit screen does) recomputes', async () => {
    const u = await createUser();
    const a = await addSession(u, { day: 0, drinks: beers(3) });
    const b = await addSession(u, { day: 1, drinks: beers(5) });

    // The edit screen replaces all of b's drinks with 2.
    const { error } = await u.client.from('drink_entries').delete().eq('session_id', b);
    expect(error).toBeNull();
    const { error: insErr } = await u.client.from('drink_entries').insert(
      [0, 10].map((at) => ({
        session_id: b, drink_definition_id: 'beer', drink_name: 'Beer', emoji: '🍺', category: 'beer',
        abv_percent: 5, volume_ml: 330, standard_drinks: 1, timestamp: iso(24 * 60 + at),
      })),
    );
    expect(insErr).toBeNull();

    expect((await records(u)).most_drinks_session).toMatchObject({ value: 3, session_id: a, previous_value: 2 });
  });

  it('changing a session’s times recomputes longest_session', async () => {
    const u = await createUser();
    const a = await addSession(u, { day: 0, minutes: 60, drinks: beers(1) });
    const b = await addSession(u, { day: 1, minutes: 120, drinks: beers(1) });
    expect((await records(u)).longest_session.session_id).toBe(b);

    await u.client.from('drink_sessions').update({ duration_minutes: 30, ended_at: iso(24 * 60 + 30) }).eq('id', b);
    expect((await records(u)).longest_session).toMatchObject({ value: 60, session_id: a });
  });

  it('a live session never holds a record, until it is completed', async () => {
    const u = await createUser();
    await addSession(u, { day: 0, drinks: beers(2) });
    const live = await addSession(u, { day: 1, status: 'active', drinks: beers(9) });
    expect((await records(u)).most_drinks_session.value).toBe(2);

    await u.client
      .from('drink_sessions')
      .update({ status: 'completed', ended_at: iso(24 * 60 + 100), duration_minutes: 100 })
      .eq('id', live);
    expect((await records(u)).most_drinks_session).toMatchObject({ value: 9, session_id: live });
  });

  it('ties keep the earlier session', async () => {
    const u = await createUser();
    const first = await addSession(u, { day: 0, drinks: beers(3) });
    await addSession(u, { day: 1, drinks: beers(3) });
    expect((await records(u)).most_drinks_session).toMatchObject({ session_id: first, previous_value: 3 });
  });

  it('fastest_drink: lower wins; single-drink and zero-gap sessions don’t qualify', async () => {
    const u = await createUser();
    await addSession(u, { day: 0, drinks: beers(1) });
    await addSession(u, { day: 1, drinks: [{ at: 0 }, { at: 0 }] });
    const slow = await addSession(u, { day: 2, drinks: [{ at: 0 }, { at: 25 }] });
    expect((await records(u)).fastest_drink).toMatchObject({ value: 25, session_id: slow, previous_value: null });

    const fast = await addSession(u, { day: 3, drinks: [{ at: 0 }, { at: 30 }, { at: 37 }] });
    expect((await records(u)).fastest_drink).toMatchObject({ value: 7, session_id: fast, previous_value: 25 });
  });

  it('counts distinct drink types and sums standard drinks from the drinks themselves', async () => {
    const u = await createUser();
    await addSession(u, {
      drinks: [{ def: 'beer', std: 1.5, at: 0 }, { def: 'wine', std: 1.25, at: 20 }, { def: 'beer', std: 1.5, at: 40 }],
    });
    const r = await records(u);
    expect(r.most_unique_drinks.value).toBe(2);
    expect(r.most_standard_drinks.value).toBeCloseTo(4.25);
  });

  it('formatted_value matches the app’s formatPrValue for every category', async () => {
    const u = await createUser();
    await addSession(u, {
      minutes: 135,
      drinks: [{ def: 'beer', std: 1.4, at: 0 }, { def: 'wine', std: 1.2, at: 12 }, { def: 'gin', std: 1, at: 50 }],
    });
    const r = await records(u);
    const categories: PRCategory[] = ['most_drinks_session', 'most_standard_drinks', 'longest_session', 'most_unique_drinks', 'fastest_drink'];
    for (const c of categories) {
      expect(r[c], c).toBeDefined();
      expect(r[c].formatted_value, c).toBe(formatPrValue(c, r[c].value));
    }
  });

  it('users can’t call the recompute function directly', async () => {
    const u = await createUser();
    const { error } = await u.client.rpc('recompute_personal_records', { p_user_id: u.id });
    expect(error).not.toBeNull();
  });
});
