// src/app/app.ts
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationSoundService } from './services/notification-sound.service';
import { SessionService } from './services/session.service';
import { UserBootstrapService } from './services/user-bootstrap.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Wichtig: sorgt dafür, dass der ctor von SessionService läuft (globaler Heartbeat)
  private _session = inject(SessionService);
  // Wichtig: lädt User-Daten/Settings direkt nach Login (Theme, Name, Sound)
  private _bootstrap = inject(UserBootstrapService);
  private notify = inject(NotificationSoundService);

  constructor() {
    // "Benutzen", damit Tree-Shaking es nicht entfernt
    void this._session;
    void this._bootstrap;

    if (this.isBrowser) {
      this.notify.setSource('assets/sounds/notification_dingdong.mp3', '20251003');
      // optional: früh Audio entsperren
      window.addEventListener('pointerdown', () => this.notify.ensureUnlockedFromGesture(), {
        once: true,
        passive: true,
      });
    }
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      // Auf dem Server nichts mit Firebase/Window/AdService machen
      return;
    }
  }
}
