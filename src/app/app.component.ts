// src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { UserDataService } from './services/user-data.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private auth = inject(Auth);
  private userData = inject(UserDataService);
  private theme = inject(ThemeService);

  constructor() {
    user(this.auth).subscribe(async (u) => {
      if (!u?.uid) return;
      try {
        const data = await this.userData.loadUserData(u.uid);

        // NEU: erst personalization.theme prüfen, sonst (Fallback) theme
        const pref = ((data as any)?.personalization?.theme ?? (data as any)?.theme) as 'light'|'dark'|undefined;
        this.theme.setTheme(pref ?? this.theme.getTheme());
      } catch {
        // Fallback: letzter lokaler Wert
        this.theme.setTheme(this.theme.getTheme());
      }
    });
  }
}
