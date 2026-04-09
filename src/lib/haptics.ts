/** Web Vibration API haptics. No-ops silently if unsupported (e.g. iOS Safari). */
function vibrate(pattern: number | number[]) {
  try { navigator?.vibrate?.(pattern); } catch { /* unsupported */ }
}

export async function hapticLight() { vibrate(10); }
export async function hapticMedium() { vibrate(20); }
export async function hapticHeavy() { vibrate(30); }
export async function hapticSuccess() { vibrate([10, 50, 10]); }
export async function hapticWarning() { vibrate([20, 40, 20]); }
export async function hapticError() { vibrate([30, 30, 30]); }
export async function hapticSelection() { vibrate(5); }
