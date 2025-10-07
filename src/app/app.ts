// src/app/app.ts
import { Component, OnInit, PLATFORM_ID, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core'; // <-- 1. IMPORTS ERGÄNZT
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { UserDataService } from './services/user-data.service';
import { ThemeService } from './services/theme.service';
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
  private env = inject(EnvironmentInjector); // <-- 2. INJECTOR HINZUGEFÜGT

  // Wichtig: sorgt dafür, dass der ctor von SessionService läuft (globaler Heartbeat)
  private _session = inject(SessionService);
  private notify = inject(NotificationSoundService);

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
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      // Auf dem Server nichts mit Firebase/Window/AdService machen
      return;
    }

    // ▼▼▼ 3. FIREBASE-AUFRUF UMSCHLOSSEN ▼▼▼
    runInInjectionContext(this.env, () => {
      // Nur im Browser auf Auth-Stream gehen
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
    });
  }
}