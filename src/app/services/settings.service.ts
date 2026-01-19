/* istanbul ignore file */
import { Injectable, signal, effect } from '@angular/core';

type BoolPref = boolean;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // Benachrichtigungssound EIN/AUS (default: EIN)
  soundEnabled = signal<BoolPref>(true);

  constructor() {
    // Laden
    try {
      const raw = localStorage.getItem('pref.sound');
      if (raw !== null) this.soundEnabled.set(raw === '1');
    } catch {}

    // Speichern wenn sich was ändert
    effect(() => {
      try {
        localStorage.setItem('pref.sound', this.soundEnabled() ? '1' : '0');
      } catch {}
    });
  }

  toggleSound() {
    this.soundEnabled.set(!this.soundEnabled());
  }
}
