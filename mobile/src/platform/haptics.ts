import * as Haptics from 'expo-haptics';

// Native replacement for the web app's src/lib/haptics.ts (swapped in by
// metro.config.js). The web version uses the Vibration API, which iOS Safari
// never supported; this drives the Taptic Engine.

async function play(effect: () => Promise<void>) {
  try {
    await effect();
  } catch {
    // No haptics hardware (simulator, web preview): nothing to feel.
  }
}

export async function hapticLight() {
  await play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
export async function hapticMedium() {
  await play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
export async function hapticHeavy() {
  await play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}
export async function hapticSuccess() {
  await play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
export async function hapticWarning() {
  await play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
export async function hapticError() {
  await play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
export async function hapticSelection() {
  await play(() => Haptics.selectionAsync());
}
