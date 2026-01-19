/* istanbul ignore file */
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { Observable } from 'rxjs';

export type AdminRow = {
  uid: string;
  createdAt?: any;
  createdBy?: string;
  note?: string;
};

@Injectable({ providedIn: 'root' })
export class AdminAdminsService {
  private firestore = inject(Firestore);

  admins$(): Observable<AdminRow[]> {
    return collectionData(collection(this.firestore, 'admins'), { idField: 'uid' }) as Observable<AdminRow[]>;
  }

async addAdmin(params: { uid: string; createdBy: string; note?: string }) {
  const uid = params.uid.trim();
  if (!uid) return;

  await setDoc(
    doc(this.firestore, 'admins', uid),
    {
      createdAt: serverTimestamp(),
      createdBy: params.createdBy,
      note: (params.note ?? '').trim(),
    },
    { merge: true }
  );
}

  async removeAdmin(uid: string) {
    await deleteDoc(doc(this.firestore, 'admins', uid));
  }
}
