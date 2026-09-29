import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Native replacement for the web app's src/lib/supabase/client.ts (swapped in
// by metro.config.js). Same project and realtime tuning; the differences are
// what a native app needs.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The SQLite-backed localStorage installed by polyfills.ts.
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // No URL to read a session from; auth links open the web app instead.
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
    heartbeatIntervalMs: 15000,
    timeout: 20000,
  },
});

// Timers don't run while an iOS app is suspended, so refresh the session only
// while the app is in the foreground, and immediately on returning to it.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
