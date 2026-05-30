import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { extractDbContract, type SourceFile } from './extract-db-contract';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(here, '..', '..');
const srcDir = join(repoRoot, 'src');
const snapshotPath = join(here, 'db-contract.json');

function collectSources(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\./.test(name)) continue;
    const path = join(entry.parentPath ?? (entry as { path: string }).path, name);
    out.push({ path, content: readFileSync(path, 'utf8') });
  }
  return out;
}

describe('frontend ↔ Supabase contract', () => {
  const contract = extractDbContract(collectSources(srcDir));

  it('matches the committed contract snapshot', () => {
    // `npm run contract:update` regenerates this file after an intentional
    // change to the app's DB usage; the diff is the per-push review signal.
    if (process.env.UPDATE_CONTRACT) {
      writeFileSync(snapshotPath, JSON.stringify(contract, null, 2) + '\n');
    }
    const expected = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    expect(contract).toEqual(expected);
  });

  it('references a non-trivial, sorted set of tables', () => {
    expect(contract.tables.length).toBeGreaterThan(10);
    expect(contract.tables).toEqual([...contract.tables].sort());
  });
});
