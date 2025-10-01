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
import { Observable } from 'rxjs';

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private auth: Auth, private firestore: Firestore) {}

  get authState$(): Observable<User | null> {
    return user(this.auth);
  }

  async register({ email, password, displayName, phoneNumber }: RegisterData): Promise<User> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);

    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    // System-/lokale Präferenz respektieren
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
      personalization: { theme: initialTheme }, // <-- hier Variable verwenden
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

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }
  logout() {
    return signOut(this.auth);
  }
  resetPassword(email: string) {
    if (!email?.trim()) return Promise.reject(new Error('Bitte E-Mail eingeben.'));
    return sendPasswordResetEmail(this.auth, email.trim());
  }
}
