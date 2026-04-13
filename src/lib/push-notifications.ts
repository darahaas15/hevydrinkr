import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/stores/use-ui-store';

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
  const toast = (msg: string, type: 'success' | 'error' | 'info' = 'info') =>
    useUIStore.getState().addToast(msg, type);

  if (typeof window === 'undefined') { toast('Push: no window', 'error'); return false; }
  if (!('serviceWorker' in navigator)) { toast('Push: no SW support', 'error'); return false; }
  if (!('PushManager' in window)) { toast('Push: no PushManager', 'error'); return false; }

  toast('Push: requesting permission…');
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    toast(`Push: permission threw: ${e}`, 'error');
    return false;
  }
  toast(`Push: permission = ${permission}`);
  if (permission !== 'granted') return false;

  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) { toast('Push: VAPID key missing', 'error'); return false; }
    toast(`Push: VAPID key found (${vapidKey.slice(0, 8)}…)`);

    // Diagnose SW state before waiting
    const existingReg = await navigator.serviceWorker.getRegistration();
    if (existingReg) {
      const sw = existingReg.active || existingReg.waiting || existingReg.installing;
      toast(`Push: SW reg found, state=${sw?.state ?? 'none'}`);
    } else {
      toast('Push: no SW registration, registering…');
      try {
        await navigator.serviceWorker.register('/sw.js');
        toast('Push: SW registered');
      } catch (e) {
        toast(`Push: SW register failed: ${e instanceof Error ? e.message : e}`, 'error');
        return false;
      }
    }

    toast('Push: waiting for SW ready…');
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SW ready timed out after 10s')), 10_000)
      ),
    ]);
    toast('Push: SW ready ✓');

    toast('Push: subscribing…');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    toast('Push: subscribed ✓');

    toast('Push: saving token…');
    await upsertWebPushSubscription(userId, sub);
    toast('Push: token saved ✓', 'success');
    return true;
  } catch (e) {
    toast(`Push: failed: ${e instanceof Error ? e.message : e}`, 'error');
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
    useUIStore.getState().addToast(`Push: DB upsert error: ${error.message}`, 'error');
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
