import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private db = inject(Firestore);

  private pubDoc(uid: string) {
    return doc(this.db, `profiles_public/${uid}`);
  }

  /** optional – falls du beim Login initial befüllen willst */
  async ensurePublicProfileOnLogin(user: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  }) {
    const ref = this.pubDoc(user.uid);
    const snap = await getDoc(ref);

    const name =
      user.displayName ||
      (user.email ? user.email.split('@')[0] : null) ||
      `User-${user.uid.slice(0, 6)}`;

    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          displayName: name,
          photoURL: user.photoURL || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } else if (!(snap.data() as any)?.displayName && name) {
      await setDoc(ref, { displayName: name, updatedAt: new Date() }, { merge: true });
    }
  }

  /**
   * Aktualisiert das "öffentliche" Profil (wird von Social/Friends/Chat gelesen)
   * Achtung: Bitte hier keine sensiblen Felder speichern.
   */
  async updatePublicProfile(
    uid: string,
    patch: {
      displayName?: string | null;
      username?: string | null;
      photoURL?: string | null;
      bio?: string | null;
      website?: string | null;
      locationText?: string | null;
      socials?: any;
    }
  ) {
    await setDoc(this.pubDoc(uid), { ...patch, updatedAt: new Date() }, { merge: true });
  }
}
