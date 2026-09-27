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

    // Following a private account goes through request -> accept; the accept
    // trigger inserts the follows row.
    const { error: requestErr } = await follower.client
      .from('follow_requests')
      .insert({ requester_id: follower.id, target_id: priv.id });
    expect(requestErr).toBeNull();
    const { error: acceptErr } = await priv.client
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('requester_id', follower.id);
    expect(acceptErr).toBeNull();

    const seenByFollower = await follower.client.from('follows').select('*').eq('following_id', priv.id);
    expect(seenByFollower.data?.length).toBe(1);

    const seenByStranger = await stranger.client.from('follows').select('*').eq('following_id', priv.id);
    expect(seenByStranger.data?.length ?? 0).toBe(0);
  });

  it('a user cannot follow a private account directly, skipping the request', async () => {
    const priv = await createUser({ isPrivate: true });
    const stranger = await createUser();
    const { error } = await stranger.client
      .from('follows')
      .insert({ follower_id: stranger.id, following_id: priv.id });
    expect(error).not.toBeNull();
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

describe('blocking is enforced at the DB layer', () => {
  // 20260425_launch_readiness (section 6) makes feed_items SELECT respect
  // blocked_users, so a blocker no longer sees the blocked user's posts.
  it('a blocker cannot read the blocked author’s posts', async () => {
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
    expect(data?.length ?? 0).toBe(0);
    // Guard against a vacuous pass: the post does exist.
    const { data: all } = await adminClient().from('feed_items').select('id').eq('user_id', author.id);
    expect(all?.length).toBe(1);
  });
});
