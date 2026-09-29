// Type-level guard that every native replacement in metro.config.js exports
// the same API as the web module it stands in for. Shared code is type-checked
// against the web signatures, so a web change the native side doesn't match
// fails `npm run typecheck` here instead of breaking at runtime.
//
// The web modules are imported by relative path because only the bundler
// swaps them; to TypeScript `@/lib/...` is always the web file.

import type * as WebSupabase from '../../../src/lib/supabase/client';
import type * as WebHaptics from '../../../src/lib/haptics';
import type * as WebShare from '../../../src/lib/share';
import type * as NativeSupabase from './supabase-client';
import type * as NativeHaptics from './haptics';
import type * as NativeShare from './share';

type Replaces<Native extends Web, Web> = Native;

export type NativeReplacements = [
  Replaces<typeof NativeSupabase, typeof WebSupabase>,
  Replaces<typeof NativeHaptics, typeof WebHaptics>,
  Replaces<typeof NativeShare, typeof WebShare>,
];
