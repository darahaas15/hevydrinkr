// Supabase Edge Function: send-notification
//
// Called by a Database Webhook on `notifications` table INSERT.
// Checks the user's notification preferences, fetches their device tokens,
// and sends a push notification via APNs (iOS) or Web Push (PWA).
//
// The notification row (title, body, type, data) is already written by the DB trigger.
// This function handles delivery to all registered devices.
//
// Environment variables (set via `supabase secrets set`):
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   APNS_KEY_ID               — Apple Push Notification key ID
//   APNS_TEAM_ID              — Apple Developer Team ID
//   APNS_PRIVATE_KEY          — .p8 key contents (base64-encoded PEM)
//   APNS_BUNDLE_ID            — com.drinkr.app
//   APNS_ENVIRONMENT          — 'development' or 'production'
//   VAPID_PRIVATE_KEY         — base64url-encoded ECDSA P-256 private key
//   VAPID_PUBLIC_KEY          — base64url-encoded ECDSA P-256 public key
//   VAPID_SUBJECT             — mailto: or https: URL identifying the sender

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Map notification type → preference column
const PREF_MAP: Record<string, string> = {
  like: 'likes_enabled',
  comment_like: 'likes_enabled',
  comment: 'comments_enabled',
  reply: 'comments_enabled',
  mention: 'comments_enabled',
  follow: 'follows_enabled',
  group_join: 'group_joins_enabled',
  challenge_created: 'challenges_enabled',
  challenge_ending: 'challenges_enabled',
  new_post: 'new_posts_enabled',
  still_drinking: 'session_reminders_enabled',
  weekly_summary: 'session_reminders_enabled',
};

// ═══════════════════════════════════════════════════════════════════════════
// APNs (iOS native)
// ═══════════════════════════════════════════════════════════════════════════

async function importPKCS8Key(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
}

async function createJWT(
  headerObj: Record<string, unknown>,
  claimsObj: Record<string, unknown>,
  key: CryptoKey,
): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(headerObj)));
  const claimsB64 = base64url(enc.encode(JSON.stringify(claimsObj)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${headerB64}.${claimsB64}`),
  );
  return `${headerB64}.${claimsB64}.${base64url(new Uint8Array(sig))}`;
}

let cachedAPNsJWT: { token: string; expiresAt: number } | null = null;
let cachedAPNsKey: CryptoKey | null = null;

async function getAPNsJWT(): Promise<string> {
  const now = Date.now();
  if (cachedAPNsJWT && cachedAPNsJWT.expiresAt > now) return cachedAPNsJWT.token;

  if (!cachedAPNsKey) {
    cachedAPNsKey = await importPKCS8Key(Deno.env.get('APNS_PRIVATE_KEY')!);
  }
  const token = await createJWT(
    { alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! },
    { iss: Deno.env.get('APNS_TEAM_ID')!, iat: Math.floor(Date.now() / 1000) },
    cachedAPNsKey,
  );
  cachedAPNsJWT = { token, expiresAt: now + 50 * 60 * 1000 };
  return token;
}

async function sendAPNs(deviceToken: string, payload: Record<string, unknown>) {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.drinkr.app';
  const env = Deno.env.get('APNS_ENVIRONMENT') ?? 'development';
  const host = env === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  const jwt = await getAPNsJWT();
  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`APNs error (${res.status}):`, body);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Web Push (PWA)
// ═══════════════════════════════════════════════════════════════════════════

let cachedVAPIDKey: CryptoKey | null = null;

async function getVAPIDPrivateKey(): Promise<CryptoKey> {
  if (cachedVAPIDKey) return cachedVAPIDKey;

  const privateBytes = base64urlDecode(Deno.env.get('VAPID_PRIVATE_KEY')!);
  const publicBytes = base64urlDecode(Deno.env.get('VAPID_PUBLIC_KEY')!);

  // Import as JWK — raw VAPID keys are 32-byte private + 65-byte uncompressed public
  const x = base64url(publicBytes.slice(1, 33));
  const y = base64url(publicBytes.slice(33, 65));
  const d = base64url(privateBytes);

  cachedVAPIDKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  return cachedVAPIDKey;
}

/**
 * Send a web push notification using the Web Push protocol (RFC 8030 + VAPID).
 *
 * The `tokenJson` is the JSON-serialized PushSubscription from the browser,
 * containing { endpoint, keys: { p256dh, auth } }.
 */
async function sendWebPush(tokenJson: string, payload: Record<string, unknown>) {
  let sub: { endpoint: string; keys: { p256dh: string; auth: string } };
  try {
    sub = JSON.parse(tokenJson);
  } catch {
    console.error('Invalid web push subscription JSON:', tokenJson);
    return;
  }

  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    console.error('Malformed web push subscription:', sub);
    return;
  }

  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:push@drinkr.app';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivateKey = await getVAPIDPrivateKey();

  // Build VAPID Authorization header (JWT)
  const audience = new URL(sub.endpoint).origin;
  const vapidJWT = await createJWT(
    { alg: 'ES256', typ: 'JWT' },
    {
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: vapidSubject,
    },
    vapidPrivateKey,
  );

  // Encrypt the payload using the subscription keys (aes128gcm)
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await encryptPayload(
    payloadBytes,
    base64urlDecode(sub.keys.p256dh),
    base64urlDecode(sub.keys.auth),
  );

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${vapidJWT}, k=${vapidPublicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body: encrypted,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Web Push error (${res.status}):`, body);

    // 404 or 410 = subscription expired, clean it up
    if (res.status === 404 || res.status === 410) {
      await supabase.from('device_tokens').delete().eq('token', tokenJson);
    }
  }
}

/**
 * Encrypt payload for Web Push using aes128gcm content encoding.
 * Implements RFC 8291 (Message Encryption for Web Push).
 */
async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKeyBytes: Uint8Array,
  authSecret: Uint8Array,
): Promise<Uint8Array> {
  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // Import client's public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeys.privateKey,
      256,
    ),
  );

  // Export server public key (uncompressed, 65 bytes)
  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey),
  );

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key material (RFC 8291)
  const enc = new TextEncoder();

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || client_pub || server_pub, 32)
  const infoPrefix = enc.encode('WebPush: info\0');
  const ikm_info = new Uint8Array(infoPrefix.length + clientPublicKeyBytes.length + serverPublicKeyBytes.length);
  ikm_info.set(infoPrefix, 0);
  ikm_info.set(clientPublicKeyBytes, infoPrefix.length);
  ikm_info.set(serverPublicKeyBytes, infoPrefix.length + clientPublicKeyBytes.length);

  const ikm = await hkdf(authSecret, sharedSecret, ikm_info, 32);

  // content encryption key: HKDF(salt, ikm, "Content-Encoding: aes128gcm" || 0x00, 16)
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const contentKey = await hkdf(salt, ikm, cekInfo, 16);

  // nonce: HKDF(salt, ikm, "Content-Encoding: nonce" || 0x00, 12)
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Add padding delimiter (0x02) after plaintext
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext);
  padded[plaintext.length] = 2; // delimiter

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded),
  );

  // Build aes128gcm header: salt (16) + rs (4, big-endian uint32) + idlen (1) + keyid (65)
  const recordSize = padded.length + 16; // plaintext + padding + tag (16)
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = serverPublicKeyBytes.length;
  header.set(serverPublicKeyBytes, 21);

  // Concatenate header + ciphertext
  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header, 0);
  result.set(ciphertext, header.length);

  return result;
}

/**
 * HKDF-SHA-256: extract-then-expand
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Extract: PRK = HMAC-SHA-256(salt, ikm)
  const prk = await hmacSHA256(salt, ikm);

  // Expand: T(1) = HMAC-SHA-256(PRK, info || 0x01)
  const expandInput = new Uint8Array(info.length + 1);
  expandInput.set(info, 0);
  expandInput[info.length] = 1;
  const t1 = await hmacSHA256(prk, expandInput);

  return t1.slice(0, length);
}

async function hmacSHA256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhook = await req.json();
  const record = webhook.record;

  if (!record) {
    return new Response('No record in webhook payload', { status: 400 });
  }

  const { user_id, actor_id, type, title, body, data } = record;

  // For comment-type notifications, append a preview of the comment to the push body
  const COMMENT_TYPES = ['comment', 'reply', 'mention'];
  let pushBody = body;
  if (COMMENT_TYPES.includes(type) && data?.commentPreview) {
    const preview = String(data.commentPreview);
    const truncated = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
    pushBody = `${body}: "${truncated}"`;
  }

  // Check user's preference for this notification type
  const prefColumn = PREF_MAP[type];
  if (prefColumn) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefColumn)
      .eq('user_id', user_id)
      .maybeSingle();

    if (prefs && prefs[prefColumn] === false) {
      return Response.json({ skipped: 'preference_disabled' });
    }
  }

  // Fetch device tokens with platform info
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', user_id);

  if (!tokens || tokens.length === 0) {
    return Response.json({ sent: 0, reason: 'no_tokens' });
  }

  // Separate tokens by platform
  const iosTokens = tokens.filter((t: { platform: string }) => t.platform === 'ios');
  const webTokens = tokens.filter((t: { platform: string }) => t.platform === 'web');

  const results: PromiseSettledResult<void>[] = [];

  // Send to iOS devices via APNs
  if (iosTokens.length > 0) {
    const apnsPayload = {
      aps: {
        alert: { title, body: pushBody },
        sound: 'default',
        badge: 1,
        'mutable-content': 1,
      },
      type,
      actorId: actor_id,
      ...(data ?? {}),
    };

    const iosResults = await Promise.allSettled(
      iosTokens.map((t: { token: string }) => sendAPNs(t.token, apnsPayload)),
    );
    results.push(...iosResults);
  }

  // Send to web devices via Web Push
  if (webTokens.length > 0) {
    const webPayload = {
      title,
      body: pushBody,
      tag: `drinkr-${type}`,
      data: { type, actorId: actor_id, ...(data ?? {}) },
    };

    const webResults = await Promise.allSettled(
      webTokens.map((t: { token: string }) => sendWebPush(t.token, webPayload)),
    );
    results.push(...webResults);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');
  for (const f of failed) {
    console.error('Push delivery failed:', (f as PromiseRejectedResult).reason);
  }
  return Response.json({ sent, total: tokens.length, ios: iosTokens.length, web: webTokens.length });
});
