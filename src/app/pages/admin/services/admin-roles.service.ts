/* istanbul ignore file */
import { Injectable, inject } from '@angular/core';
import {
  Firestore, doc, setDoc, deleteDoc, updateDoc, collection, addDoc
} from '@angular/fire/firestore';
import { arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private firestore = inject(Firestore);

  async grantAdmin(params: { targetUid: string; actorUid: string; note?: string }) {
    const { targetUid, actorUid, note } = params;

    // Admin-Recht: über /admins/{uid}
    await setDoc(
      doc(this.firestore, 'admins', targetUid),
      {
        createdAt: serverTimestamp(),
        createdBy: actorUid,
        note: (note ?? '').trim(),
      },
      { merge: true }
    );

    // Optional: zusätzlich im UserDoc pflegen (für UI/Später)
    await updateDoc(doc(this.firestore, 'users', targetUid), {
      roles: arrayUnion('admin'),
      updatedAt: serverTimestamp(),
    });

    await this.audit({
      action: 'GRANT_ADMIN',
      targetUid,
      actorUid,
      reason: (note ?? '').trim(),
      meta: {},
    });
  }

  async revokeAdmin(params: { targetUid: string; actorUid: string; reason?: string }) {
    const { targetUid, actorUid, reason } = params;

    await deleteDoc(doc(this.firestore, 'admins', targetUid));

    await updateDoc(doc(this.firestore, 'users', targetUid), {
      roles: arrayRemove('admin'),
      updatedAt: serverTimestamp(),
    });

    await this.audit({
      action: 'REVOKE_ADMIN',
      targetUid,
      actorUid,
      reason: (reason ?? '').trim(),
      meta: {},
    });
  }

  private async audit(entry: {
    action: string;
    targetUid: string;
    actorUid: string;
    reason: string;
    meta: any;
  }) {
    await addDoc(collection(this.firestore, 'audit_logs'), {
      timestamp: serverTimestamp(),
      action: entry.action,
      targetUid: entry.targetUid,
      actorUid: entry.actorUid,
      reason: entry.reason ?? '',
      meta: entry.meta ?? {},
    });
  }
}
