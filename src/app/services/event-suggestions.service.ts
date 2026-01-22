import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  deleteDoc,
  getDocs,
  limit,
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

  /** Suggested start date/time (stored as Firestore Timestamp / JS Date). */
  startAt?: any | null;

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
   * User: neuen Vorschlag speichern.
   * Optional: Admins per Direkt-Chat benachrichtigen (best effort, darf nicht das Speichern "kaputt" machen).
   */
  async createSuggestion(params: {
    createdBy: string;
    createdByName?: string | null;
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    startAt?: Date | null;
    note?: string | null;
  }) {
    const name = (params.name ?? '').trim();
    if (!params.createdBy || !name) throw new Error('INVALID');

    const address = (params.address ?? '').trim();
    const note = (params.note ?? '').trim();

    // 1) Vorschlag dokumentieren (für Admin-Übersicht) – das ist der "harte" Erfolg
    const ref = await addDoc(this.suggestionsCol, {
      name,
      address: address || null,
      lat: Number.isFinite(Number(params.lat)) ? Number(params.lat) : null,
      lng: Number.isFinite(Number(params.lng)) ? Number(params.lng) : null,
      startAt: params.startAt ?? null,
      note: note || null,
      createdBy: params.createdBy,
      createdByName: (params.createdByName ?? '').trim() || null,
      status: 'open' as SuggestionStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      eventId: null,
    } satisfies EventSuggestionDoc as any);

    // 2) Admin-Notify ist "best effort" (User darf /admins nicht listen)
    try {
      const adminsSnap = await getDocs(collection(this.fs, 'admins'));
      const adminUids = adminsSnap.docs.map((d) => d.id).filter(Boolean);

      const when = params.startAt ? new Date(params.startAt).toLocaleString('de-DE') : null;

      const header = `📌 Event-Vorschlag von ${params.createdByName || params.createdBy}`;
      const lines = [
        header,
        `Name: ${name}`,
        when ? `Wann: ${when}` : null,
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
    } catch (e) {
      console.warn('[event_suggestions] saved, but admin notify failed:', e);
    }

    return ref.id;
  }

  // ─────────────────────────────────────────────
  // Admin / Shared: Lesen + Status
  // ─────────────────────────────────────────────

  listenAll(): Observable<EventSuggestionRow[]> {
    // Safety: cap the live list so the admin UI doesn't grow without bounds (Spark-friendly)
    const q = query(this.suggestionsCol, orderBy('createdAt', 'desc'), limit(400));
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any),
    );
  }

  listenByStatus(status: SuggestionStatus, max = 200): Observable<EventSuggestionRow[]> {
    const q = query(
      this.suggestionsCol,
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any),
    );
  }

  listenOpen(): Observable<EventSuggestionRow[]> {
    const q = query(
      this.suggestionsCol,
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any),
    );
  }

  listenMine(uid: string): Observable<EventSuggestionRow[]> {
    const q = query(
      this.suggestionsCol,
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows: any[]) => (rows || []).map((r) => ({ ...r, id: r.id })) as any),
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

  async updateSuggestion(id: string, patch: Partial<EventSuggestionDoc>) {
    const ref = doc(this.fs, 'event_suggestions', id);
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() } as any);
  }

  async deleteSuggestion(id: string) {
    await deleteDoc(doc(this.fs, 'event_suggestions', id));
  }
}
