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
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { getDoc } from 'firebase/firestore';
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
  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  get authState$(): Observable<User | null> {
    return user(this.auth);
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

    return cred.user;
  }

  //Login + Block-Check
  async login(email: string, password: string) {
    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username');
    } catch {}

    const cred = await signInWithEmailAndPassword(this.auth, email, password);

    //direkt nach Login prüfen: ist der User geblockt?
    const ok = await this.assertNotBlocked(cred.user.uid);
    if (!ok) throw new Error('ACCOUNT_BLOCKED');

    // nach Erfolg frischen Namen setzen (für Header)
    try {
      const display = cred.user.displayName ?? cred.user.email ?? 'User';
      localStorage.setItem('displayName', display);
    } catch {}

    return cred;
  }

  logout() {
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

  // =========================
  // Block Check via Firestore Rules
  // =========================
  private async assertNotBlocked(uid: string): Promise<boolean> {
    try {
      //Access-Check auf profiles_public (Rules: read nur wenn !isBlocked(auth.uid))
      await getDoc(doc(this.firestore as any, 'profiles_public', uid));
      return true;
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        await this.logout();

        this.snack.open(
          'Dein Account ist gesperrt oder gebannt. Bitte kontaktiere den Admin.',
          'OK',
          { duration: 6000 }
        );

        await this.router.navigateByUrl('/account-blocked');
        return false;
      }

      // fallback
      await this.logout();
      this.snack.open('Login-Check fehlgeschlagen. Bitte erneut versuchen.', 'OK', { duration: 4000 });
      await this.router.navigateByUrl('/login');
      return false;
    }
  }
}
