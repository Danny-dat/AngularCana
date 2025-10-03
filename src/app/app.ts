// src/app/app.ts
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { UserDataService } from './services/user-data.service';
import { ThemeService } from './services/theme.service';
import { AdService } from './services/ad.service';
import { NotificationSoundService } from './services/notification-sound.service';
import { SessionService } from './services/session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit {
  private auth = inject(Auth);
  private userData = inject(UserDataService);
  private theme = inject(ThemeService);

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Wichtig: sorgt dafür, dass der ctor von SessionService läuft (globaler Heartbeat)
  private _session = inject(SessionService);

  private notify = inject(NotificationSoundService);
  private ads = inject(AdService);

  constructor() {
    // "Benutzen", damit Tree-Shaking es nicht entfernt
    void this._session;

    if (this.isBrowser) {
      this.notify.setSource('assets/sounds/notification_dingdong.mp3', '20251003');
      // optional: früh Audio entsperren
      window.addEventListener(
        'pointerdown',
        () => this.notify.ensureUnlockedFromGesture(),
        { once: true, passive: true }
      );
    }

    // Debug (optional)
    // console.log('[AppComponent] ctor (browser=', this.isBrowser, ')');
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.ads.init();
    }

    user(this.auth).subscribe(async (u) => {
      if (!u?.uid) return;
      try {
        const data = await this.userData.loadUserData(u.uid);

        const pref: 'light' | 'dark' | undefined =
          (data as any)?.personalization?.theme ?? (data as any)?.theme;
          
        this.theme.setTheme(pref ?? this.theme.getTheme());
      } catch {
        this.theme.setTheme(this.theme.getTheme());
      }
    });
  }
}
