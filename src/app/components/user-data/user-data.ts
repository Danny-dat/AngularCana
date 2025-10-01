import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { ProfileService } from '../../services/profile.service';
import { UserDataModel, UserDataService, UserSettingsModel } from '../../services/user-data.service';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './user-data.html',
  styleUrls: ['./user-data.css'],
})
export class UserDataComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private svc = inject(UserDataService);
  private profileSvc = inject(ProfileService);
  private theme = inject(ThemeService);

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

  // ⚠️ Startet mit dem aktuell gesetzten Theme (kein Rückfall auf "light")
  settingsForm = this.fb.group({
    theme: [this.theme.getTheme() as Theme, Validators.required],
    consumptionThreshold: [3, [Validators.min(0), Validators.max(20)]], // Beispiel
  });

  private subAuth?: Subscription;
  private subThemeChanges?: Subscription;

  ngOnInit() {
    // Live-Speichern & Umschalten bei Theme-Änderung (verhindert Inkonsistenzen)
    this.subThemeChanges = this.settingsForm.get('theme')!.valueChanges.subscribe(async t => {
      if (!this.uid) return;
      const mode = (t as Theme) ?? this.theme.getTheme();
      this.applyTheme(mode);
      // in DB persistieren (merge)
      await this.svc.saveUserData(this.uid, {
        displayName: this.profileForm.value.displayName ?? '',
        phoneNumber: this.profileForm.value.phoneNumber ?? '',
        theme: mode,
      } as UserDataModel);
    });

    // User laden + Daten ziehen
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
        this.profileForm.reset({
          displayName: data.displayName ?? '',
          phoneNumber: data.phoneNumber ?? '',
        });

        // DB-Theme nur anwenden, wenn vorhanden – sonst aktuelles Theme beibehalten
        const dbTheme = data.theme as Theme | undefined;

        // Werte in Settings-Form setzen, aber Events NICHT feuern (kein valueChanges-Trigger)
        this.settingsForm.patchValue(
          {
            theme: dbTheme ?? this.theme.getTheme(),
            consumptionThreshold: settings.consumptionThreshold ?? 3,
          },
          { emitEvent: false }
        );

        // Nur wirklich umschalten, wenn DB einen Wert hat und er vom aktuellen abweicht
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
    this.subAuth?.unsubscribe();
    this.subThemeChanges?.unsubscribe();
  }

  // THEME
  applyTheme(theme: Theme) {
    this.theme.setTheme(theme); // setzt Body-Klasse + localStorage
  }

  onThemeSelect(theme: Theme) {
    // Setzt den Form-Wert (triggert valueChanges → live switch + persist)
    this.settingsForm.get('theme')!.setValue(theme);
  }

  // SAVE
  async saveProfile() {
    if (!this.uid || this.profileForm.invalid) return;
    this.savingProfile.set(true);
    this.errorMsg.set(null);

    const { displayName, phoneNumber } = this.profileForm.value as UserDataModel;
    try {
      await this.svc.saveUserData(this.uid, {
        displayName: displayName ?? '',
        phoneNumber: phoneNumber ?? '',
        theme: (this.settingsForm.value.theme as Theme) ?? this.theme.getTheme(),
      });
      await this.profileSvc.updatePublicProfile(this.uid, { displayName });
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
    };

    try {
      await this.svc.saveUserSettings(this.uid, settings);
      // Theme wird bereits via valueChanges gespeichert
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }
}
