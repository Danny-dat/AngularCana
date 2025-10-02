import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { ProfileService } from '../../services/profile.service';
import {
  UserDataModel,
  UserDataService,
  UserSettingsModel,
} from '../../services/user-data.service';
import { ThemeService, Theme } from '../../services/theme.service';

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

  // Settings (notificationSound bleibt hier nur als Flag/Einstellung)
  settingsForm = this.fb.group({
    theme: [this.theme.getTheme() as Theme, Validators.required],
    consumptionThreshold: [3, [Validators.min(0), Validators.max(20)]],
    notificationSound: [true],
  });

  // Subscriptions/Timer
  private subAuth?: Subscription;
  private subThemeChanges?: Subscription;
  private subLiveName?: Subscription;
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

        // Settings initial (ohne Events)
        this.settingsForm.patchValue(
          {
            theme: dbTheme ?? this.theme.getTheme(),
            consumptionThreshold: settings.consumptionThreshold ?? 3,
            notificationSound: settings.notificationSound ?? true,
          },
          { emitEvent: false }
        );

        if (dbTheme && dbTheme !== this.theme.getTheme()) {
          this.applyTheme(dbTheme);
        }

        this.loading.set(false);
      } catch (e: any) {
        this.loading.set(false);
        this.errorMsg.set(e?.message ?? 'Daten konnten nicht geladen werden.');
      }
    });
  }

  ngOnDestroy() {
    clearTimeout(this.saveNameTimer);
    this.subAuth?.unsubscribe();
    this.subThemeChanges?.unsubscribe();
    this.subLiveName?.unsubscribe();

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
        phoneNumber: phoneNumber,
      } as Partial<UserDataModel>);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });

      try {
        localStorage.setItem('displayName', name);
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name }));
      } catch {}
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

    const settings: UserSettingsModel = {
      consumptionThreshold: this.settingsForm.value.consumptionThreshold ?? 3,
      notificationSound: this.settingsForm.value.notificationSound ?? true,
    };

    try {
      await this.svc.saveUserSettings(this.uid, settings);

      // sofort auch lokal ablegen, damit Header und andere Services Zugriff haben
      try {
        localStorage.setItem('notify:sound', settings.notificationSound ? 'on' : 'off');
      } catch {}

      // Theme wurde über valueChanges separat gespeichert
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }
}
