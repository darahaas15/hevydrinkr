#!/usr/bin/env node
/*
 * Advisory guardrail for the staged light-mode migration. Reports hardcoded,
 * dark-only color usage that should become theme tokens (see AGENTS.md ›
 * Theming). It is NON-BLOCKING by design: most per-screen code is intentionally
 * un-migrated, so this prints a summary and always exits 0. It exists to make
 * the remaining surface visible and to discourage *new* hardcoded colors.
 *
 * Usage:
 *   node scripts/check-hardcoded-colors.mjs           # whole tree summary
 *   node scripts/check-hardcoded-colors.mjs <files…>   # scope to given files
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PATTERNS = [
  { name: 'bg/border/text-white|black + opacity', re: /\b(?:bg|border|text|divide|ring)-(?:white|black)(?:\/\[?[0-9.]+%?\]?)?/g },
  { name: 'zinc/gray/neutral/slate/stone-NNN', re: /\b(?:bg|text|border|divide|ring|from|to|via)-(?:zinc|gray|neutral|slate|stone)-\d{2,3}/g },
  { name: 'text-black on accent', re: /\btext-black\b/g },
  { name: 'inline rgba()/hex in style', re: /(?:background|color|border[A-Za-z]*)\s*:\s*['"]?(?:#[0-9a-fA-F]{3,8}|rgba?\()/g },
];

const ROOT = 'src';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (['.tsx', '.ts'].includes(extname(p))) out.push(p);
  }
  return out;
}

const argFiles = process.argv.slice(2).filter((f) => /\.(tsx?|ts)$/.test(f));
const files = argFiles.length ? argFiles : walk(ROOT);

let grand = 0;
const perFile = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  let count = 0;
  for (const { re } of PATTERNS) {
    const m = text.match(re);
    if (m) count += m.length;
  }
  if (count > 0) {
    perFile.push([file, count]);
    grand += count;
  }
}

perFile.sort((a, b) => b[1] - a[1]);

console.log('\nHardcoded color usage (advisory — these should migrate to theme tokens):\n');
for (const [file, count] of perFile.slice(0, 20)) {
  console.log(`  ${String(count).padStart(4)}  ${file}`);
}
if (perFile.length > 20) console.log(`  … and ${perFile.length - 20} more files`);
console.log(`\n  total: ${grand} hardcoded color usages across ${perFile.length} files`);
console.log('  see AGENTS.md › Theming for the token contract. (non-blocking)\n');

// Always succeed — this is a report, not a gate.
process.exit(0);
