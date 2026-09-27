#!/usr/bin/env node
/**
 * Seed login-able test users into the LOCAL Supabase stack, plus a small social
 * graph (follows, a private account with a pending request, a shared group) so
 * the feed, requests and group screens have something to show.
 *
 * Idempotent: users that already exist are reused, and edges are upserted.
 * Reads keys from .env.test (see tests/integration/README.md). Refuses to run
 * against anything but localhost.
 *
 *   npm run db:seed-users
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.test')) {
  for (const line of readFileSync('.env.test', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('[seed] missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (write .env.test first)');
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error(`[seed] REFUSING: ${url} is not a local Supabase`);
  process.exit(1);
}

const PASSWORD = 'password123';
const USERS = [
  { username: 'alice', displayName: 'Alice', gender: 'female', weightKg: 60 },
  { username: 'bob', displayName: 'Bob', gender: 'male', weightKg: 80 },
  { username: 'charlie', displayName: 'Charlie', gender: 'male', weightKg: 75 },
  { username: 'dana', displayName: 'Dana', gender: 'female', weightKg: 65, isPrivate: true },
];

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureUser(u) {
  const email = `${u.username}@test.local`;
  const { data: existing } = await admin.from('profiles').select('id').eq('username', u.username).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    // handle_new_user builds the profile from this and rejects anyone under 18.
    user_metadata: {
      username: u.username,
      display_name: u.displayName,
      gender: u.gender,
      weight_kg: u.weightKg,
      date_of_birth: '1995-06-15',
    },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  if (u.isPrivate) {
    const { error: e } = await admin.from('profiles').update({ is_private: true }).eq('id', data.user.id);
    if (e) throw new Error(`make ${u.username} private: ${e.message}`);
  }
  return data.user.id;
}

function check(label, { error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

const id = {};
for (const u of USERS) id[u.username] = await ensureUser(u);

// Follows. The service role skips the private-account INSERT policy, so
// bob -> dana stands in for an already-accepted request.
const follows = [
  ['alice', 'bob'], ['bob', 'alice'],
  ['alice', 'charlie'], ['charlie', 'alice'],
  ['bob', 'charlie'],
  ['bob', 'dana'],
];
check('follows', await admin.from('follows').upsert(
  follows.map(([a, b]) => ({ follower_id: id[a], following_id: id[b] })),
  { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
));

// A pending request so dana's Requests screen isn't empty.
const { data: pending } = await admin.from('follow_requests').select('id')
  .eq('requester_id', id.charlie).eq('target_id', id.dana).maybeSingle();
if (!pending) {
  check('follow_requests', await admin.from('follow_requests').insert({ requester_id: id.charlie, target_id: id.dana }));
}

// One group with alice as creator.
let { data: group } = await admin.from('groups').select('id, invite_code').eq('name', 'Friday Crew').maybeSingle();
if (!group) {
  const res = await admin.from('groups')
    .insert({ name: 'Friday Crew', emoji: '🍻', description: 'Local test group', created_by: id.alice, invite_code: 'FRIDAY01' })
    .select('id, invite_code').single();
  check('groups', res);
  group = res.data;
}
check('group_members', await admin.from('group_members').upsert(
  [['alice', 'admin'], ['bob', 'member'], ['charlie', 'member']].map(([u, role]) => ({ group_id: group.id, user_id: id[u], role })),
  { onConflict: 'group_id,user_id', ignoreDuplicates: true },
));

console.log(`[seed] done. Log in with any of these (password: ${PASSWORD}):`);
for (const u of USERS) console.log(`  ${u.username}@test.local${u.isPrivate ? '  (private)' : ''}`);
console.log(`[seed] group "Friday Crew" (alice, bob, charlie), invite code ${group.invite_code}`);
