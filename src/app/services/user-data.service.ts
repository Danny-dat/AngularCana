import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

/** Root-Daten auf /users/{uid} */
export interface UserDataModel {
  displayName: string;
  phoneNumber: string;
  theme: 'light' | 'dark';
}

/** Settings im Root-Dokument unter "settings" */
export interface UserSettingsModel {
  consumptionThreshold: number;
  notificationSound: boolean;
  /** Lautstärke 0..1 (optional für Rückwärtskompatibilität) */
  notificationVolume?: number;
}

/** Defaults (Fallback/Migration) */
function getDefaultSettings(): UserSettingsModel {
  return {
    consumptionThreshold: 3,
    notificationSound: true,
    notificationVolume: 0.3,
  };
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private db = inject(Firestore);
  private env = inject(EnvironmentInjector); // <-- INJECTOR HINZUGEFÜGT

  /** /users/{uid} */
  private userDoc(uid: string) {
    // Diese private Funktion muss nicht verpackt werden, da die aufrufenden Funktionen verpackt sind.
    return doc(this.db, `users/${uid}`);
  }

  // ---------------- UserData (Profil / Theme) ----------------

  /** Lädt Root-Dokument und mapped Theme aus personalization.theme. */
  async loadUserData(uid: string): Promise<UserDataModel> {
    // ▼▼▼ HIER KORRIGIERT ▼▼▼
    return runInInjectionContext(this.env, async () => {
      const snap = await getDoc(this.userDoc(uid));
      const data: any = snap.exists() ? snap.data() : {};
      return {
        displayName: data.displayName ?? '',
        phoneNumber: data.phoneNumber ?? '',
        theme: data?.personalization?.theme ?? 'light',
      };
    });
  }

  /** Speichert nur die Felder, die übergeben werden (merge:true). */
  async saveUserData(uid: string, payload: Partial<UserDataModel>): Promise<void> {
    // ▼▼▼ HIER KORRIGIERT ▼▼▼
    return runInInjectionContext(this.env, async () => {
      const body: any = {};
      if (typeof payload.displayName === 'string') body.displayName = payload.displayName;
      if (typeof payload.phoneNumber === 'string') body.phoneNumber = payload.phoneNumber;
      if (payload.theme === 'light' || payload.theme === 'dark') {
        body.personalization = { theme: payload.theme };
      }
      if (Object.keys(body).length === 0) return;

      try {
        await setDoc(this.userDoc(uid), body, { merge: true });
      } catch (e: any) {
        console.error('saveUserData body ->', body);
        console.error('saveUserData Firestore error:', e?.code, e?.message, e);
        throw e;
      }
    });
  }

  // ---------------- Settings (im Root unter "settings") ----------------

  /** Lädt /users/{uid} und merged robust mit Defaults. */
  async loadUserSettings(uid: string): Promise<UserSettingsModel> {
    // ▼▼▼ HIER KORRIGIERT ▼▼▼
    return runInInjectionContext(this.env, async () => {
      const defaults = getDefaultSettings();
      const snap = await getDoc(this.userDoc(uid));
      const raw = snap.exists() ? (snap.data() as any) : {};
      const s = (raw.settings ?? {}) as Partial<UserSettingsModel>;

      return {
        consumptionThreshold:
          typeof s.consumptionThreshold === 'number'
            ? s.consumptionThreshold
            : defaults.consumptionThreshold,
        notificationSound:
          typeof s.notificationSound === 'boolean'
            ? s.notificationSound
            : defaults.notificationSound,
        notificationVolume:
          typeof s.notificationVolume === 'number'
            ? s.notificationVolume
            : defaults.notificationVolume,
      };
    });
  }

  /**
   * Speichert Settings mit dot-paths (merge:true), schreibt niemals undefined/NaN.
   * So vermeiden wir 400 Bad Request.
   */
  async saveUserSettings(uid: string, settings: Partial<UserSettingsModel>): Promise<void> {
    // ▼▼▼ HIER KORRIGIERT ▼▼▼
    return runInInjectionContext(this.env, async () => {
      const payload: Record<string, any> = {};

      if (settings.consumptionThreshold !== undefined && settings.consumptionThreshold !== null) {
        const raw = Number(settings.consumptionThreshold);
        if (Number.isFinite(raw)) {
          payload['settings.consumptionThreshold'] = Math.max(0, Math.min(20, Math.trunc(raw)));
        }
      }
      if (settings.notificationSound !== undefined && settings.notificationSound !== null) {
        payload['settings.notificationSound'] = !!settings.notificationSound;
      }
      if (settings.notificationVolume !== undefined && settings.notificationVolume !== null) {
        const raw = Number(settings.notificationVolume);
        if (Number.isFinite(raw)) {
          payload['settings.notificationVolume'] = Math.max(0, Math.min(1, raw));
        }
      }

      if (Object.keys(payload).length === 0) return;

      try {
        await setDoc(this.userDoc(uid), payload, { merge: true });
      } catch (e: any) {
        console.error('saveUserSettings payload ->', payload);
        console.error('saveUserSettings Firestore error:', e?.code, e?.message, e);
        throw e;
      }
    });
  }
}