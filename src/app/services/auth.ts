import { Injectable } from '@angular/core';
import {
  Auth,
  user,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Interface für die Registrierungsdaten
export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // AngularFire stellt die Firebase-Dienste per "Dependency Injection" bereit
  constructor(private auth: Auth, private firestore: Firestore) { }

  /**
   * Ein Observable, das den aktuellen Anmeldestatus des Benutzers streamt.
   * Gibt den User bei Login und null bei Logout aus.
   */
  get authState$(): Observable<User | null> {
    return user(this.auth);
  }

  /**
   * Registriert einen neuen Benutzer, aktualisiert sein Auth-Profil
   * und legt die initialen Dokumente in Firestore an.
   */
  async register({ email, password, displayName, phoneNumber }: RegisterData): Promise<User> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);

    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    // PRIVATES Benutzerprofil in users/{uid}
    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    await setDoc(userDocRef, {
      email,
      displayName: displayName?.trim() || null,
      phoneNumber: phoneNumber || null,
      friends: [],
      settings: { consumptionThreshold: 3 },
      personalization: { theme: 'light' },
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });

    // ÖFFENTLICHES Profil in profiles_public/{uid}
    const publicDocRef = doc(this.firestore, `profiles_public/${cred.user.uid}`);
    await setDoc(publicDocRef, {
      displayName: displayName?.trim() || null,
      username: null,
      photoURL: null,
      lastLocation: null,
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    // Optional: E-Mail Verifikation senden
    // await sendEmailVerification(cred.user);

    return cred.user;
  }

  /**
   * Meldet einen Benutzer mit E-Mail und Passwort an.
   */
  login(email, password) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Meldet den aktuellen Benutzer ab.
   */
  logout() {
    return signOut(this.auth);
  }

  /**
   * Sendet eine E-Mail zum Zurücksetzen des Passworts.
   */
  resetPassword(email: string) {
    const e = (email || '').trim();
    if (!e) return Promise.reject(new Error('Bitte E-Mail eingeben.'));
    return sendPasswordResetEmail(this.auth, e);
  }
}
