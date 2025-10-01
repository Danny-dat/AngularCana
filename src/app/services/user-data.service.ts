import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

export interface UserDataModel {
  displayName: string;
  phoneNumber: string;
  theme: 'light' | 'dark';
}

export interface UserSettingsModel {
  consumptionThreshold: number;
}

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private db = inject(Firestore);

  private userDoc(uid: string) {
    return doc(this.db, `users/${uid}`);
  }

  async loadUserData(uid: string): Promise<UserDataModel> {
    const snap = await getDoc(this.userDoc(uid));
    const data: any = snap.exists() ? snap.data() : {};
    return {
      displayName: data.displayName ?? '',
      phoneNumber: data.phoneNumber ?? '',
      theme: data?.personalization?.theme ?? 'light',
    };
    // (entspricht deinem alten user-data.service.js) 
  }

  async saveUserData(uid: string, payload: UserDataModel): Promise<void> {
    await setDoc(
      this.userDoc(uid),
      { displayName: payload.displayName, phoneNumber: payload.phoneNumber, personalization: { theme: payload.theme } },
      { merge: true }
    );
  }

  async loadUserSettings(uid: string): Promise<UserSettingsModel> {
    const snap = await getDoc(this.userDoc(uid));
    const data: any = snap.exists() ? snap.data() : {};
    return { consumptionThreshold: data?.settings?.consumptionThreshold ?? 3 };
  }

  async saveUserSettings(uid: string, settings: UserSettingsModel): Promise<void> {
    await setDoc(this.userDoc(uid), { settings }, { merge: true });
  }
}
