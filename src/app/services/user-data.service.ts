import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

/** Root-Daten auf /users/{uid} */
export interface UserDataModel {
  displayName: string;
  phoneNumber: string;
  theme: 'light' | 'dark';
}

/** Settings auf /users/{uid}/meta/settings */
export interface UserSettingsModel {
  consumptionThreshold: number;
  notificationSound: boolean;
}

/** Defaults für Settings (für Migrations-/Fallback-Fälle) */
function getDefaultSettings(): UserSettingsModel {
  return {
    consumptionThreshold: 3,
    notificationSound: true,
  };
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private db = inject(Firestore);

  /** /users/{uid} */
  private userDoc(uid: string) {
    return doc(this.db, `users/${uid}`);
  }

  /** /users/{uid}/meta/settings (Sub-Dokument) */
  private userSettingsDoc(uid: string) {
    return doc(this.db, `users/${uid}/meta/settings`);
  }

  // ---------------- UserData (Profil / Theme) ----------------

  /**
   * Lädt das User-Root-Dokument und mapped Theme aus personalization.theme.
   * Fallback für Theme ist 'light', falls (noch) nicht vorhanden.
   */
  async loadUserData(uid: string): Promise<UserDataModel> {
    const snap = await getDoc(this.userDoc(uid));
    const data: any = snap.exists() ? snap.data() : {};

    return {
      displayName: data.displayName ?? '',
      phoneNumber: data.phoneNumber ?? '',
      theme: data?.personalization?.theme ?? 'light',
    };
  }

  /**
   * Speichert nur die übergebenen Felder. Theme wird intern nach personalization.theme gemapped.
   * Nutz dafür Partial<UserDataModel>, damit du z. B. nur { theme } oder nur { displayName } speichern kannst.
   */
  async saveUserData(uid: string, payload: Partial<UserDataModel>): Promise<void> {
    const body: any = {};
    if (payload.displayName !== undefined) body.displayName = payload.displayName;
    if (payload.phoneNumber !== undefined) body.phoneNumber = payload.phoneNumber;
    if (payload.theme !== undefined) body.personalization = { theme: payload.theme };
    // No-Op ist ok: merge:true schreibt nur, was gesetzt ist
    await setDoc(this.userDoc(uid), body, { merge: true });
  }

  // ---------------- UserSettings (Sub-Dokument) ----------------

  /**
   * Lädt Settings aus /users/{uid}/meta/settings und merged robust mit Defaults,
   * damit alte Dokumente (ohne neue Felder) weiterhin funktionieren.
   */
    async loadUserSettings(uid: string): Promise<UserSettingsModel> {
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
      };
    }
  /**
   * Speichert Settings (merge:true, um andere Felder nicht zu verlieren).
   */
  async saveUserSettings(uid: string, settings: UserSettingsModel): Promise<void> {
    await setDoc(
      this.userDoc(uid),
      {
        settings: {
          consumptionThreshold: settings.consumptionThreshold,
          notificationSound: !!settings.notificationSound,
        },
      },
      { merge: true }
    );
  }
}
