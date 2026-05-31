/**
 * DB safety guard for integration / contract / RLS tests.
 *
 * This app has ONE Supabase database — production — and no staging. There is no
 * acceptable failure mode where a test connects to it. Any test that talks to a
 * real Supabase instance must call assertLocalSupabase() in its setup; it hard
 * fails unless the target is an explicitly local instance.
 *
 * The linked prod project ref is hard-blocked by name as a second line of
 * defense, so even a misconfigured .env.test that happens to use 127.0.0.1 in
 * the URL but the prod ref elsewhere cannot slip through.
 */

const PROD_PROJECT_REF = 'ufflclpzywaxxshicwtm';

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

export function assertLocalSupabase(url = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!url) {
    throw new Error(
      '[db-safety] NEXT_PUBLIC_SUPABASE_URL is unset. Integration tests must point at a ' +
        'LOCAL Supabase (run `supabase start`, then load .env.test). Refusing to run.',
    );
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`[db-safety] NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
  }

  if (url.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `[db-safety] Refusing to run: target points at the PRODUCTION project (${PROD_PROJECT_REF}). ` +
        'Tests may only run against a local Supabase instance.',
    );
  }

  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `[db-safety] Refusing to run: Supabase host "${host}" is not local. ` +
        `Expected one of ${LOCAL_HOSTS.join(', ')}. Start a local DB with \`supabase start\`.`,
    );
  }

  return url;
}
