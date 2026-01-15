import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc, setDoc, deleteDoc, collection, addDoc } from '@angular/fire/firestore';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export type ModerationAction = 'BAN' | 'LOCK' | 'UNLOCK' | 'SOFT_DELETE' | 'RESTORE';

@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private firestore = inject(Firestore);

  async banUser(params: { targetUid: string; actorUid: string; reason: string; until?: Date | null }) {
    const { targetUid, actorUid, reason, until } = params;

    await setDoc(doc(this.firestore, 'banlist', targetUid), {
      type: 'ban',
      until: until ? Timestamp.fromDate(until) : null,
      reason: reason ?? '',
      createdAt: serverTimestamp(),
      createdBy: actorUid,
    }, { merge: true });

    await this.audit({ action: 'BAN', targetUid, actorUid, reason, meta: { until: until ? until.toISOString() : null } });
  }

  async lockUser(params: { targetUid: string; actorUid: string; reason: string; until: Date }) {
    const { targetUid, actorUid, reason, until } = params;

    await setDoc(doc(this.firestore, 'banlist', targetUid), {
      type: 'lock',
      until: Timestamp.fromDate(until),
      reason: reason ?? '',
      createdAt: serverTimestamp(),
      createdBy: actorUid,
    }, { merge: true });

    await this.audit({ action: 'LOCK', targetUid, actorUid, reason, meta: { until: until.toISOString() } });
  }

  async unlockUser(params: { targetUid: string; actorUid: string; reason?: string }) {
    const { targetUid, actorUid, reason } = params;

    await deleteDoc(doc(this.firestore, 'banlist', targetUid));

    await this.audit({ action: 'UNLOCK', targetUid, actorUid, reason: reason ?? '', meta: {} });
  }

  async softDeleteUser(params: { targetUid: string; actorUid: string; reason: string }) {
    const { targetUid, actorUid, reason } = params;

    await updateDoc(doc(this.firestore, 'users', targetUid), {
      'status.deletedAt': serverTimestamp(),
      'status.deletedBy': actorUid,
      'status.deleteReason': reason ?? '',
    });

    await this.audit({ action: 'SOFT_DELETE', targetUid, actorUid, reason, meta: {} });
  }

  async restoreUser(params: { targetUid: string; actorUid: string; reason?: string }) {
    const { targetUid, actorUid, reason } = params;

    await updateDoc(doc(this.firestore, 'users', targetUid), {
      'status.deletedAt': null,
      'status.deletedBy': null,
      'status.deleteReason': null,
    });

    await this.audit({ action: 'RESTORE', targetUid, actorUid, reason: reason ?? '', meta: {} });
  }

  private async audit(entry: { action: ModerationAction; targetUid: string; actorUid: string; reason: string; meta: any }) {
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
