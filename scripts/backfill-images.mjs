#!/usr/bin/env node
/**
 * One-time backfill: move base64 data-URL images already stored in DB columns
 * into the public `images` Storage bucket, and rewrite each column to hold the
 * public URL instead. Run AFTER the 20260527_storage_images_bucket.sql migration.
 *
 * - Idempotent: rows already holding non-data URLs are skipped, and re-running
 *   re-uploads to the same content-addressed path (upsert).
 * - Dedupes identical bytes, so a photo duplicated across `session_photos` and
 *   `feed_items.photos` uploads only once and both rows get the same URL.
 *
 * Usage (service-role key bypasses RLS — keep it secret, never commit it):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/backfill-images.mjs --dry-run     # report only
 *   node scripts/backfill-images.mjs               # apply
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry-run');

if (!url || !key) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = 'images';

const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');
const uploadedByHash = new Map(); // sha256(dataUrl) -> public URL
let scanned = 0;
let converted = 0;

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'image/jpeg';
  const body = match[3];
  const buf = match[2]
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8');
  return { mime, buf };
}

async function uploadDataUrl(dataUrl, folder) {
  const hash = createHash('sha256').update(dataUrl).digest('hex');
  if (uploadedByHash.has(hash)) return uploadedByHash.get(hash);

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Unparseable data URL');
  const ext = (parsed.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = `${folder}/backfill-${hash.slice(0, 32)}.${ext}`;

  if (!DRY) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.buf, {
      contentType: parsed.mime,
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw error;
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  uploadedByHash.set(hash, publicUrl);
  return publicUrl;
}

async function backfillScalar(table, idCol, col, folder) {
  const { data, error } = await supabase.from(table).select(`${idCol}, ${col}`);
  if (error) throw error;
  for (const row of data) {
    scanned++;
    if (!isDataUrl(row[col])) continue;
    const publicUrl = await uploadDataUrl(row[col], folder);
    converted++;
    if (!DRY) {
      const { error: upErr } = await supabase.from(table).update({ [col]: publicUrl }).eq(idCol, row[idCol]);
      if (upErr) throw upErr;
    }
    console.log(`  ${table}.${col} [${row[idCol]}] -> ${publicUrl}`);
  }
}

async function backfillArray(table, idCol, col, folder) {
  const { data, error } = await supabase.from(table).select(`${idCol}, ${col}`);
  if (error) throw error;
  for (const row of data) {
    scanned++;
    const arr = row[col];
    if (!Array.isArray(arr) || !arr.some(isDataUrl)) continue;
    const next = [];
    for (const item of arr) next.push(isDataUrl(item) ? await uploadDataUrl(item, folder) : item);
    converted++;
    if (!DRY) {
      const { error: upErr } = await supabase.from(table).update({ [col]: next }).eq(idCol, row[idCol]);
      if (upErr) throw upErr;
    }
    console.log(`  ${table}.${col} [${row[idCol]}] -> ${next.length} url(s)`);
  }
}

console.log(DRY ? '— DRY RUN (no uploads / no writes) —' : '— LIVE RUN —');
await backfillScalar('profiles', 'id', 'avatar_url', 'avatars');
await backfillScalar('groups', 'id', 'icon_url', 'groups');
await backfillScalar('session_photos', 'id', 'url', 'photos');
await backfillArray('feed_items', 'id', 'photos', 'photos');
console.log(`Done. Scanned ${scanned} rows, converted ${converted}, uploaded ${uploadedByHash.size} unique image(s).`);
