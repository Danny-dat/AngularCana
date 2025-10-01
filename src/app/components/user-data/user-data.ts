import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { ProfileService } from '../../services/profile.service';
import { UserDataModel, UserDataService, UserSettingsModel } from '../../services/user-data.service';


type Theme = 'light' | 'dark';

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

  settingsForm = this.fb.group({
    theme: ['light' as Theme, Validators.required],
    consumptionThreshold: [3, [Validators.min(0), Validators.max(20)]], // Beispiel
  });

  private sub?: Subscription;

  ngOnInit() {
    this.sub = user(this.auth).subscribe(async (u) => {
      this.uid = u?.uid ?? null;
      if (!this.uid) {
        this.loading.set(false);
        this.errorMsg.set('Nicht eingeloggt.');
        return;
      }
      try {
        const data = await this.svc.loadUserData(this.uid);
        const settings = await this.svc.loadUserSettings(this.uid);

        this.profileForm.reset({
          displayName: data.displayName ?? '',
          phoneNumber: data.phoneNumber ?? '',
        });

        const theme = (data.theme as Theme) ?? 'light';
        this.settingsForm.reset({
          theme,
          consumptionThreshold: settings.consumptionThreshold ?? 3,
        });
        this.applyTheme(theme);
        this.loading.set(false);
      } catch (e: any) {
        this.loading.set(false);
        this.errorMsg.set(e?.message ?? 'Daten konnten nicht geladen werden.');
      }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // THEME
  applyTheme(theme: Theme) {
    const root = document.documentElement; // <html>
    root.setAttribute('data-theme', theme);
  }
  onThemeSelect(theme: Theme) {
    this.settingsForm.get('theme')!.setValue(theme);
    this.applyTheme(theme);
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
        theme: (this.settingsForm.value.theme as Theme) ?? 'light',
      });
      // Öffentlichen Anzeigenamen pflegen (wie im alten JS)
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
      // Theme wird bereits live gesetzt, hier nichts weiter nötig
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }
}
