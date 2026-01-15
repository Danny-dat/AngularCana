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
  getDoc, // AngularFire getDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
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

  async register({ email, password, displayName, phoneNumber }: RegisterData): Promise<User> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);

    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    let initialTheme: 'light' | 'dark' = 'light';
    try {
      const local = (localStorage.getItem('pref-theme') || '').toLowerCase();
      if (local === 'dark' || local === 'light') {
        initialTheme = local as any;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark';
      }
    } catch {}

    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    await setDoc(userDocRef, {
      email,
      displayName: displayName?.trim() || null,
      phoneNumber: phoneNumber || null,
      friends: [],
      settings: { consumptionThreshold: 3 },
      personalization: { theme: initialTheme },
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });

    const publicDocRef = doc(this.firestore, `profiles_public/${cred.user.uid}`);
    await setDoc(publicDocRef, {
      displayName: displayName?.trim() || null,
      username: null,
      photoURL: null,
      lastLocation: null,
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
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
    if (!ok) throw new Error('ACCOUNT_BLOCKED');

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
          await this.logout();
          this.snack.open(
            'Dein Account ist gesperrt oder gebannt. Bitte kontaktiere den Admin.',
            'OK',
            { duration: 6000 }
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
