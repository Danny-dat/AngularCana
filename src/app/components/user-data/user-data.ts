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
  profileForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.maxLength(50)]],
    phoneNumber: [''],
  });

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
        map((v) => (v ?? '').trim()),
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => !!this.uid)
      )
      .subscribe((name) => {
        try {
          localStorage.setItem('displayName', name);
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name }));
        } catch {}
        clearTimeout(this.saveNameTimer);
        this.saveNameTimer = setTimeout(() => this.persistDisplayName(name), 15000);
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

        // Profilfelder
        const displayName = (data.displayName ?? '').trim();
        const phoneNumber = data.phoneNumber ?? '';
        this.profileForm.reset({ displayName, phoneNumber });
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
    try {
      await this.svc.saveUserData(this.uid, { displayName: name } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });
      try {
        window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name }));
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

    const name = (this.profileForm.value.displayName ?? '').trim();
    const phoneNumber = this.profileForm.value.phoneNumber ?? '';

    try {
      clearTimeout(this.saveNameTimer);
      await this.svc.saveUserData(this.uid, {
        displayName: name,
        phoneNumber,
      } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });

      try {
        localStorage.setItem('displayName', name);
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name }));
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
