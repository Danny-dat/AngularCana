import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { ChatService } from './chat.services';

export type SuggestionStatus = 'open' | 'accepted' | 'resolved' | 'rejected';

export interface EventSuggestionDoc {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;

  createdBy: string;
  createdByName?: string | null;

  status: SuggestionStatus;
  createdAt?: any;
  updatedAt?: any;
  eventId?: string | null;
}

export interface EventSuggestionRow extends EventSuggestionDoc {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class EventSuggestionsService {
  private fs = inject(Firestore);
  private chat = inject(ChatService);

  private suggestionsCol = collection(this.fs, 'event_suggestions');

  /**
   * User: neuen Vorschlag speichern + Admins per Direkt-Chat benachrichtigen.
   * Spark-friendly: keine Cloud Functions nötig.
   */
  async createSuggestion(params: {
    createdBy: string;
    createdByName?: string | null;
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    note?: string | null;
  }) {
    const name = (params.name ?? '').trim();
    if (!params.createdBy || !name) throw new Error('INVALID');

    const address = (params.address ?? '').trim();
    const note = (params.note ?? '').trim();

    // 1) Vorschlag dokumentieren (für Admin-Übersicht)
    const ref = await addDoc(this.suggestionsCol, {
      name,
      address: address || null,
      lat: Number.isFinite(Number(params.lat)) ? Number(params.lat) : null,
      lng: Number.isFinite(Number(params.lng)) ? Number(params.lng) : null,
      note: note || null,
      createdBy: params.createdBy,
      createdByName: (params.createdByName ?? '').trim() || null,
      status: 'open' as SuggestionStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      eventId: null,
    } satisfies EventSuggestionDoc as any);

    // 2) Admin-Uids laden
    const adminsSnap = await getDocs(collection(this.fs, 'admins'));
    const adminUids = adminsSnap.docs.map((d) => d.id).filter(Boolean);

    // 3) Direkt-Nachricht an alle Admins (inkl. Notification)
    const header = `📌 Event-Vorschlag von ${params.createdByName || params.createdBy}`;
    const lines = [
      header,
      `Name: ${name}`,
      address ? `Adresse: ${address}` : null,
      note ? `Notiz: ${note}` : null,
      `Suggestion-ID: ${ref.id}`,
    ].filter(Boolean);
    const message = lines.join('\n');

    // sequenziell, damit Spark nicht zu viele Writes "gleichzeitig" bekommt
    for (const adminUid of adminUids) {
      if (!adminUid || adminUid === params.createdBy) continue;
      await this.chat.sendDirect({
        fromUid: params.createdBy,
        toUid: adminUid,
        text: message,
        senderName: params.createdByName || undefined,
      });
    }

    return ref.id;
  }

  // ─────────────────────────────────────────────
  // Admin / Shared: Lesen + Status
  // ─────────────────────────────────────────────

  listenAll(): Observable<EventSuggestionRow[]> {
    const q = query(this.suggestionsCol, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any)
    );
  }

  listenOpen(): Observable<EventSuggestionRow[]> {
    const q = query(
      this.suggestionsCol,
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any)
    );
  }

  listenMine(uid: string): Observable<EventSuggestionRow[]> {
    const q = query(
      this.suggestionsCol,
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any)
    );
  }

  async setStatus(id: string, status: SuggestionStatus, patch?: Partial<EventSuggestionDoc>) {
    const ref = doc(this.fs, 'event_suggestions', id);
    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
      ...(patch ?? {}),
    } as any);
  }
}
