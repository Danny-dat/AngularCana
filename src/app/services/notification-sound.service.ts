// src/app/services/notification-sound.service.ts
import { Injectable } from '@angular/core';

function assetUrl(path: string, v?: string) {
  const url = new URL(path, document.baseURI);
  if (v) url.searchParams.set('ver', v);
  return url.toString();
}

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private audio = new Audio();
  private unlocked = false;

  private defaultVolume = 0.30;

  private ctx?: AudioContext;
  private gain?: GainNode;
  private srcNode?: MediaElementAudioSourceNode;

  private src = 'assets/sounds/notification_dingdong.mp3';

  constructor() {
    const raw = localStorage.getItem('notify:volume');
    const saved = raw === null ? NaN : Number(raw);
    if (!Number.isNaN(saved) && saved >= 0 && saved <= 1) {
      this.defaultVolume = saved;
    }

    this.setSource(this.src);

    // Fallback-Listener: entsperren beim ersten beliebigen Klick/Touch
    window.addEventListener('click', this.unlockOnce, { once: true, passive: true });
    window.addEventListener('touchstart', this.unlockOnce, { once: true, passive: true });
  }

  setSource(path: string, version = '1') {
    this.src = path;
    this.audio.pause();
    this.audio.src = assetUrl(path, version);
    this.audio.preload = 'auto';
    this.audio.currentTime = 0;
    this.audio.load();
    // Fallback-Lautstärke bis WebAudio verbunden ist
    this.audio.volume = this.defaultVolume;
  }

  getSource() { return this.src; }
  getVolume() { return this.defaultVolume; }

  setVolume(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    this.defaultVolume = clamped;
    try { localStorage.setItem('notify:volume', String(clamped)); } catch {}

    if (this.gain) {
      this.gain.gain.value = clamped;
    } else {
      this.audio.volume = clamped;
    }
  }

  preview(vol?: number) { return this.play(vol); }

  play(vol?: number) {
    const volToUse = typeof vol === 'number'
      ? Math.min(1, Math.max(0, vol))
      : this.defaultVolume;

    if (this.gain) {
      this.gain.gain.value = volToUse;
    } else {
      this.audio.volume = volToUse;
    }

    this.audio.currentTime = 0;
    return this.audio.play();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  /** ---- NEU: robustes Entsperren und Abspielen in derselben User-Geste ---- */

  /** Public Helper: aus einer echten User-Geste heraus sicher entsperren */
  public ensureUnlockedFromGesture() {
    this.ensureContextUnlockedSync();
  }

  /** Public: in einer User-Geste entsperren + abspielen (ohne Timeout) */
  public playFromGesture(vol?: number) {
    this.ensureContextUnlockedSync();
    const v = typeof vol === 'number' ? Math.min(1, Math.max(0, vol)) : this.defaultVolume;
    if (this.gain) this.gain.gain.value = v; else this.audio.volume = v;
    this.audio.currentTime = 0;
    return this.audio.play();
  }

  /** Kontext synchron bereitstellen/entsperren (muss in der User-Geste laufen) */
  private ensureContextUnlockedSync() {
    const CtxCtor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!CtxCtor) { this.unlocked = true; return; }

    if (!this.ctx) {
      // Erstelle Routing einmalig
      const ctx = new CtxCtor();
      const gain = ctx.createGain();
      gain.gain.value = this.defaultVolume;
      const srcNode = ctx.createMediaElementSource(this.audio);
      srcNode.connect(gain).connect(ctx.destination);
      this.ctx = ctx;
      this.gain = gain;
      this.srcNode = srcNode;
    }

    // Wichtig: resume() synchron innerhalb der Geste
    if (this.ctx.state === 'suspended') {
      this.ctx.resume?.();
    }
    this.unlocked = true;
  }

  /** Fallback: erstes User-Event (global) -> WebAudio initialisieren */
  private unlockOnce = () => {
    if (this.unlocked) return;
    try {
      this.ensureContextUnlockedSync();
    } catch {
      // Ignorieren, wir bleiben im <audio>-Fallback
      this.unlocked = true;
    }
  };
}
