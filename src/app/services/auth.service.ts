/* istanbul ignore file */
// auth.service.ts
import { Injectable } from '@angular/core';
import {
  Auth,
  user,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { normalizeUnifiedUserName, normalizeUnifiedUserNameKey } from '../utils/user-name';

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;

  // Profil (optional – entspricht „Meine Daten“)
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  bio?: string;
  website?: string;
  city?: string;
  country?: string;
  birthday?: string; // YYYY-MM-DD
  gender?: 'unspecified' | 'male' | 'female' | 'diverse';

  instagram?: string;
  tiktok?: string;
  youtube?: string;
  discord?: string;
  telegram?: string;

  // Privacy (Public Profile Sync)
  showBio?: boolean;
  showWebsite?: boolean;
  showLocation?: boolean;
  showSocials?: boolean;

  // Settings
  theme?: 'light' | 'dark';
  consumptionThreshold?: number;
  notificationSound?: boolean;
  /** 0–100 (UI), wird intern zu 0..1 gespeichert */
  notificationVolumePct?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Cache: damit der Guard nicht bei jedem Klick Firestore fragt
  private accessOk: boolean | null = null;
  private lastAccessCheckMs = 0;
  private readonly ACCESS_CHECK_TTL_MS = 60_000; // 60s reicht völlig

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  get authState$(): Observable<User | null> {
    return user(this.auth);
  }

  private clearAccessCache() {
    this.accessOk = null;
    this.lastAccessCheckMs = 0;
  }

  async register(data: RegisterData): Promise<User> {
    const {
      email,
      password,
      displayName,
      phoneNumber,
      firstName,
      lastName,
      photoURL,
      bio,
      website,
      city,
      country,
      birthday,
      gender,
      instagram,
      tiktok,
      youtube,
      discord,
      telegram,
      showBio,
      showWebsite,
      showLocation,
      showSocials,
      theme,
      consumptionThreshold,
      notificationSound,
      notificationVolumePct,
    } = data;

    const cred = await createUserWithEmailAndPassword(this.auth, email, password);

    // Anzeigename + Username sind zusammengelegt (ein Handle)
    const baseName = (displayName ?? '').trim() || ((email.split('@')[0] ?? '').toString());
    let safeName = normalizeUnifiedUserName(baseName);
    if (!safeName) {
      // Fallback (sollte selten passieren)
      safeName = `user_${cred.user.uid.slice(0, 6)}`;
    }
    const safeKey = normalizeUnifiedUserNameKey(safeName);
    // optional: Avatar gleich mit setzen, damit Header/Chat/Public Profile sofort passt
    const safePhoto = (photoURL ?? '').toString().trim() || null;
    await updateProfile(cred.user, { displayName: safeName, photoURL: safePhoto });

    let initialTheme: 'light' | 'dark' = 'light';
    // 1) explizit aus Register-Form
    if (theme === 'dark' || theme === 'light') {
      initialTheme = theme;
    } else {
      // 2) Fallback: localStorage / System
      try {
        const local = (localStorage.getItem('pref-theme') || '').toLowerCase();
        if (local === 'dark' || local === 'light') {
          initialTheme = local as any;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          initialTheme = 'dark';
        }
      } catch {}
    }

    const normStr = (v: any) => {
      const s = (v ?? '').toString().trim();
      return s.length ? s : null;
    };
    const normUrl = (v: any) => {
      const raw = (v ?? '').toString().trim();
      if (!raw) return null;
      return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    };
    const clampInt = (n: any, min: number, max: number, fallback: number) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return fallback;
      return Math.max(min, Math.min(max, Math.trunc(x)));
    };
    const clamp01 = (n: any, fallback: number) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return fallback;
      return Math.max(0, Math.min(1, x));
    };

    const vis = {
      showBio: showBio !== false,
      showWebsite: showWebsite !== false,
      showLocation: showLocation !== false,
      showSocials: showSocials !== false,
    };

    const settings = {
      consumptionThreshold: clampInt(consumptionThreshold, 0, 20, 3),
      notificationSound: notificationSound !== false,
      notificationVolume: clamp01((notificationVolumePct ?? 30) / 100, 0.3),
    };

    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    await setDoc(userDocRef, {
      email,
      // legacy / compatibility:
      displayName: safeName,
      phoneNumber: phoneNumber || null,

      // neues Profil-Objekt (für „Social Media Profil“)
      profile: {
        displayName: safeName,
        username: safeName,
        usernameKey: safeKey,

        firstName: normStr(firstName),
        lastName: normStr(lastName),
        phoneNumber: normStr(phoneNumber),
        photoURL: safePhoto,

        bio: normStr(bio),
        website: normUrl(website),
        location: { city: normStr(city), country: normStr(country) },
        birthday: normStr(birthday),
        gender: (gender === 'male' || gender === 'female' || gender === 'diverse') ? gender : 'unspecified',
        socials: {
          instagram: normStr(instagram),
          tiktok: normStr(tiktok),
          youtube: normStr(youtube),
          discord: normStr(discord),
          telegram: normStr(telegram),
        },
        visibility: vis,
      },

      friends: [],
      settings,
      personalization: { theme: initialTheme },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });

    const publicDocRef = doc(this.firestore, `profiles_public/${cred.user.uid}`);

    const locationText = vis.showLocation
      ? [normStr(city), normStr(country)].filter(Boolean).join(', ') || null
      : null;

    const publicSocialsRaw = {
      instagram: normStr(instagram),
      tiktok: normStr(tiktok),
      youtube: normStr(youtube),
      discord: normStr(discord),
      telegram: normStr(telegram),
    };
    const hasAnySocial = Object.values(publicSocialsRaw).some((v) => !!v);

    await setDoc(publicDocRef, {
      displayName: safeName,
      username: safeName,
      usernameKey: safeKey,
      photoURL: safePhoto,
      bio: vis.showBio ? normStr(bio) : null,
      website: vis.showWebsite ? normUrl(website) : null,
      locationText,
      socials: vis.showSocials && hasAnySocial ? publicSocialsRaw : null,
      lastLocation: null,
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // nach Register ist Access ok
    this.accessOk = true;
    this.lastAccessCheckMs = Date.now();

    return cred.user;
  }

  // Login + Block-Check (mit Throw, wie du es schon nutzt)
  async login(email: string, password: string) {
    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username');
    } catch {}

    const cred = await signInWithEmailAndPassword(this.auth, email, password);

    // direkt nach Login prüfen: ist der User geblockt?
    const ok = await this.checkNotBlocked(cred.user.uid, { silent: false });
    // Blocked users sollen die "Account blocked"-Seite sehen können,
    // inkl. Grund/Dauer + Möglichkeit ein Ticket zu öffnen.
    if (!ok) return null as any;

    // nach Erfolg frischen Namen setzen (für Header)
    try {
      const display = cred.user.displayName ?? cred.user.email ?? 'User';
      localStorage.setItem('displayName', display);
    } catch {}

    return cred;
  }

  logout() {
    this.clearAccessCache();

    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username');
    } catch {}

    return signOut(this.auth);
  }

  resetPassword(email: string) {
    if (!email?.trim()) return Promise.reject(new Error('Bitte E-Mail eingeben.'));
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  /**
   * Block-Check mit Cache
   * - silent:true => keine Router/Snackbar Side-Effects (für Guards)
   * - silent:false => zeigt Meldung + redirect (für Login)
   */
  async checkNotBlocked(uid: string, opts?: { silent?: boolean }): Promise<boolean> {
    const silent = !!opts?.silent;

    const now = Date.now();
    if (this.accessOk === true && (now - this.lastAccessCheckMs) < this.ACCESS_CHECK_TTL_MS) {
      return true; // sofort, kein Netzwerk
    }

    try {
      // Access-Check auf profiles_public (Rules: read nur wenn !isBlocked(auth.uid))
      await getDoc(doc(this.firestore, 'profiles_public', uid));

      this.accessOk = true;
      this.lastAccessCheckMs = Date.now();
      return true;
    } catch (err: any) {
      // Permission denied = geblockt
      if (err?.code === 'permission-denied') {
        this.accessOk = false;
        this.lastAccessCheckMs = Date.now();

        if (!silent) {
          // WICHTIG: nicht automatisch ausloggen –
          // damit die Blocked-Seite den Grund/Dauer laden und ein Ticket öffnen kann.
          this.snack.open(
            'Dein Account ist gesperrt oder gebannt. Details findest du auf der nächsten Seite.',
            'OK',
            { duration: 6500 }
          );
          await this.router.navigateByUrl('/account-blocked');
        }

        return false;
      }

      // andere Fehler (net/timeout): im Guard lieber nicht alles blockieren
      if (silent) {
        return true;
      }

      await this.logout();
      this.snack.open('Login-Check fehlgeschlagen. Bitte erneut versuchen.', 'OK', { duration: 4000 });
      await this.router.navigateByUrl('/login');
      return false;
    }
  }
}
