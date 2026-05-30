import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { adminClient } from './helpers';

// Verify, against the LIVE local schema, that everything the frontend contract
// (tests/contract/db-contract.json — produced by Layer 2) depends on actually
// exists. This is the column-level half Layer 2 can't check statically.
//
// Introspection uses the service-role PostgREST client (no extra deps): a
// head-select errors when the table/column is missing; rpc() returns the
// "function not found" code (PGRST202) when an RPC is missing.

interface Contract {
  tables: string[];
  rpcs: string[];
  selectedColumns: Record<string, string[]>;
}
const contract: Contract = JSON.parse(readFileSync('tests/contract/db-contract.json', 'utf8'));
const admin = adminClient();

const isRealColumn = (c: string) => /^[a-z_][a-z0-9_]*$/.test(c); // drops '*' and embedded relations

async function tableExists(table: string): Promise<boolean> {
  const { error } = await admin.from(table).select('*', { head: true, count: 'exact' }).limit(0);
  return !error;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await admin.from(table).select(column, { head: true }).limit(0);
  return !error;
}

async function rpcExists(fn: string): Promise<boolean> {
  // Call with no args; only a genuinely-absent function yields PGRST202.
  const { error } = await admin.rpc(fn);
  return error?.code !== 'PGRST202';
}

describe('DB contract — the app’s database surface exists locally', () => {
  it('every referenced table exists', async () => {
    const missing: string[] = [];
    for (const t of contract.tables) if (!(await tableExists(t))) missing.push(t);
    expect(missing, 'tables the app queries but missing from the local DB — extend the bootstrap / finish the re-baseline').toEqual([]);
  });

  it('every selected column exists', async () => {
    const missing: string[] = [];
    for (const [table, cols] of Object.entries(contract.selectedColumns)) {
      if (!(await tableExists(table))) continue; // already reported above
      for (const col of cols.filter(isRealColumn)) {
        if (!(await columnExists(table, col))) missing.push(`${table}.${col}`);
      }
    }
    expect(missing, 'columns the app selects but missing from the local DB').toEqual([]);
  });

  it('every referenced RPC exists', async () => {
    const missing: string[] = [];
    for (const fn of contract.rpcs) if (!(await rpcExists(fn))) missing.push(fn);
    expect(missing, 'RPCs the app calls but missing from the local DB').toEqual([]);
  });
});
