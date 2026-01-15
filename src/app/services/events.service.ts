import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  doc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

export interface EventItem {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  upvotes?: string[];
  downvotes?: string[];
  [key: string]: any; // weitere Felder erlaubt
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private fs = inject(Firestore);
  private col = collection(this.fs, 'events');

  /** Robust: normalisiert verschiedenste Feld-Varianten zu lat/lng:number */
  listen(): Observable<EventItem[]> {
    const q = query(this.col, orderBy('name'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) =>
        (docs || [])
          .map((doc) => this.normalizeEvent(doc))
          // nur valide Koordinaten durchlassen
          .filter((e): e is EventItem => Number.isFinite(e.lat) && Number.isFinite(e.lng))
      )
    );
  }

  
  async voteEvent(eventId: string, uid: string, type: 'up' | 'down'): Promise<void> {
    const ref = doc(this.fs, 'events', eventId);

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Event not found');

      const data = snap.data() as any;
      const up = new Set<string>((data?.upvotes ?? []).map(String));
      const down = new Set<string>((data?.downvotes ?? []).map(String));

      if (type === 'up') {
        if (up.has(uid)) {
          // entliken
          tx.update(ref, { upvotes: arrayRemove(uid) });
        } else {
          tx.update(ref, { upvotes: arrayUnion(uid), downvotes: arrayRemove(uid) });
        }
      } else {
        if (down.has(uid)) {
          // neutralisieren
          tx.update(ref, { downvotes: arrayRemove(uid) });
        } else {
          tx.update(ref, { downvotes: arrayUnion(uid), upvotes: arrayRemove(uid) });
        }
      }
    });
  }

  // ─────────────────────────────────────────────
  // Admin: CRUD
  // ─────────────────────────────────────────────

  async createEvent(params: { name: string; address?: string | null; lat: number; lng: number; [k: string]: any }) {
    const name = (params.name ?? '').trim();
    if (!name) throw new Error('NAME_REQUIRED');

    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('COORDS_REQUIRED');

    const payload: any = {
      name,
      address: (params.address ?? '').toString().trim() || null,
      lat,
      lng,
      upvotes: [],
      downvotes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // optionale zusätzliche Felder
    for (const k of Object.keys(params)) {
      if (['name', 'address', 'lat', 'lng'].includes(k)) continue;
      payload[k] = (params as any)[k];
    }

    const ref = await addDoc(this.col, payload);
    return ref.id;
  }

  async updateEvent(eventId: string, patch: Partial<EventItem>) {
    const ref = doc(this.fs, 'events', eventId);
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() } as any);
  }

  async deleteEvent(eventId: string) {
    await deleteDoc(doc(this.fs, 'events', eventId));
  }

  // ---------- Helpers ----------

  private normalizeEvent(doc: any): EventItem {
    const { lat, lng } = this.extractLatLng(doc);
    return {
      id: doc.id,
      name: doc.name ?? '(ohne Name)',
      address: doc.address ?? '',
      lat,
      lng,
      upvotes: Array.isArray(doc.upvotes) ? doc.upvotes.map(String) : [],
      downvotes: Array.isArray(doc.downvotes) ? doc.downvotes.map(String) : [],
      ...doc,
    };
  }

  private extractLatLng(doc: any): { lat: number; lng: number } {
    // direkte Felder
    let lat = doc?.lat ?? doc?.Lat ?? doc?.latitude ?? doc?.Latitude;
    let lng = doc?.lng ?? doc?.Lng ?? doc?.long ?? doc?.Long ?? doc?.longitude ?? doc?.Longitude;

    // verschachtelt / alternative Felder
    const loc = doc?.location ?? doc?.Location ?? doc?.position ?? doc?.coords ?? doc?.Coord;

    if (lat == null && lng == null && loc != null) {
      if (Array.isArray(loc) && loc.length >= 2) {
        lat = loc[0]; lng = loc[1];
      } else {
        lat = loc?.lat ?? loc?.Lat ?? loc?.latitude ?? loc?.Latitude ?? loc?._lat ?? loc?.y;
        lng = loc?.lng ?? loc?.Lng ?? loc?.long ?? loc?.Long ?? loc?.longitude ?? loc?.Longitude ?? loc?._long ?? loc?.x;

        if (typeof loc?.toJSON === 'function') {
          const j = loc.toJSON();
          lat ??= j?.lat ?? j?._lat;
          lng ??= j?.lng ?? j?._long;
        }
      }
    }

    const nLat = Number(lat);
    const nLng = Number(lng);
    return {
      lat: Number.isFinite(nLat) ? nLat : NaN,
      lng: Number.isFinite(nLng) ? nLng : NaN,
    };
  }
}
