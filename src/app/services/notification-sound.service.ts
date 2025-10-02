// src/app/services/notification-sound.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private audio = new Audio('assets/sounds/soft-chime-notification.wav');
  private unlocked = false;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.load();

    // iOS/Autoplay: ersten User-Klick nutzen, um Audio zu „unlocken“
    window.addEventListener('click', this.unlockOnce, { once: true, passive: true });
    window.addEventListener('touchstart', this.unlockOnce, { once: true, passive: true });
  }

  private unlockOnce = () => {
    if (this.unlocked) return;
    this.audio.volume = 0;
    this.audio.play().then(() => {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.unlocked = true;
      this.audio.volume = 0.8; // Default-Lautstärke
    }).catch(() => { /* ignorieren */ });
  };

  play(volume = 0.8) {
    this.audio.currentTime = 0;
    this.audio.volume = volume;
    return this.audio.play(); // Promise
  }
}
