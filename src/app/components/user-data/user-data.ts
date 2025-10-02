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
import { UserDataService, UserDataModel, UserSettingsModel } from '../../services/user-data.service';
import { Timestamp } from 'firebase/firestore';

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

  // Subscriptions/Timer
  private subAuth?: Subscription;
  private subThemeChanges?: Subscription;
  private subLiveName?: Subscription;
  private subVolumeChanges?: Subscription;
  private saveNameTimer?: any;

  ngOnInit() {
    // Theme-Livewechsel: direkt anwenden + speichern
    this.subThemeChanges = this.settingsForm.get('theme')!.valueChanges.subscribe(async (t) => {
      if (!this.uid) return;
      const mode = (t as Theme) ?? this.theme.getTheme();
      this.applyTheme(mode);
      await this.svc.saveUserData(this.uid, { theme: mode }); // Service mappt zu personalization.theme
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
        try { localStorage.setItem('displayName', name); } catch {}
        try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name })); } catch {}
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
        try { localStorage.setItem('displayName', displayName); } catch {}
        try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: displayName })); } catch {}

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

        if (dbTheme && dbTheme !== this.theme.getTheme()) {
          this.applyTheme(dbTheme);
        }

        this.loading.set(false);
      } catch (e: any) {
        this.loading.set(false);
        this.errorMsg.set(e?.message ?? 'Daten konnten nicht geladen werden.');
      }
    });

    // Live-Volume-Änderungen -> lokal + Service + DB (debounced)
    this.subVolumeChanges = this.settingsForm
      .get('notificationVolumePct')!
      .valueChanges.pipe(debounceTime(200), distinctUntilChanged())
      .subscribe(async (v) => {
        const pct = Math.min(100, Math.max(0, Number(v ?? 30)));
        const vol = pct / 100;

        // Sofort lokal verfügbar halten
        try { localStorage.setItem('notify:volume', String(vol)); } catch {}
        this.sound.setVolume(vol);

        // In DB persistieren (Partial-Update)
        if (this.uid) {
          try {
            await this.svc.saveUserSettings(this.uid, { notificationVolume: vol });
          } catch {
            /* falls offline: ignorieren; bleibt lokal */
          }
        }

        // Nur testen, wenn Sound generell aktiv ist
        if (this.settingsForm.value.notificationSound !== false) {
          try { await this.sound.preview(vol); } catch {}
        }
      });
  }

  ngOnDestroy() {
    clearTimeout(this.saveNameTimer);
    this.subAuth?.unsubscribe();
    this.subThemeChanges?.unsubscribe();
    this.subLiveName?.unsubscribe();
    this.subVolumeChanges?.unsubscribe();

    const name = (this.profileForm.value.displayName ?? '').trim();
    if (this.uid && name) void this.persistDisplayName(name);
  }

  // THEME
  applyTheme(theme: Theme) {
    this.theme.setTheme(theme);
  }
  onThemeSelect(theme: Theme) {
    this.settingsForm.get('theme')!.setValue(theme);
  }

  // Anzeigename sofort speichern
  async persistDisplayName(name: string) {
    if (!this.uid) return;
    try {
      await this.svc.saveUserData(this.uid, { displayName: name } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });
      try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name })); } catch {}
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
        phoneNumber: phoneNumber,
      } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });

      try { localStorage.setItem('displayName', name); } catch {}
      try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name })); } catch {}
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Profil konnte nicht gespeichert werden.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async saveSettings() {
    if (!this.uid || this.settingsForm.invalid) return;
    this.savingSettings.set(true);
    this.errorMsg.set(null);

    const vol = (this.settingsForm.value.notificationVolumePct ?? 30) / 100;

    const settings: UserSettingsModel = {
      consumptionThreshold: this.settingsForm.value.consumptionThreshold ?? 3,
      notificationSound: this.settingsForm.value.notificationSound ?? true,
      // Lautstärke mit in die DB schreiben
      notificationVolume: Math.min(1, Math.max(0, vol)),
    };

    try {
      await this.svc.saveUserSettings(this.uid, settings);

      // Sofort auch lokal ablegen
      try {
        localStorage.setItem('notify:sound', settings.notificationSound ? 'on' : 'off');
        localStorage.setItem('notify:volume', String(settings.notificationVolume));
      } catch {}

      // Sound-Service updaten
      this.sound.setVolume(settings.notificationVolume ?? 0.3);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }

  public unlockAudio() {
    this.sound.ensureUnlockedFromGesture();
  }

  public previewVolume() {
    const pct = this.settingsForm.value.notificationVolumePct ?? 30;
    const vol = Math.min(1, Math.max(0, pct / 100));
    if (this.settingsForm.value.notificationSound === false) return;

    // mini Delay, damit der Unlock sicher durch ist:
    setTimeout(() => {
      this.sound.preview(vol).catch(err => console.error('Sound preview failed:', err));
    }, 0);
  }

}
