/* istanbul ignore file */
import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { normalizeUnifiedUserNameKey } from '../utils/user-name';

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

    const key = normalizeUnifiedUserNameKey(name);

    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          displayName: name,
          username: name,
          usernameKey: key,
          photoURL: user.photoURL || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } else {
      // Falls Felder fehlen, ergänzen wir sie best-effort
      const data: any = snap.data() as any;
      const patch: any = { updatedAt: new Date() };
      if (!data?.displayName && name) patch.displayName = name;
      if (!data?.username && name) patch.username = name;
      if (!data?.usernameKey && key) patch.usernameKey = key;
      if (Object.keys(patch).length > 1) {
        await setDoc(ref, patch, { merge: true });
      }
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
      usernameKey?: string | null;
      photoURL?: string | null;
      bio?: string | null;
      website?: string | null;
      locationText?: string | null;
      socials?: any;
    }
  ) {
    // Falls username/displayName gesetzt werden, aber usernameKey fehlt, ergänzen wir ihn automatisch.
    const p: any = { ...patch };
    if (!p.usernameKey) {
      const base = (p.username ?? p.displayName ?? '').toString();
      if (base) p.usernameKey = normalizeUnifiedUserNameKey(base);
    }
    await setDoc(this.pubDoc(uid), { ...p, updatedAt: new Date() }, { merge: true });
  }
}
