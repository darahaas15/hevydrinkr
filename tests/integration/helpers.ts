import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLocalSupabase } from '../helpers/db-safety';

// All clients target the local stack only (assertLocalSupabase throws otherwise).
const url = assertLocalSupabase();
const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `[integration] missing env ${key}. Load .env.test from a running local stack ` +
        `(see tests/integration/README.md).`,
    );
  }
  return v;
}

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } } as const;

/** Service-role client — bypasses RLS. Use for setup, introspection, assertions. */
export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, noPersist);
}

export interface TestUser {
  id: string;
  email: string;
  username: string;
  /** anon-key client authenticated AS this user — subject to RLS. */
  client: SupabaseClient;
}

let seq = 0;

/**
 * Create a confirmed auth user (the `handle_new_user` trigger populates
 * `profiles` from user_metadata), optionally private, and return a client
 * signed in as them.
 */
export async function createUser(
  opts: { isPrivate?: boolean; displayName?: string; gender?: string } = {},
): Promise<TestUser> {
  const admin = adminClient();
  const username = `u${++seq}_${Math.floor(Math.random() * 1_000_000)}`;
  const email = `${username}@example.test`;
  const password = 'test-password-123';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: opts.displayName ?? username, gender: opts.gender ?? 'other' },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? 'no user'}`);
  const id = data.user.id;

  if (opts.isPrivate) {
    const { error: upErr } = await admin.from('profiles').update({ is_private: true }).eq('id', id);
    if (upErr) throw new Error(`set is_private failed: ${upErr.message}`);
  }

  const client = createClient(url, anonKey, noPersist);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { id, email, username, client };
}

/** Wipe all auth users between tests; FK cascades clear profiles + owned rows. */
export async function deleteAllUsers(): Promise<void> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  for (const u of data.users) {
    await admin.auth.admin.deleteUser(u.id);
  }
}
