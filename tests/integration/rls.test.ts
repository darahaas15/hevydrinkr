import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { adminClient, createUser, deleteAllUsers } from './helpers';

// RLS policy matrix — the security contract. Each test signs in as real users
// (anon key + JWT, subject to RLS) and asserts allow/deny. Note PostgREST
// semantics: a denied UPDATE/DELETE silently affects 0 rows (no error), so we
// verify by reading back as the service role; a denied INSERT returns an error.

beforeEach(async () => {
  await deleteAllUsers();
});
afterAll(async () => {
  await deleteAllUsers();
});

describe('profiles', () => {
  it('a user cannot update another user’s profile', async () => {
    const a = await createUser({ displayName: 'Alice' });
    const b = await createUser();
    await b.client.from('profiles').update({ display_name: 'hacked' }).eq('id', a.id);
    const { data } = await adminClient().from('profiles').select('display_name').eq('id', a.id).single();
    expect(data?.display_name).toBe('Alice');
  });
});

describe('private accounts & follows (can_view_user_data)', () => {
  it('a non-follower cannot see a private user’s follow edges, but a follower can', async () => {
    const priv = await createUser({ isPrivate: true });
    const follower = await createUser();
    const stranger = await createUser();

    const { error: followErr } = await follower.client
      .from('follows')
      .insert({ follower_id: follower.id, following_id: priv.id });
    expect(followErr).toBeNull();

    const seenByFollower = await follower.client.from('follows').select('*').eq('following_id', priv.id);
    expect(seenByFollower.data?.length).toBe(1);

    const seenByStranger = await stranger.client.from('follows').select('*').eq('following_id', priv.id);
    expect(seenByStranger.data?.length ?? 0).toBe(0);
  });
});

describe('ownership on sessions / drinks / feed', () => {
  it('a user cannot insert a drink into someone else’s session', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { data: session, error } = await owner.client
      .from('drink_sessions')
      .insert({ user_id: owner.id, status: 'active', venue: 'X' })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { error: insErr } = await other.client.from('drink_entries').insert({
      session_id: session!.id,
      drink_definition_id: 'd',
      drink_name: 'Beer',
      emoji: '🍺',
      category: 'beer',
      abv_percent: 5,
      volume_ml: 355,
      standard_drinks: 1,
    });
    expect(insErr).not.toBeNull(); // WITH CHECK (owns parent session) blocks it
  });

  it('a user cannot delete another user’s feed item', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { data: sess } = await owner.client
      .from('drink_sessions')
      .insert({ user_id: owner.id, status: 'completed', venue: 'X' })
      .select('id')
      .single();
    const { data: feed } = await owner.client
      .from('feed_items')
      .insert({ user_id: owner.id, session_id: sess!.id, session_summary: {} })
      .select('id')
      .single();

    await other.client.from('feed_items').delete().eq('id', feed!.id);
    const { data } = await adminClient().from('feed_items').select('id').eq('id', feed!.id);
    expect(data?.length).toBe(1); // still there — delete was a no-op under RLS
  });
});

describe('blocked_users is private to the blocker', () => {
  it('a user cannot read another user’s block list', async () => {
    const a = await createUser();
    const b = await createUser();
    await a.client.from('blocked_users').insert({ blocker_id: a.id, blocked_id: b.id });

    const seenByB = await b.client.from('blocked_users').select('*');
    expect(seenByB.data?.length ?? 0).toBe(0);

    const seenByA = await a.client.from('blocked_users').select('*');
    expect(seenByA.data?.length).toBe(1);
  });
});

describe('KNOWN GAP — blocking is not enforced at the DB layer', () => {
  // feed_items SELECT is `USING (true)`, so a blocked user can still read posts
  // directly; blocking is client-side only. This test PINS the current behavior.
  // If feed RLS is tightened to respect blocks, flip the expectation.
  it('a blocked user can still read the blocker-author’s posts (documents the gap)', async () => {
    const author = await createUser();
    const blocker = await createUser();
    const { data: sess } = await author.client
      .from('drink_sessions')
      .insert({ user_id: author.id, status: 'completed', venue: 'X' })
      .select('id')
      .single();
    await author.client.from('feed_items').insert({ user_id: author.id, session_id: sess!.id, session_summary: {} });
    await blocker.client.from('blocked_users').insert({ blocker_id: blocker.id, blocked_id: author.id });

    const { data } = await blocker.client.from('feed_items').select('id').eq('user_id', author.id);
    expect((data?.length ?? 0)).toBeGreaterThan(0);
  });
});
