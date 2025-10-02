import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  runTransaction,
  updateDoc,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface EventItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  upvotes?: string[];
  downvotes?: string[];
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private fs = inject(Firestore);
  private col = collection(this.fs, 'events');

  /** Live-Stream aller Events (sortiert nach Name) */
  listen(): Observable<EventItem[]> {
    const q = query(this.col, orderBy('name'));
    return collectionData(q, { idField: 'id' }) as Observable<EventItem[]>;
  }

  /** Voting wie in deiner JS-Version: arrayUnion/arrayRemove */
  async voteEvent(eventId: string, uid: string, type: 'up'|'down'): Promise<void> {
    const ref = doc(this.fs, 'events', eventId);
    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Event not found');

      if (type === 'up') {
        tx.update(ref, { upvotes: arrayUnion(uid), downvotes: arrayRemove(uid) });
      } else {
        tx.update(ref, { downvotes: arrayUnion(uid), upvotes: arrayRemove(uid) });
      }
    });
  }
}
