/* istanbul ignore file */
import { Injectable, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth, user, updateProfile } from '@angular/fire/auth';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UserDataService } from './user-data.service';
import { ThemeService } from './theme.service';
import { NotificationSoundService } from './notification-sound.service';
import { ProfileService } from './profile.service';
import { normalizeUnifiedUserName } from '../utils/user-name';

/**
 * Läuft global bei Login/Logout und zieht die wichtigsten User-Daten
 * (Theme, DisplayName, Notification Settings) einmal in den Client-State,
 * damit Header/UX sofort konsistent sind – auch ohne erst /me zu öffnen.
 */
@Injectable({ providedIn: 'root' })
export class UserBootstrapService {
  private auth = inject(Auth);
  private userData = inject(UserDataService);
  private theme = inject(ThemeService);
  private sound = inject(NotificationSoundService);
  private profile = inject(ProfileService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private get isBrowser() { return isPlatformBrowser(this.platformId); }

  /** verhindert parallel laufende Boots für denselben User */
  private bootInFlight: Promise<void> | null = null;
  private lastUid = '';

  constructor() {
    if (!this.isBrowser) return; // SSR: keine LocalStorage/Window Side-Effects

    user(this.auth)
      .pipe(
        map((u) => u?.uid ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((uid) => {
        void this.bootstrapNow(uid);
      });
  }

  /**
   * Kann vom Login explizit awaited werden, damit Settings vor Navigation gesetzt sind.
   */
  async bootstrapNow(uid?: string | null): Promise<void> {
    if (!this.isBrowser) return; // SSR

    const resolvedUid = (uid ?? '').trim();
    if (!resolvedUid) {
      this.lastUid = '';
      this.bootInFlight = null;
      try {
        localStorage.removeItem('displayName');
      } catch {}
      return;
    }

    // gleicher User + Boot läuft bereits
    if (this.lastUid === resolvedUid && this.bootInFlight) {
      return this.bootInFlight;
    }

    this.lastUid = resolvedUid;
    this.bootInFlight = this.runBootstrap(resolvedUid)
      .catch(() => {
        // best effort – keine Side Effects nach außen werfen
      })
      .finally(() => {
        this.bootInFlight = null;
      });

    return this.bootInFlight;
  }

  private async runBootstrap(uid: string): Promise<void> {
    const au = this.auth.currentUser;
    if (au) {
      // best-effort: falls profiles_public fehlt/alt ist
      try {
        await this.profile.ensurePublicProfileOnLogin({
          uid: au.uid,
          displayName: au.displayName,
          email: au.email,
          photoURL: au.photoURL,
        });
      } catch {}
    }

    // 1) Daten aus /users/{uid}
    const data = await this.userData.loadUserData(uid);
    const settings = await this.userData.loadUserSettings(uid);

    // 2) DisplayName/Handle sauber ableiten
    const email = au?.email ?? (data.email ?? null);
    const baseName =
      (data.username ?? '').toString().trim() ||
      (data.displayName ?? '').toString().trim() ||
      (au?.displayName ?? '').toString().trim() ||
      (email ? email.split('@')[0] : '');

    const handle = normalizeUnifiedUserName(baseName) || baseName || 'User';
    try {
      localStorage.setItem('displayName', handle);
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: handle }));
    } catch {}

    // optional: Auth-Profile nachziehen (wenn abweicht)
    if (au && handle && (au.displayName ?? '').trim() !== handle) {
      try {
        await updateProfile(au, { displayName: handle });
      } catch {}
    }

    // 3) Theme setzen (UI sofort konsistent)
    const t: 'light' | 'dark' = data.theme === 'dark' ? 'dark' : 'light';
    this.theme.setTheme(t);
    try {
      localStorage.setItem('ui:theme', t);
    } catch {}

    // 4) Notification Settings in lokalen Cache spiegeln
    try {
      localStorage.setItem(
        'settings:consumptionThreshold',
        String(settings?.consumptionThreshold ?? 3)
      );
      localStorage.setItem(
        'notify:sound',
        settings?.notificationSound === false ? 'off' : 'on'
      );
      if (typeof settings?.notificationVolume === 'number') {
        localStorage.setItem('notify:volume', String(settings.notificationVolume));
      }
    } catch {}

    if (typeof settings?.notificationVolume === 'number') {
      this.sound.setVolume(settings.notificationVolume);
    }
  }
}
