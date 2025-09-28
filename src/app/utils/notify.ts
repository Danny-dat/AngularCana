// src/app/utils/notify.ts
let toneStarted = false;

/** Einmalig auslösen (z. B. beim ersten Klick der User), damit AudioContext entsperrt ist. */
export async function ensureAudioReady() {
  try {
    if (toneStarted) return true;
    // Optional: Tone.js verwenden, falls du es eingebunden hast.
    // Ohne externe Lib: einfachen Beep per WebAudio erzeugen.
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // stumm starten
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    toneStarted = true;
    return true;
  } catch {
    return false;
  }
}

/** Kurzer Ton + Vibration bei neuer Notification */
export async function playSoundAndVibrate() {
  try {
    const ok = await ensureAudioReady();
    if (ok) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch {}
  try { navigator.vibrate?.(120); } catch {}
}
