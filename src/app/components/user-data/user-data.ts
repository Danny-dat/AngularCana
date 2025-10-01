import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
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

  // Startet mit aktuell gesetztem Theme (kein Rückfall auf "light")
  settingsForm = this.fb.group({
    theme: [this.theme.getTheme() as Theme, Validators.required],
    consumptionThreshold: [3, [Validators.min(0), Validators.max(20)]],
  });

  private subAuth?: Subscription;
  private subThemeChanges?: Subscription;
  private subLiveName?: Subscription;
  private saveNameTimer?: any;

  ngOnInit() {
    // Theme-Livewechsel: nur Theme speichern, nicht Profilfelder überschreiben
    this.subThemeChanges = this.settingsForm.get('theme')!.valueChanges.subscribe(async t => {
      if (!this.uid) return;
      const mode = (t as Theme) ?? this.theme.getTheme();
      this.applyTheme(mode);
      await this.svc.saveUserData(this.uid, {
        personalization: { theme: mode },
      } as any); // saveUserData sollte { merge:true } verwenden
    });

    // Live: Anzeigename -> localStorage + CustomEvent + verzögert (15s) persistieren
    this.subLiveName = this.profileForm.controls.displayName.valueChanges.pipe(
      map(v => (v ?? '').trim()),
      debounceTime(300),
      distinctUntilChanged(),
      filter(() => !!this.uid)
    ).subscribe(name => {
      try { localStorage.setItem('displayName', name); } catch {}
      // NEU: Live-Event für denselben Tab (Header zieht sofort mit)
      try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name })); } catch {}

      clearTimeout(this.saveNameTimer);
      this.saveNameTimer = setTimeout(() => this.persistDisplayName(name), 15000);
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
        const displayName = (data.displayName ?? '').trim();
        const phoneNumber = data.phoneNumber ?? '';
        this.profileForm.reset({ displayName, phoneNumber });

        // initial auch in localStorage spiegeln (damit Header stimmt)
        try { localStorage.setItem('displayName', displayName); } catch {}
        // NEU: Initialen Wert sofort an den Header funken
        try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: displayName })); } catch {}

        // DB-Theme lesen: personalization.theme bevorzugen
        const dbTheme = ((data as any)?.personalization?.theme ?? (data as any)?.theme) as Theme | undefined;

        // Werte in Settings-Form setzen, aber Events NICHT feuern
        this.settingsForm.patchValue(
          {
            theme: dbTheme ?? this.theme.getTheme(),
            consumptionThreshold: settings.consumptionThreshold ?? 3,
          },
          { emitEvent: false }
        );

        // Nur wirklich umschalten, wenn DB einen Wert hat und er abweicht
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

    // Optional: bei ungespeichertem Namen noch flushen
    const name = (this.profileForm.value.displayName ?? '').trim();
    if (this.uid && name) void this.persistDisplayName(name);
  }

  // THEME
  applyTheme(theme: Theme) {
    this.theme.setTheme(theme); // setzt Body-Klasse + localStorage
  }
  onThemeSelect(theme: Theme) {
    this.settingsForm.get('theme')!.setValue(theme);
  }

  // Sofort-Speichern des Anzeigenamens (DB + öffentlich + Auth)
  async persistDisplayName(name: string) {
    if (!this.uid) return;
    try {
      await this.svc.saveUserData(this.uid, { displayName: name } as UserDataModel);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, { displayName: name });
      }
      // NEU: Nach erfolgreichem Persistieren Event erneut schicken (synchronisiert andere Tabs/Listener)
      try { window.dispatchEvent(new CustomEvent('displayNameChanged', { detail: name })); } catch {}
    } catch (e) {
      // optional: Fehlerfeedback
    }
  }

  // SAVE
  async saveProfile() {
    if (!this.uid || this.profileForm.invalid) return;
    this.savingProfile.set(true);
    this.errorMsg.set(null);

    const name = (this.profileForm.value.displayName ?? '').trim();
    const phoneNumber = this.profileForm.value.phoneNumber ?? '';

    try {
      clearTimeout(this.saveNameTimer); // vermeidet Doppelspeichern kurz danach
      await this.svc.saveUserData(this.uid, {
        displayName: name,
        phoneNumber: phoneNumber,
      } as UserDataModel);
      await this.profileSvc.updatePublicProfile(this.uid, { displayName: name });
      if (this.auth.currentUser) await updateProfile(this.auth.currentUser, { displayName: name });

      try { localStorage.setItem('displayName', name); } catch {}
      // NEU: Auch beim Button-Speichern Event feuern
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

    const settings: UserSettingsModel = {
      consumptionThreshold: this.settingsForm.value.consumptionThreshold ?? 3,
    };

    try {
      await this.svc.saveUserSettings(this.uid, settings);
      // Theme wurde bereits via valueChanges gespeichert
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Einstellungen konnten nicht gespeichert werden.');
    } finally {
      this.savingSettings.set(false);
    }
  }
}
