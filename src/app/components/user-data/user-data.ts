/* istanbul ignore file */
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { NotificationSoundService } from '../../services/notification-sound.service';
import { ProfileService } from '../../services/profile.service';
import { ThemeService, Theme } from '../../services/theme.service';
import { AVATAR_PRESETS, AvatarPreset } from '../../utils/avatar-presets';
import { normalizeUnifiedUserName, normalizeUnifiedUserNameKey } from '../../utils/user-name';
import {
  UserDataService,
  UserDataModel,
  UserSettingsModel,
} from '../../services/user-data.service';

@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './user-data.html',
  styleUrls: ['./user-data.css'],
})
export class UserDataComponent implements OnInit, OnDestroy {
  // Services
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly svc = inject(UserDataService);
  private readonly profileSvc = inject(ProfileService);
  private readonly theme = inject(ThemeService);
  private readonly sound = inject(NotificationSoundService);

  // UI state
  loading = signal(true);
  savingProfile = signal(false);
  savingSettings = signal(false);
  errorMsg = signal<string | null>(null);
  uid: string | null = null;

  // Forms
  profileForm = this.fb.group({    // Name ist Anzeigename + Username zugleich
    displayName: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9_]{3,20}$/)]],
    firstName: ['', [Validators.maxLength(40)]],
    lastName: ['', [Validators.maxLength(60)]],
    email: [{ value: '', disabled: true }],
    phoneNumber: [''],
    // Spark Plan: Avatar kommt aus Presets im /assets Ordner (kein Storage)
    photoURL: ['', [Validators.maxLength(300)]],

    bio: ['', [Validators.maxLength(280)]],
    website: ['', [Validators.maxLength(200)]],
    city: ['', [Validators.maxLength(80)]],
    country: ['', [Validators.maxLength(80)]],
    birthday: [''],
    gender: ['unspecified'],

    instagram: ['', [Validators.maxLength(60)]],
    tiktok: ['', [Validators.maxLength(60)]],
    youtube: ['', [Validators.maxLength(120)]],
    discord: ['', [Validators.maxLength(60)]],
    telegram: ['', [Validators.maxLength(60)]],

    // Privacy / Public Sync
    showBio: [true],
    showWebsite: [true],
    showLocation: [true],
    showSocials: [true],
  });

  // Avatar Presets (assets)
  avatarPresets: AvatarPreset[] = AVATAR_PRESETS;

  selectAvatar(path: string | null) {
    // Wir speichern weiterhin in photoURL (legacy + public profile)
    this.profileForm.controls.photoURL.setValue(path ?? '', { emitEvent: false });
    this.profileForm.controls.photoURL.markAsDirty();
    this.profileForm.markAsDirty();
  }

  isAvatarSelected(path: string | null): boolean {
    return (this.profileForm.getRawValue().photoURL ?? '') === (path ?? '');
  }
  /** Live Vorschau: so landet es (inkl. Privacy) in profiles_public */
  publicProfilePreview() {
    const raw = this.profileForm.getRawValue();
    const handle = normalizeUnifiedUserName((raw.displayName ?? '').toString());
    const name = handle || 'unbekannt';

    const city = (raw.city ?? '').trim();
    const country = (raw.country ?? '').trim();
    const locationText = [city, country].filter(Boolean).join(', ') || null;

    const normUrl = (value: string) => {
      const v = (value ?? '').trim();
      if (!v) return null;
      if (!/^https?:\/\//i.test(v)) return `https://${v}`;
      return v;
    };

    const socials = {
      instagram: (raw.instagram ?? '').trim() || null,
      tiktok: (raw.tiktok ?? '').trim() || null,
      youtube: (raw.youtube ?? '').trim() || null,
      discord: (raw.discord ?? '').trim() || null,
      telegram: (raw.telegram ?? '').trim() || null,
    };

    return {
      displayName: name,
      // zusammengelegt: Username wird nicht mehr separat angezeigt
      username: null,
      photoURL: (raw.photoURL ?? '').trim() || null,
      bio: raw.showBio ? (raw.bio ?? '').trim() || null : null,
      website: raw.showWebsite ? normUrl(raw.website ?? '') : null,
      locationText: raw.showLocation ? locationText : null,
      socials: raw.showSocials ? socials : null,
    };
  }


  nameState = signal<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  // Settings
  settingsForm = this.fb.group({
    theme: [this.theme.getTheme() as Theme, Validators.required],
    consumptionThreshold: [3, [Validators.min(0), Validators.max(20)]],
    notificationSound: [true],
    // Lautstärke in Prozent (0–100)
    notificationVolumePct: [30, [Validators.min(0), Validators.max(100)]],
  });

  // Baseline-Snapshot der geladenen Settings
  private baselineSettings = {
    theme: this.theme.getTheme() as Theme,
    consumptionThreshold: 3,
    notificationSound: true,
    notificationVolumePct: 30,
  };

  private captureBaselineFromForm() {
    const v = this.settingsForm.value;
    this.baselineSettings = {
      theme: (v.theme ?? this.theme.getTheme()) as Theme,
      consumptionThreshold: v.consumptionThreshold ?? 3,
      notificationSound: v.notificationSound ?? true,
      notificationVolumePct: v.notificationVolumePct ?? 30,
    };
  }

  public isSettingsChanged(): boolean {
    const v = this.settingsForm.value;
    return (
      ((v.theme ?? this.theme.getTheme()) as Theme) !== this.baselineSettings.theme ||
      (v.consumptionThreshold ?? 3) !== this.baselineSettings.consumptionThreshold ||
      (v.notificationSound ?? true) !== this.baselineSettings.notificationSound ||
      (v.notificationVolumePct ?? 30) !== this.baselineSettings.notificationVolumePct
    );
  }

  // Subscriptions/Timer
  private subAuth?: Subscription;
  private subThemeChanges?: Subscription;
  private subLiveName?: Subscription;
  private subNameChanges?: Subscription;
  private subVolumeChanges?: Subscription;
  private subSoundToggle?: Subscription;
  private subThresholdChanges?: Subscription;
  private saveNameTimer?: any;

  ngOnInit() {
    // Theme: lokal anwenden, DB erst bei "Speichern"
    this.subThemeChanges = this.settingsForm.get('theme')!.valueChanges.subscribe((t) => {
      const mode = (t as Theme) ?? this.theme.getTheme();
      this.theme.setTheme(mode); // UI sofort
      try {
        localStorage.setItem('ui:theme', String(mode));
      } catch {}
      // Baseline-Check übernimmt das Aktivieren des Buttons
    });

    // Live: Anzeigename -> localStorage + Event + verzögert persistieren
    this.subLiveName = this.profileForm.controls.displayName.valueChanges
      .pipe(
        map((v) => normalizeUnifiedUserName((v ?? '').toString())),
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => !!this.uid)
      )
      .subscribe((handle) => {
        try {
          localStorage.setItem('displayName', handle);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: handle }));
        } catch {}
        clearTimeout(this.saveNameTimer);
        this.saveNameTimer = setTimeout(() => this.persistDisplayName(handle), 15000);
      });

    // Name-Availability (gegen profiles_public.username) – Name ist jetzt Username
    this.subNameChanges = this.profileForm.controls.displayName.valueChanges
      .pipe(
        map((v) => normalizeUnifiedUserName((v ?? '').toString())),
        debounceTime(450),
        distinctUntilChanged(),
        filter(() => !!this.uid)
      )
      .subscribe(async (handle) => {
        const ctrl = this.profileForm.controls.displayName;

        // leer -> idle
        if (!handle) {
          this.nameState.set('idle');
          const errs = { ...(ctrl.errors ?? {}) };
          delete (errs as any).taken;
          ctrl.setErrors(Object.keys(errs).length ? errs : null);
          return;
        }

        // Validatoren zuerst
        if (ctrl.invalid) {
          this.nameState.set('invalid');
          return;
        }

        this.nameState.set('checking');
        try {
          const ok = await this.svc.isUsernameAvailable(handle, this.uid!);
          if (ok) {
            this.nameState.set('ok');
            const errs = { ...(ctrl.errors ?? {}) };
            delete (errs as any).taken;
            ctrl.setErrors(Object.keys(errs).length ? errs : null);
          } else {
            this.nameState.set('taken');
            ctrl.setErrors({ ...(ctrl.errors ?? {}), taken: true });
          }
        } catch {
          this.nameState.set('idle');
        }
      });


    // User + Daten laden
    this.subAuth = user(this.auth).subscribe(async (u) => {
      this.uid = u?.uid ?? null;
      if (!this.uid) {
        this.loading.set(false);
        this.errorMsg.set('Nicht eingeloggt.');
        return;
      }
      try {
        const data = await this.svc.loadUserData(this.uid);
        const settings = await this.svc.loadUserSettings(this.uid);
        // Profilfelder (Anzeigename + Username zusammengelegt)
        const authEmail = u?.email ?? data.email ?? '';
        const baseName = (
          (data.username ?? '').toString().trim() ||
          (data.displayName ?? '').toString().trim() ||
          (u?.displayName ?? '').toString().trim() ||
          (authEmail ? authEmail.split('@')[0] : '')
        ).trim();
        const handle = normalizeUnifiedUserName(baseName);
        const displayName = handle || baseName || 'user';

        const phoneNumber = data.phoneNumber ?? '';

        this.profileForm.reset(
          {
            displayName,
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            email: authEmail,
            phoneNumber,
            photoURL: data.photoURL ?? '',
            bio: data.bio ?? '',
            website: data.website ?? '',
            city: data.city ?? '',
            country: data.country ?? '',
            birthday: data.birthday ?? '',
            gender: data.gender ?? 'unspecified',
            instagram: data.socials?.instagram ?? '',
            tiktok: data.socials?.tiktok ?? '',
            youtube: data.socials?.youtube ?? '',
            discord: data.socials?.discord ?? '',
            telegram: data.socials?.telegram ?? '',
            showBio: data.visibility?.showBio ?? true,
            showWebsite: data.visibility?.showWebsite ?? true,
            showLocation: data.visibility?.showLocation ?? true,
            showSocials: data.visibility?.showSocials ?? true,
          },
          { emitEvent: false }
        );

        // UI-Status für Name
        this.nameState.set(displayName ? 'ok' : 'idle');

        // Email-Snapshot (für Admin-Ansicht) aktuell halten
        try {
          if (authEmail) await this.svc.saveUserData(this.uid, { email: authEmail });
        } catch {}
        try {
          localStorage.setItem('displayName', displayName);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: displayName }));
        } catch {}

        // Theme aus DB
        const dbTheme =
          ((data as any)?.personalization?.theme as Theme | undefined) ??
          (data.theme as Theme | undefined);

        // Lautstärke initial: DB → localStorage → 30 %
        let initialPct = 30;
        if (typeof settings?.notificationVolume === 'number') {
          initialPct = Math.round(Math.min(1, Math.max(0, settings.notificationVolume)) * 100);
        } else {
          try {
            const raw = localStorage.getItem('notify:volume');
            if (raw !== null) {
              const num = Number(raw);
              if (!Number.isNaN(num)) initialPct = Math.round(Math.min(1, Math.max(0, num)) * 100);
            }
          } catch {}
        }

        // Settings initial (ohne Events)
        this.settingsForm.patchValue(
          {
            theme: dbTheme ?? this.theme.getTheme(),
            consumptionThreshold: settings.consumptionThreshold ?? 3,
            notificationSound: settings.notificationSound ?? true,
            notificationVolumePct: initialPct,
          },
          { emitEvent: false }
        );

        // Sound-Service gleich setzen
        this.sound.setVolume(initialPct / 100);

        this.clampThreshold();

        if (dbTheme && dbTheme !== this.theme.getTheme()) {
          this.theme.setTheme(dbTheme);
        }

        // Baseline aus den jetzt sichtbaren Formularwerten ziehen
        this.captureBaselineFromForm();

        // Optional weiterhin: Forms als "unverändert" markieren
        this.profileForm.markAsPristine();
        this.settingsForm.markAsPristine();

        this.loading.set(false);
      } catch (e: any) {
        this.loading.set(false);
        this.errorMsg.set(e?.message ?? 'Daten konnten nicht geladen werden.');
      }
    });

    // Lautstärke -> lokal + Service (kein DB-Autosave)
    this.subVolumeChanges = this.settingsForm
      .get('notificationVolumePct')!
      .valueChanges.pipe(debounceTime(200), distinctUntilChanged())
      .subscribe(async (v) => {
        const pct = Math.min(100, Math.max(0, Number(v ?? 30)));
        const vol = pct / 100;

        try {
          localStorage.setItem('notify:volume', String(vol));
        } catch {}
        this.sound.setVolume(vol);

        if (this.settingsForm.value.notificationSound !== false) {
          try {
            await this.sound.preview(vol);
          } catch {}
        }
      });

    // Sound Toggle -> lokal halten
    this.subSoundToggle = this.settingsForm
      .get('notificationSound')!
      .valueChanges.subscribe((on) => {
        try {
          localStorage.setItem('notify:sound', on ? 'on' : 'off');
        } catch {}
      });

    // Threshold -> lokal halten
    this.subThresholdChanges = this.settingsForm
      .get('consumptionThreshold')!
      .valueChanges.pipe(distinctUntilChanged())
      .subscribe((val) => {
        try {
          localStorage.setItem('settings:consumptionThreshold', String(val ?? 3));
        } catch {}
      });
  }

  ngOnDestroy() {
    clearTimeout(this.saveNameTimer);
    this.subAuth?.unsubscribe();
    this.subThemeChanges?.unsubscribe();
    this.subLiveName?.unsubscribe();
    this.subVolumeChanges?.unsubscribe();
    this.subSoundToggle?.unsubscribe();
    this.subThresholdChanges?.unsubscribe();

    const name = (this.profileForm.value.displayName ?? '').trim();
    if (this.uid && name) void this.persistDisplayName(name);
  }

  // Theme per Button klicken => programmatischer setValue
  onThemeSelect(theme: Theme) {
    const ctrl = this.settingsForm.get('theme')!;
    if (ctrl.value !== theme) {
      ctrl.setValue(theme); // triggert valueChanges -> UI + Cache
      // Dirty-Markierung nicht mehr entscheidend; Button steuert Baseline-Check
    }
  }

  // Anzeigename sofort speichern (Blur)
  async persistDisplayName(name: string) {
    if (!this.uid) return;

    const handle = normalizeUnifiedUserName((name ?? '').toString());
    const key = normalizeUnifiedUserNameKey(handle);
    if (!handle) return;

    // Form-Wert normalisieren (z.B. Großbuchstaben/Leerzeichen)
    if (this.profileForm.controls.displayName.value !== handle) {
      this.profileForm.controls.displayName.setValue(handle, { emitEvent: false });
    }

    try {
      const raw = this.profileForm.getRawValue();
      await this.svc.saveUserData(this.uid, { displayName: handle, username: handle, usernameKey: key } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: handle, username: handle, usernameKey: key });
      if (this.auth.currentUser)
        await updateProfile(this.auth.currentUser, {
          displayName: handle,
          photoURL: (raw.photoURL ?? '').trim() || null,
        });
      try {
        localStorage.setItem('displayName', handle);
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: handle }));
      } catch {}
    } catch {
      /* silent */
    }
  }

  // SPEICHERN
  async saveProfile() {
    if (!this.uid || this.profileForm.invalid) return;
    this.savingProfile.set(true);
    this.errorMsg.set(null);

    const raw = this.profileForm.getRawValue();
    const phoneNumber = raw.phoneNumber ?? '';
    const handle = normalizeUnifiedUserName((raw.displayName ?? '').toString());
    const key = normalizeUnifiedUserNameKey(handle);
    if (!handle) {
      this.errorMsg.set('Bitte einen gültigen Namen wählen (3–20 Zeichen, A–Z/a–z, 0–9, _).');
      this.savingProfile.set(false);
      return;
    }

    // Unique-Check (Name ist jetzt Username)
    try {
      const ok = await this.svc.isUsernameAvailable(handle, this.uid);
      if (!ok) {
        this.profileForm.controls.displayName.setErrors({ ...(this.profileForm.controls.displayName.errors ?? {}), taken: true });
        this.nameState.set('taken');
        this.errorMsg.set('Dieser Name ist bereits vergeben.');
        this.savingProfile.set(false);
        return;
      }
    } catch {}
    const city = (raw.city ?? '').trim();
    const country = (raw.country ?? '').trim();

    const locationText = [city, country].filter(Boolean).join(', ') || null;

    const normUrl = (value: string) => {
      const v = (value ?? '').trim();
      if (!v) return null;
      // sehr einfache Normalisierung: wenn kein Schema -> https://
      if (!/^https?:\/\//i.test(v)) return `https://${v}`;
      return v;
    };

    try {
      clearTimeout(this.saveNameTimer);
      await this.svc.saveUserData(this.uid, {
        displayName: handle,
        username: handle,
        usernameKey: key,
        firstName: (raw.firstName ?? '').trim() || null,
        lastName: (raw.lastName ?? '').trim() || null,
        email: (raw.email ?? '').trim() || null,
        phoneNumber: phoneNumber || null,
        photoURL: (raw.photoURL ?? '').trim() || null,
        bio: (raw.bio ?? '').trim() || null,
        website: normUrl(raw.website ?? ''),
        city: city || null,
        country: country || null,
        birthday: (raw.birthday ?? '').trim() || null,
        gender: (raw.gender as any) ?? 'unspecified',
        socials: {
          instagram: (raw.instagram ?? '').trim() || null,
          tiktok: (raw.tiktok ?? '').trim() || null,
          youtube: (raw.youtube ?? '').trim() || null,
          discord: (raw.discord ?? '').trim() || null,
          telegram: (raw.telegram ?? '').trim() || null,
        },
        visibility: {
          showBio: !!raw.showBio,
          showWebsite: !!raw.showWebsite,
          showLocation: !!raw.showLocation,
          showSocials: !!raw.showSocials,
        },
      } as Partial<UserDataModel>);

      // Public profile synchronisieren (nur "öffentliche" Felder)
      await this.profileSvc.updatePublicProfile(this.uid, {
        displayName: handle,
        username: handle,
        usernameKey: key,
        photoURL: (raw.photoURL ?? '').trim() || null,
        bio: raw.showBio ? (raw.bio ?? '').trim() || null : null,
        website: raw.showWebsite ? normUrl(raw.website ?? '') : null,
        locationText: raw.showLocation ? locationText : null,
        socials: raw.showSocials
          ? {
              instagram: (raw.instagram ?? '').trim() || null,
              tiktok: (raw.tiktok ?? '').trim() || null,
              youtube: (raw.youtube ?? '').trim() || null,
              discord: (raw.discord ?? '').trim() || null,
              telegram: (raw.telegram ?? '').trim() || null,
            }
          : null,
      });

      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: handle });

      try {
        localStorage.setItem('displayName', handle);
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: handle }));
      } catch {}

      this.profileForm.markAsPristine();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Profil konnte nicht gespeichert werden.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async saveSettings() {
    if (!this.uid || !this.isSettingsChanged()) return;

    const th = this.clampThreshold();
    if (this.settingsForm.invalid) return;

    this.savingSettings.set(true);
    this.errorMsg.set(null);

    const vol = (this.settingsForm.value.notificationVolumePct ?? 30) / 100;
    const newTheme = (this.settingsForm.value.theme ?? this.theme.getTheme()) as Theme;
    const themeChanged = newTheme !== this.baselineSettings.theme;

    const settings: Partial<UserSettingsModel> = {
      consumptionThreshold: th,
      notificationSound: this.settingsForm.value.notificationSound ?? true,
      notificationVolume: Math.min(1, Math.max(0, vol)),
    };

    try {
      // 1) Settings speichern
      await this.svc.saveUserSettings(this.uid, settings);

      // 2) Theme separat in /users/{uid} speichern (nur wenn geändert)
      if (themeChanged) {
        await this.svc.saveUserData(this.uid, { theme: newTheme });
        try { localStorage.setItem('ui:theme', String(newTheme)); } catch {}
      }

      // Lokal konsistent halten
      try {
        localStorage.setItem('settings:consumptionThreshold', String(th));
        if (settings.notificationSound !== undefined) {
          localStorage.setItem('notify:sound', settings.notificationSound ? 'on' : 'off');
        }
        if (settings.notificationVolume !== undefined) {
          localStorage.setItem('notify:volume', String(settings.notificationVolume));
          this.sound.setVolume(settings.notificationVolume);
        }
      } catch {}

      this.captureBaselineFromForm();
      this.settingsForm.markAsPristine();
    } catch (e:any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }

  // Sound-Preview Button
  public previewVolume() {
    const pct = this.settingsForm.value.notificationVolumePct ?? 30;
    const vol = Math.min(1, Math.max(0, pct / 100));
    if (this.settingsForm.value.notificationSound === false) return;

    const s: any = this.sound;

    // 1) Wenn vorhanden: entsperren+abspielen in derselben Geste
    if (typeof s.playFromGesture === 'function') {
      s.playFromGesture(vol).catch((err: any) => console.error('Sound preview failed:', err));
      return;
    }

    // 2) Fallback: zuerst entsperren (falls Methode vorhanden)
    if (typeof s.ensureUnlockedFromGesture === 'function') {
      s.ensureUnlockedFromGesture();
    }

    // 3) Dann normal abspielen
    this.sound.preview(vol).catch((err) => console.error('Sound preview failed:', err));
  }

  // Konsumptionsthreshold
  private clampThreshold(min = 0, max = 20): number {
    const ctrl = this.settingsForm.get('consumptionThreshold')!;
    const raw = Number(ctrl.value ?? 3);
    const val = Number.isNaN(raw) ? 3 : raw;
    const clamped = Math.min(max, Math.max(min, val));
    if (clamped !== val) {
      ctrl.setValue(clamped, { emitEvent: false });
      // Optional: ctrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    }
    return clamped;
  }
}
