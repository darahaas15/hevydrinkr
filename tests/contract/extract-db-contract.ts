/**
 * Frontend → Supabase contract extractor.
 *
 * Statically scans the app source for the database surface it depends on:
 *   - tables referenced via `.from('<table>')`
 *   - RPC functions called via `.rpc('<fn>')`
 *   - the column tokens selected via a `.from(...).select('...')` chain
 *
 * The result is snapshot-locked (see db-contract.test.ts) so that any push
 * which changes what the app reads from or writes to the DB shows up as an
 * explicit, reviewable contract diff. It is intentionally heuristic and stable
 * rather than a full TS parse — `selectedColumns` may include embedded relation
 * names (e.g. `feed_likes` from `feed_items.select('..., feed_likes(*)')`),
 * which is fine: we care about *change detection*, not perfect column typing.
 *
 * Layer 3 (local-DB contract/RLS tests) consumes this same contract to verify
 * each table/column/RPC actually exists and that RLS behaves.
 */

export interface DbContract {
  tables: string[];
  rpcs: string[];
  selectedColumns: Record<string, string[]>;
}

export interface SourceFile {
  path: string;
  content: string;
}

const FROM_RE = /\.from\(\s*'([a-z_]+)'\s*\)/g;
const RPC_RE = /\.rpc\(\s*'([a-z_]+)'/g;
// `.from('x') ... .select('a, b, c')` within the same call chain (non-greedy,
// bounded so it can't leap to an unrelated query).
const FROM_SELECT_RE = /\.from\(\s*'([a-z_]+)'\s*\)[\s\S]{0,600}?\.select\(\s*'([^']*)'/g;

function tokenizeColumns(selectArg: string): string[] {
  return selectArg
    .split(',')
    .map((c) => c.trim().split('(')[0].trim()) // drop embedded-resource parens
    .map((c) => c.split(':').pop()!.trim()) // drop `alias:` renames, keep the column
    .map((c) => c.replace(/[()]/g, '').trim()) // strip stray parens from nested selects
    .filter((c) => c.length > 0);
}

export function extractDbContract(sources: SourceFile[]): DbContract {
  const tables = new Set<string>();
  const rpcs = new Set<string>();
  const cols: Record<string, Set<string>> = {};

  for (const { content } of sources) {
    for (const m of content.matchAll(FROM_RE)) tables.add(m[1]);
    for (const m of content.matchAll(RPC_RE)) rpcs.add(m[1]);
    for (const m of content.matchAll(FROM_SELECT_RE)) {
      const table = m[1];
      cols[table] ??= new Set();
      for (const c of tokenizeColumns(m[2])) cols[table].add(c);
    }
  }

  const selectedColumns: Record<string, string[]> = {};
  for (const table of Object.keys(cols).sort()) {
    selectedColumns[table] = [...cols[table]].sort();
  }

  return {
    tables: [...tables].sort(),
    rpcs: [...rpcs].sort(),
    selectedColumns,
  };
}
