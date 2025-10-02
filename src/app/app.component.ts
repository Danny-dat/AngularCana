// src/app/app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { UserDataService } from './services/user-data.service';
import { ThemeService } from './services/theme.service';
import { AdService } from './services/ad.service';
import { NotificationSoundService } from './services/notification-sound.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private auth = inject(Auth);
  private userData = inject(UserDataService);
  private theme = inject(ThemeService);
  private ads = inject(AdService);
  private notify = inject(NotificationSoundService);

    constructor() {
    this.notify.setSource('assets/sounds/notification_dingdong.mp3', '20251003');
  }

  ngOnInit(): void {
    // Werbung initialisieren (lädt Defaults + prüft /ads-Overrides)
    this.ads.init();

    // dein vorhandenes Theme-/User-Setup
    user(this.auth).subscribe(async (u) => {
      if (!u?.uid) return;
      try {
        const data = await this.userData.loadUserData(u.uid);
        const pref = ((data as any)?.personalization?.theme ?? (data as any)?.theme) as 'light'|'dark'|undefined;
        this.theme.setTheme(pref ?? this.theme.getTheme());
      } catch {
        this.theme.setTheme(this.theme.getTheme());
      }
    });
  }
}
