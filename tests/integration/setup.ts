import { assertLocalSupabase } from '../helpers/db-safety';

// First line of defense, before any test or client is created: refuse to run
// the integration suite unless it targets a local Supabase. Throwing here aborts
// the whole run rather than letting a misconfigured .env.test reach a database.
assertLocalSupabase();
