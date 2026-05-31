import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { readFileSync, existsSync } from 'node:fs';

// Layer 3 — local-Supabase contract + RLS suite. Runs ONLY against a local
// stack (`supabase start`), loaded from .env.test. The db-safety guard in
// tests/helpers/db-safety.ts hard-fails if this ever points at prod.
process.env.TZ = 'UTC';

const env: Record<string, string> = {};
if (existsSync('.env.test')) {
  for (const line of readFileSync('.env.test', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/integration/**/*.{test,spec}.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    env,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Single shared DB — run files serially to avoid cross-file data races.
    fileParallelism: false,
  },
});
