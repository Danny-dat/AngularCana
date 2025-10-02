// notification-sound.service.ts
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
  private src = 'assets/sounds/notification_dingdong.wav';

  constructor() {
    this.setSource(this.src); // init
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
    // Debug:
    console.debug('[notify] source set →', this.audio.src);
  }

  getSource() {
    return this.src;
  }

  async preview(volume = 0.9) {
    try {
      await this.play(volume);
    } catch {}
  }

  play(volume = 0.9) {
    this.audio.currentTime = 0;
    this.audio.volume = volume;
    return this.audio.play();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private unlockOnce = () => {
    if (this.unlocked) return;
    this.audio.volume = 0;
    this.audio
      .play()
      .then(() => {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.unlocked = true;
        console.debug('[notify] audio unlocked');
      })
      .catch(() => {});
  };
}
