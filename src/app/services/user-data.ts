import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { updateProfile } from '@angular/fire/auth';
import { Auth } from '@angular/fire/auth';

// Interfaces für unsere Datenstrukturen
export interface UserData {
  displayName: string;
  phoneNumber: string;
  theme: 'light' | 'dark';
}

export interface UserSettings {
  consumptionThreshold: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {

  constructor(private firestore: Firestore, private auth: Auth) { }

  /**
   * Lädt die "Meine Daten"-Felder aus dem privaten user-Dokument.
   */
  async loadUserData(uid: string): Promise<UserData> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      return { displayName: '', phoneNumber: '', theme: 'light' };
    }
    const data = docSnap.data();
    return {
      displayName: data['displayName'] || '',
      phoneNumber: data['phoneNumber'] || '',
      theme: data['personalization']?.theme || 'light'
    };
  }

  /**
   * Speichert die "Meine Daten"-Felder und aktualisiert parallel
   * das öffentliche Profil sowie das Auth-Profil.
   */
  async saveUserData(uid: string, data: UserData): Promise<void> {
    // 1. Privates Dokument aktualisieren
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await setDoc(userDocRef, {
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      personalization: { theme: data.theme }
    }, { merge: true });

    // 2. Öffentliches Profil aktualisieren
    const publicProfileRef = doc(this.firestore, `profiles_public/${uid}`);
    await setDoc(publicProfileRef, {
      displayName: data.displayName
    }, { merge: true });

    // 3. Firebase Auth Profil aktualisieren (damit der Name überall konsistent ist)
    if (this.auth.currentUser && this.auth.currentUser.uid === uid) {
      await updateProfile(this.auth.currentUser, { displayName: data.displayName });
    }
  }

  /**
   * Lädt die App-Einstellungen eines Nutzers.
   */
  async loadUserSettings(uid: string): Promise<UserSettings> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      return { consumptionThreshold: 3 }; // Standardwert
    }
    const data = docSnap.data();
    return {
      consumptionThreshold: data['settings']?.consumptionThreshold ?? 3
    };
  }

  /**
   * Speichert die App-Einstellungen eines Nutzers.
   */
  saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    return setDoc(userDocRef, { settings }, { merge: true });
  }
}