import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Pin the timezone so date-sensitive logic (streaks, leaderboard windows,
// datetime-local round-trips) is identical on every machine and in CI.
process.env.TZ = 'UTC';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Unit tests are pure logic — Node is enough and fast. Component/DOM tests
    // can opt into jsdom per-file with a `// @vitest-environment jsdom` pragma.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html', 'json-summary'],
      // The domain layer is the part worth holding a coverage line on.
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/data/**', 'src/**/*.test.ts'],
    },
  },
});
