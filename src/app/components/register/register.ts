import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RegisterData, AuthService } from '../../services/auth.service';
import { normalizeUnifiedUserName } from '../../utils/user-name';
import { ThemeService } from '../../services/theme.service'; // 👈 neu
import { UserBootstrapService } from '../../services/user-bootstrap.service';
import { AVATAR_PRESETS, AvatarPreset } from '../../utils/avatar-presets';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class RegisterComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private theme = inject(ThemeService);                  
  private bootstrap = inject(UserBootstrapService);

  form: RegisterData = {
    email: '',
    password: '',
    displayName: '',
    phoneNumber: '',

    // optional profile
    firstName: '',
    lastName: '',
    photoURL: '',
    bio: '',
    website: '',
    city: '',
    country: '',
    birthday: '',
    gender: 'unspecified',

    instagram: '',
    tiktok: '',
    youtube: '',
    discord: '',
    telegram: '',

    showBio: true,
    showWebsite: true,
    showLocation: true,
    showSocials: true,

    // settings
    consumptionThreshold: 3,
    notificationSound: true,
    notificationVolumePct: 30,
  };
  isLoading = false;
  errorMessage: string | null = null;

  selectedTheme: 'light' | 'dark' | null = null;
  selectTheme(t: 'light' | 'dark') { this.selectedTheme = t; }

  // Avatar Presets (assets)
  avatarPresets: AvatarPreset[] = AVATAR_PRESETS;
  selectAvatar(path: string) {
    this.form.photoURL = path;
  }
  isAvatarSelected(path: string): boolean {
    return (this.form.photoURL ?? '') === path;
  }

  async doRegister(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      // Theme: persistieren + als explizite Form-Angabe mitgeben
      if (this.selectedTheme) {
        this.form.theme = this.selectedTheme;
        try { localStorage.setItem('pref-theme', this.selectedTheme); } catch {}
      } else {
        // falls nicht gewählt: System/Local fallback – damit AuthService ein klares Theme setzen kann
        try {
          const local = (localStorage.getItem('pref-theme') || '').toLowerCase();
          if (local === 'dark' || local === 'light') this.form.theme = local as any;
          else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) this.form.theme = 'dark';
          else this.form.theme = 'light';
        } catch {
          this.form.theme = 'light';
        }
      }

      this.form.displayName = normalizeUnifiedUserName(this.form.displayName);

      const user = await this.authService.register(this.form);

      // Theme sofort visuell setzen (und Bootstrap übernimmt danach die konsistente Spiegelung)
      const t: 'light' | 'dark' = (this.form.theme === 'dark') ? 'dark' : 'light';
      this.theme.setTheme(t);

      // alles einmal bootstrapen (DisplayName, Theme, Notification Defaults)
      await this.bootstrap.bootstrapNow(user.uid);

      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage = 'Registrierung fehlgeschlagen.';
    } finally {
      this.isLoading = false;
    }
  }
}
