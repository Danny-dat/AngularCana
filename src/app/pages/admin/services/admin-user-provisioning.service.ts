import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { normalizeUnifiedUserName, normalizeUnifiedUserNameKey } from '../../../utils/user-name';

@Injectable({ providedIn: 'root' })
export class AdminUserProvisioningService {
  private primaryApp = inject(FirebaseApp);
  private primaryAuth = inject(Auth);
  private firestore = inject(Firestore);

  async createUser(params: {
    email: string;
    displayName?: string;
    sendPasswordReset?: boolean;
    actorUid: string;
  }): Promise<{ uid: string }> {
    const email = params.email.trim().toLowerCase();
    const rawName = (params.displayName ?? '').trim();
    const sendReset = params.sendPasswordReset ?? true;

    const secondary = initializeApp(this.primaryApp.options, `secondary-${Date.now()}`);
    const auth2 = getAuth(secondary);
    const fs2 = getFirestore(secondary);

    try {
      const password = this.randomPassword();
      const cred = await createUserWithEmailAndPassword(auth2, email, password);
      const uid = cred.user.uid;

      const baseName = rawName || (email.split('@')[0] ?? '').toString();
      const displayName = normalizeUnifiedUserName(baseName) || `user_${uid.slice(0, 6)}`;
      const usernameKey = normalizeUnifiedUserNameKey(displayName);

      // /users/{uid} (als der neue User selbst -> Rules passen)
      await setDoc(doc(fs2, 'users', uid), {
        profile: { displayName, username: displayName, usernameKey },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // /profiles_public/{uid} (optional, aber nice fürs Admin-Listing)
      await setDoc(doc(fs2, 'profiles_public', uid), {
        displayName,
        username: displayName,
        usernameKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Optional: Passwort reset mail (der User setzt sein eigenes Passwort)
      if (sendReset) {
        await sendPasswordResetEmail(this.primaryAuth, email);
      }

      // Audit (als Admin)
      await addDoc(collection(this.firestore, 'audit_logs'), {
        timestamp: serverTimestamp(),
        action: 'CREATE_USER',
        targetUid: uid,
        actorUid: params.actorUid,
        reason: '',
        meta: { email },
      });

      return { uid };
    } finally {
      await signOut(auth2).catch(() => {});
      await deleteApp(secondary).catch(() => {});
    }
  }

  private randomPassword(): string {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    // URL-safe-ish
    return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) + '!';
  }
}
