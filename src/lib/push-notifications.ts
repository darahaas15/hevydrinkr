import { supabase } from '@/lib/supabase/client';

let initialized = false;

/**
 * Initialize web push notifications via the Push API + service worker.
 */
export async function initPushNotifications(userId: string) {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'denied') {
    return;
  }

  // Only re-register an existing subscription on load.
  // Never request permission here — iOS requires a user gesture,
  // and calling requestPermission() without one poisons the state to 'denied'.
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

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

  initialized = false;

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

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    const reg = await navigator.serviceWorker.ready;
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
    console.error('Failed to store device token:', error);
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
