import { supabase } from '@/lib/supabase/client';

let lastCheckedAt = 0;
const RECHECK_INTERVAL = 5 * 60 * 1000; // re-verify subscription every 5 min

/**
 * Initialize web push notifications via the Push API + service worker.
 */
export async function initPushNotifications(userId: string) {
  if (typeof window === 'undefined') return;

  // Avoid hammering on every render, but do re-check periodically
  // so we catch expired/rotated subscriptions.
  if (Date.now() - lastCheckedAt < RECHECK_INTERVAL) return;
  lastCheckedAt = Date.now();

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'denied') {
    return;
  }

  // Never request permission here — iOS requires a user gesture,
  // and calling requestPermission() without one poisons the state to 'denied'.
  if (Notification.permission !== 'granted') return;

  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    // If the subscription expired or was revoked, re-subscribe
    // (permission is already granted so no user gesture needed).
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    if (sub) {
      await upsertWebPushSubscription(userId, sub);
    }
  } catch {
    // Push setup failed silently
  }
}

/**
 * Remove push subscription on logout.
 */
export async function unregisterPushNotifications(userId: string) {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      // Subscription may not exist
    }
  }

  lastCheckedAt = 0;

  await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId);
}

/**
 * Request web push permission (call from a user-initiated action like settings).
 */
export async function requestWebPushPermission(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  } catch {
    return false;
  }

  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    // Ensure SW is registered (iOS PWA may not have it ready yet)
    if (!(await navigator.serviceWorker.getRegistration())) {
      await navigator.serviceWorker.register('/sw.js');
    }

    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SW activation timed out')), 10_000)
      ),
    ]);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await upsertWebPushSubscription(userId, sub);
    return true;
  } catch {
    return false;
  }
}

// ── Helpers ──────────────────────────────────────

async function upsertWebPushSubscription(userId: string, sub: PushSubscription) {
  const token = JSON.stringify(sub.toJSON());
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform: 'web', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    throw error;
  }
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}
