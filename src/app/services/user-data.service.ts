import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

/** Root-Daten auf /users/{uid} */
export interface UserDataModel {
  displayName: string;
  phoneNumber: string;
  theme: 'light' | 'dark';
}

/** Settings werden unter /users/{uid} im Feld "settings" gespeichert */
export interface UserSettingsModel {
  consumptionThreshold: number;
  notificationSound: boolean;
  /** Lautstärke 0..1 (optional für Rückwärtskompatibilität) */
  notificationVolume?: number;
}

/** Defaults für Settings (für Migrations-/Fallback-Fälle) */
function getDefaultSettings(): UserSettingsModel {
  return {
    consumptionThreshold: 3,
    notificationSound: true,
    notificationVolume: 0.3, // 30 %
  };
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private db = inject(Firestore);

  /** /users/{uid} */
  private userDoc(uid: string) {
    return doc(this.db, `users/${uid}`);
  }

  // Hinweis: In dieser Implementierung speichern/lesen wir Settings aus dem Root-Dokument
  // unter "settings". Falls du später wirklich ein Subdokument nutzen willst, kannst du
  // diese Methode verwenden und load/save entsprechend umbauen.
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

  // ---------------- UserSettings (im Root-Dokument unter "settings") ----------------

  /**
   * Lädt Settings aus /users/{uid} (Feld "settings") und merged robust mit Defaults,
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
      notificationVolume:
        typeof s.notificationVolume === 'number'
          ? s.notificationVolume
          : defaults.notificationVolume,
    };
  }

  /**
   * Speichert Settings (merge:true, um andere Felder nicht zu verlieren).
   * Akzeptiert Partial, damit du auch nur einzelne Felder (z. B. notificationVolume) schreiben kannst.
   */
  async saveUserSettings(uid: string, settings: Partial<UserSettingsModel>): Promise<void> {
    const body: any = {};

    if (settings.consumptionThreshold !== undefined) {
      body.consumptionThreshold = settings.consumptionThreshold;
    }
    if (settings.notificationSound !== undefined) {
      body.notificationSound = !!settings.notificationSound;
    }
    if (settings.notificationVolume !== undefined) {
      const clamped = Math.min(1, Math.max(0, Number(settings.notificationVolume)));
      body.notificationVolume = clamped;
    }

    // Nichts zu schreiben? Dann noop.
    if (Object.keys(body).length === 0) return;

    await setDoc(
      this.userDoc(uid),
      { settings: body },
      { merge: true }
    );
  }
}
