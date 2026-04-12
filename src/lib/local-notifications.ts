let reminderTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a web notification when a session hits 2 hours.
 * Uses the Web Notification API with setTimeout.
 */
export async function scheduleSessionReminder(startedAt: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  const twoHoursFromStart = new Date(new Date(startedAt).getTime() + 2 * 60 * 60 * 1000);
  const delay = twoHoursFromStart.getTime() - Date.now();
  if (delay <= 0) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  if (reminderTimeout) clearTimeout(reminderTimeout);

  reminderTimeout = setTimeout(() => {
    new Notification('Session Check-in', {
      body: "Your session has been going for 2 hours. Don't forget to stay hydrated!",
      icon: '/icons/icon-192x192.png',
      tag: 'session-reminder',
    });
    reminderTimeout = null;
  }, delay);
}

/**
 * Cancel the session reminder (call on session end/abandon).
 */
export async function cancelSessionReminder() {
  if (reminderTimeout) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }
}
