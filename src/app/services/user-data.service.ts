/* istanbul ignore file */
import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';

export type Gender = 'unspecified' | 'male' | 'female' | 'diverse';

export interface UserSocialLinksModel {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  discord?: string | null;
  telegram?: string | null;
}

export interface UserVisibilityModel {
  showBio?: boolean;
  showWebsite?: boolean;
  showLocation?: boolean;
  showSocials?: boolean;
}

/**
 * View-Model für /users/{uid}
 * - Wir mappen die neuen Daten aus `profile.*`, bleiben aber abwärtskompatibel
 *   (alte Felder wie `displayName` / `phoneNumber` auf Root).
 */
export interface UserDataModel {
  email?: string | null;
  displayName: string;
  username?: string | null;
  /** Case-insensitive Key (für eindeutige Checks/Queries) */
  usernameKey?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  birthday?: string | null; // YYYY-MM-DD
  gender?: Gender;
  socials?: UserSocialLinksModel;
  visibility?: UserVisibilityModel;

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

function getDefaultVisibility(): UserVisibilityModel {
  return {
    showBio: true,
    showWebsite: true,
    showLocation: true,
    showSocials: true,
  };
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private db = inject(Firestore);
  private env = inject(EnvironmentInjector); 

  /** verhindert wiederholte Migrationen in einer Session */
  private migratedLegacy = new Set<string>();

  /** /users/{uid} */
  private userDoc(uid: string) {
    // Diese private Funktion muss nicht verpackt werden, da die aufrufenden Funktionen verpackt sind.
    return doc(this.db, `users/${uid}`);
  }

  // ---------------- UserData (Profil / Theme) ----------------

  /** Lädt Root-Dokument und mapped Theme aus personalization.theme. */
  async loadUserData(uid: string): Promise<UserDataModel> {
    return runInInjectionContext(this.env, async () => {
      const snap = await getDoc(this.userDoc(uid));
      const data: any = snap.exists() ? snap.data() : {};

      // Migration Helper (legacy: displayName -> profile.displayName, etc.)
      await this.migrateLegacyUserProfile(uid, data);

      const p: any = data.profile ?? {};
      const loc: any = p.location ?? {};
      const socials: any = p.socials ?? {};
      const visibility: any = p.visibility ?? {};

      return {
        email: (data.email ?? null) as string | null,

        displayName: (p.displayName ?? data.displayName ?? '').toString(),
        username: (p.username ?? data.username ?? null) as string | null,
        usernameKey: (p.usernameKey ?? data.usernameKey ?? null) as string | null,
        firstName: (p.firstName ?? data.firstName ?? null) as string | null,
        lastName: (p.lastName ?? data.lastName ?? null) as string | null,
        phoneNumber: (p.phoneNumber ?? data.phoneNumber ?? null) as string | null,
        photoURL: (p.photoURL ?? data.photoURL ?? null) as string | null,
        bio: (p.bio ?? data.bio ?? null) as string | null,
        website: (p.website ?? data.website ?? null) as string | null,
        city: (loc.city ?? null) as string | null,
        country: (loc.country ?? null) as string | null,
        birthday: (p.birthday ?? null) as string | null,
        gender: (p.gender ?? 'unspecified') as Gender,
        socials: {
          instagram: socials.instagram ?? null,
          tiktok: socials.tiktok ?? null,
          youtube: socials.youtube ?? null,
          discord: socials.discord ?? null,
          telegram: socials.telegram ?? null,
        },
        visibility: {
          ...getDefaultVisibility(),
          ...visibility,
        },

        theme: (data?.personalization?.theme ?? data?.theme ?? 'light') as 'light' | 'dark',
      };
    });
  }

  /**
   * Migration Helper:
   * - alte Root-Felder (displayName, username, ...)
   * - werden einmalig nach profile.* übernommen, falls dort noch nichts steht.
   */
  private async migrateLegacyUserProfile(uid: string, data: any): Promise<void> {
    if (this.migratedLegacy.has(uid)) return;
    this.migratedLegacy.add(uid);

    const p: any = data?.profile ?? null;
    const hasProfile = !!p && typeof p === 'object' && !Array.isArray(p);
    const currentProfile: any = hasProfile ? p : {};

    const patchProfile: any = {};

    const copyIfMissing = (key: string) => {
      const rootVal = data?.[key];
      if (rootVal === undefined || rootVal === null || rootVal === '') return;
      if (currentProfile?.[key] === undefined || currentProfile?.[key] === null || currentProfile?.[key] === '') {
        patchProfile[key] = rootVal;
      }
    };

    copyIfMissing('displayName');
    copyIfMissing('username');
    copyIfMissing('firstName');
    copyIfMissing('lastName');
    copyIfMissing('phoneNumber');
    copyIfMissing('photoURL');
    copyIfMissing('bio');
    copyIfMissing('website');
    copyIfMissing('birthday');
    copyIfMissing('gender');

    // Location
    const loc: any = currentProfile?.location ?? {};
    const patchLoc: any = {};
    if (data?.city && !loc?.city) patchLoc.city = data.city;
    if (data?.country && !loc?.country) patchLoc.country = data.country;
    if (Object.keys(patchLoc).length) {
      patchProfile.location = { ...(typeof loc === 'object' && loc ? loc : {}), ...patchLoc };
    }

    if (Object.keys(patchProfile).length === 0) return;

    try {
      await setDoc(
        this.userDoc(uid),
        {
          profile: { ...currentProfile, ...patchProfile },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Migration ist "best effort" – UI funktioniert durch Fallbacks auch ohne.
    }
  }

  /** Speichert nur die Felder, die übergeben werden (merge:true). */
  async saveUserData(uid: string, payload: Partial<UserDataModel>): Promise<void> {
    return runInInjectionContext(this.env, async () => {
      // WICHTIG:
      // setDoc(..., {merge:true}) interpretiert KEINE "dot paths" als nested updates.
      // Daher bauen wir die verschachtelte Struktur sauber als Objekt auf.
      const body: any = {};
      const profile: any = {};
      const location: any = {};
      const socials: any = {};
      const visibility: any = {};

      const normStr = (v: any) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const s = String(v).trim();
        return s.length ? s : null;
      };

      const setRootAndProfile = (key: string, v: any) => {
        const val = normStr(v);
        if (val === undefined) return;
        body[key] = val;
        profile[key] = val;
      };

      // Root + profile (abwärtskompatibel)
      setRootAndProfile('displayName', payload.displayName);
      setRootAndProfile('username', payload.username);
      setRootAndProfile('usernameKey', payload.usernameKey);
      setRootAndProfile('firstName', payload.firstName);
      setRootAndProfile('lastName', payload.lastName);
      setRootAndProfile('phoneNumber', payload.phoneNumber);
      setRootAndProfile('photoURL', payload.photoURL);
      setRootAndProfile('bio', payload.bio);
      setRootAndProfile('website', payload.website);
      setRootAndProfile('birthday', payload.birthday);
      if (payload.gender !== undefined) {
        body.gender = payload.gender ?? null;
        profile.gender = payload.gender ?? null;
      }

      // Location
      const city = normStr(payload.city);
      if (city !== undefined) {
        body.city = city;
        location.city = city;
      }
      const country = normStr(payload.country);
      if (country !== undefined) {
        body.country = country;
        location.country = country;
      }

      // Socials (nur im profile)
      if (payload.socials) {
        const s = payload.socials;
        const ig = normStr(s.instagram);
        if (ig !== undefined) socials.instagram = ig;
        const tt = normStr(s.tiktok);
        if (tt !== undefined) socials.tiktok = tt;
        const yt = normStr(s.youtube);
        if (yt !== undefined) socials.youtube = yt;
        const dc = normStr(s.discord);
        if (dc !== undefined) socials.discord = dc;
        const tg = normStr(s.telegram);
        if (tg !== undefined) socials.telegram = tg;
      }

      // Sichtbarkeit (nur im profile)
      if (payload.visibility) {
        const v = payload.visibility;
        if (v.showBio !== undefined) visibility.showBio = !!v.showBio;
        if (v.showWebsite !== undefined) visibility.showWebsite = !!v.showWebsite;
        if (v.showLocation !== undefined) visibility.showLocation = !!v.showLocation;
        if (v.showSocials !== undefined) visibility.showSocials = !!v.showSocials;
      }

      // Theme
      if (payload.theme === 'light' || payload.theme === 'dark') {
        body.personalization = { theme: payload.theme };
      }

      // optional: Email-Snapshot aktualisieren
      const email = normStr(payload.email);
      if (email !== undefined) body.email = email;

      // profile sub-objects nur setzen, wenn etwas drin ist
      if (Object.keys(location).length) profile.location = location;
      if (Object.keys(socials).length) profile.socials = socials;
      if (Object.keys(visibility).length) profile.visibility = visibility;
      if (Object.keys(profile).length) body.profile = profile;

      // Wenn nichts zu schreiben ist -> keine DB-Operation
      if (Object.keys(body).length === 0) return;

      // Timestamps
      body.updatedAt = serverTimestamp();

      try {
        await setDoc(this.userDoc(uid), body, { merge: true });
      } catch (e: any) {
        console.error('saveUserData body ->', body);
        console.error('saveUserData Firestore error:', e?.code, e?.message, e);
        throw e;
      }
    });
  }

  /** Username Check gegen profiles_public (einfacher Availability-Check). */
  async isUsernameAvailable(username: string, myUid: string): Promise<boolean> {
    return runInInjectionContext(this.env, async () => {
      const key = (username ?? '').toString().trim().toLowerCase();
      if (!key) return true;

      // 1) Neu (case-insensitive): usernameKey
      const snapKey = await getDocs(
        query(collection(this.db as any, 'profiles_public'), where('usernameKey', '==', key))
      );
      if (!snapKey.empty) {
        return snapKey.docs.every((d) => d.id === myUid);
      }

      // 2) Legacy-Fallback: alte Doks hatten username meist schon lowercase
      const snapLegacy = await getDocs(
        query(collection(this.db as any, 'profiles_public'), where('username', '==', key))
      );
      if (snapLegacy.empty) return true;
      return snapLegacy.docs.every((d) => d.id === myUid);
    });
  }

  // ---------------- Settings (im Root unter "settings") ----------------

  /** Lädt /users/{uid} und merged robust mit Defaults. */
  async loadUserSettings(uid: string): Promise<UserSettingsModel> {
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