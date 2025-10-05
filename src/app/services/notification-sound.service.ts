// src/app/services/notification-sound.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private platformId = inject(PLATFORM_ID);
  private get isBrowser() { return isPlatformBrowser(this.platformId); }

  private audio?: HTMLAudioElement;
  private unlocked = false;

  private defaultVolume = 0.30;

  private ctx?: AudioContext;
  private gain?: GainNode;
  private srcNode?: MediaElementAudioSourceNode;

  private src = 'assets/sounds/notification_dingdong.mp3';

  constructor() {
    // nur im Browser: Volume laden + Quelle setzen + Unlock-Listener
    if (this.isBrowser) {
      try {
        const raw = localStorage.getItem('notify:volume');
        const saved = raw === null ? NaN : Number(raw);
        if (!Number.isNaN(saved) && saved >= 0 && saved <= 1) this.defaultVolume = saved;
      } catch {}

      this.setSource(this.src);

      window.addEventListener('click', this.unlockOnce, { once: true, passive: true });
      window.addEventListener('touchstart', this.unlockOnce, { once: true, passive: true });
    }
  }

  // ---- Helpers -------------------------------------------------------------

  private assetUrl(path: string, v?: string) {
    if (!this.isBrowser) return path; // SSR: nicht anfassen
    const url = new URL(path, document.baseURI);
    if (v) url.searchParams.set('ver', v);
    return url.toString();
  }

  private ensureAudio() {
    if (!this.isBrowser) return;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.volume = this.defaultVolume; // bis WebAudio hängt
    }
  }

  // ---- Public API (kompatibel zu deiner bisherigen Nutzung) ---------------

  setSource(path: string, version = '1') {
    this.src = path;
    if (!this.isBrowser) return;

    this.ensureAudio();
    // Audio vorhanden -> neu verdrahten
    if (this.audio) {
      this.audio.pause();
      this.audio.src = this.assetUrl(path, version);
      this.audio.currentTime = 0;
      try { this.audio.load(); } catch {}
      // Fallback-Lautstärke bis WebAudio aktiv ist
      if (!this.gain) this.audio.volume = this.defaultVolume;
    }
  }

  getSource() { return this.src; }
  getVolume() { return this.defaultVolume; }

  setVolume(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    this.defaultVolume = clamped;
    if (this.isBrowser) {
      try { localStorage.setItem('notify:volume', String(clamped)); } catch {}
      if (this.gain) this.gain.gain.value = clamped;
      else if (this.audio) this.audio.volume = clamped;
    }
  }

  preview(vol?: number) { return this.play(vol); }

  async play(vol?: number) {
    if (!this.isBrowser) return; // SSR: einfach no-op
    this.ensureAudio();
    if (!this.audio) return;

    const volToUse = typeof vol === 'number'
      ? Math.min(1, Math.max(0, vol))
      : this.defaultVolume;

    if (this.gain) this.gain.gain.value = volToUse;
    else this.audio.volume = volToUse;

    this.audio.currentTime = 0;
    try { await this.audio.play(); } catch { /* evtl. wegen fehlender User-Geste geblockt */ }
  }

  stop() {
    if (!this.isBrowser || !this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  /** ---- Entsperren/Abspielen aus echter User-Geste ----------------------- */

  public ensureUnlockedFromGesture() {
    if (!this.isBrowser) return;
    this.ensureContextUnlockedSync();
  }

  public playFromGesture(vol?: number) {
    if (!this.isBrowser) return;
    this.ensureContextUnlockedSync();

    const v = typeof vol === 'number' ? Math.min(1, Math.max(0, vol)) : this.defaultVolume;
    if (this.gain) this.gain.gain.value = v;
    else if (this.audio) this.audio.volume = v;

    if (!this.audio) return;
    this.audio.currentTime = 0;
    return this.audio.play();
  }

  // ---- WebAudio-Routing on demand ----------------------------------------

  private ensureContextUnlockedSync() {
    if (!this.isBrowser) return;

    const CtxCtor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    // kein WebAudio verfügbar → einfach als "unlocked" markieren
    if (!CtxCtor) { this.unlocked = true; return; }

    this.ensureAudio();
    if (!this.audio) { this.unlocked = true; return; }

    if (!this.ctx) {
      const ctx = new CtxCtor();
      const gain = ctx.createGain();
      gain.gain.value = this.defaultVolume;
      const srcNode = ctx.createMediaElementSource(this.audio);
      srcNode.connect(gain).connect(ctx.destination);
      this.ctx = ctx;
      this.gain = gain;
      this.srcNode = srcNode;
    }

    if (this.ctx.state === 'suspended') this.ctx.resume?.();
    this.unlocked = true;
  }

  private unlockOnce = () => {
    if (!this.isBrowser || this.unlocked) return;
    try { this.ensureContextUnlockedSync(); } catch { this.unlocked = true; }
  };
}
