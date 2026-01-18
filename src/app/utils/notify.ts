/* istanbul ignore file */
// src/app/utils/notify.ts

/** Nur kurze Vibration – der Sound kommt aus NotificationSoundService. */
export async function vibrate(ms = 120) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
