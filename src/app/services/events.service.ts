import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  arrayRemove,
  arrayUnion,
  collection,
  collectionData,
  query,
  orderBy,
  deleteDoc,
  doc,
  getDoc,

  runTransaction,

  setDoc,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from '@angular/fire/storage';
import { Observable, map } from 'rxjs';


import type { EventItem, EventLocationMeta } from '../models/event.model';

export type { EventItem } from '../models/event.model';

export interface EventMutationPayload {
  name: string;
  startTimestamp?: number | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}


type FirestoreEventData = {
  name: string;
  startTimestamp: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  location: EventLocationMeta | null;
  upvotes?: string[];
  downvotes?: string[];
  

  bannerUrl?: string | null;
  bannerStoragePath?: string | null;
};

@Injectable({ providedIn: 'root' })
export class EventsService {

  private readonly fs = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly col = collection(this.fs, 'events');

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

  
  async createEvent(data: EventMutationPayload, bannerFile?: File | null): Promise<string> {
    const refDoc = doc(this.col);
    const payload = this.buildMutationPayload(data);
    payload.upvotes ??= [];
    payload.downvotes ??= [];

    if (bannerFile) {
      const upload = await this.uploadBanner(refDoc.id, bannerFile);
      payload.bannerUrl = upload.url;
      payload.bannerStoragePath = upload.path;
    }

    await setDoc(refDoc, payload);
    return refDoc.id;
  }

  async updateEvent(
    id: string,
    data: EventMutationPayload,
    options?: { bannerFile?: File | null; current?: EventItem | null; removeBanner?: boolean }
  ): Promise<void> {
    const refDoc = doc(this.fs, 'events', id);
    const payload = this.buildMutationPayload(data);
    const updates: Partial<FirestoreEventData> = { ...payload };

    let current = options?.current ?? null;
    if (!current) {
      const snap = await getDoc(refDoc);
      current = snap.exists() ? ({ ...snap.data(), id } as EventItem) : null;
    }

    if (options?.removeBanner) {
      if (current?.bannerStoragePath) {
        await this.safeDeleteBanner(current.bannerStoragePath);
      }
      updates.bannerUrl = null;
      updates.bannerStoragePath = null;
    } else if (options?.bannerFile) {
      if (current?.bannerStoragePath) {
        await this.safeDeleteBanner(current.bannerStoragePath);
      }
      const upload = await this.uploadBanner(id, options.bannerFile);
      updates.bannerUrl = upload.url;
      updates.bannerStoragePath = upload.path;
    }

    await setDoc(refDoc, updates, { merge: true });
  }

  async deleteEvent(event: Pick<EventItem, 'id' | 'bannerStoragePath'>): Promise<void> {
    const refDoc = doc(this.fs, 'events', event.id);
    await deleteDoc(refDoc);

    if (event.bannerStoragePath) {
      await this.safeDeleteBanner(event.bannerStoragePath);
    }
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

  // ---------- Helpers ----------

  private normalizeEvent(doc: any): EventItem {
    const { lat, lng } = this.extractLatLng(doc);
    const location = this.normalizeLocation(doc, lat, lng);
    const startTimestamp = this.normalizeTimestamp(
      doc.startTimestamp ?? doc.startAt ?? doc.start ?? doc.date
    );

    const upvotes = Array.isArray(doc.upvotes) ? doc.upvotes.map(String) : [];
    const downvotes = Array.isArray(doc.downvotes) ? doc.downvotes.map(String) : [];

    const bannerUrl = doc.bannerUrl ?? doc.bannerURL ?? doc.banner ?? null;
    const bannerStoragePath = doc.bannerStoragePath ?? doc.bannerPath ?? null;
    const address = location?.address ?? doc.address ?? '';

    return {
      ...doc,
      id: doc.id,
      name: doc.name ?? '(ohne Name)',
      
      address,
      lat,
      lng,

      startTimestamp: startTimestamp ?? undefined,
      bannerUrl,
      bannerStoragePath,
      location: location ?? undefined,
      upvotes,
      downvotes,
    } as EventItem;
  }

  private extractLatLng(doc: any): { lat: number; lng: number } {
    // direkte Felder
    let lat = doc?.lat ?? doc?.Lat ?? doc?.latitude ?? doc?.Latitude;
    let lng = doc?.lng ?? doc?.Lng ?? doc?.long ?? doc?.Long ?? doc?.longitude ?? doc?.Longitude;

    // verschachtelt / alternative Felder
    const loc = doc?.location ?? doc?.Location ?? doc?.position ?? doc?.coords ?? doc?.Coord;

    if (lat == null && lng == null && loc != null) {
      if (Array.isArray(loc) && loc.length >= 2) {
       
        lat = loc[0];
        lng = loc[1];
      } else {
        lat = loc?.lat ?? loc?.Lat ?? loc?.latitude ?? loc?.Latitude ?? loc?._lat ?? loc?.y;
       
        lng =
          loc?.lng ??
          loc?.Lng ??
          loc?.long ??
          loc?.Long ??
          loc?.longitude ??
          loc?.Longitude ??
          loc?._long ??
          loc?.x;

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

  private normalizeLocation(doc: any, lat: number, lng: number): EventLocationMeta | undefined {
    const loc = doc?.location ?? doc?.Location ?? {};
    const address =
      doc?.address ??
      loc?.address ??
      loc?.Address ??
      loc?.street ??
      loc?.Street ??
      loc?.name ??
      null;

    const location: EventLocationMeta = {};

    if (address != null && String(address).trim() !== '') {
      location.address = String(address).trim();
    }

    if (Number.isFinite(lat)) {
      location.lat = lat;
    }

    if (Number.isFinite(lng)) {
      location.lng = lng;
    }

    return Object.keys(location).length ? location : undefined;
  }

  private normalizeTimestamp(value: any): number | undefined {
    if (value == null) return undefined;

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    if (typeof value?.seconds === 'number') {
      const nanos = typeof value?.nanoseconds === 'number' ? value.nanoseconds : 0;
      return value.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }

    if (typeof value?.toDate === 'function') {
      const date = value.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    return undefined;
  }

  private buildMutationPayload(data: EventMutationPayload): FirestoreEventData {
    const name = data.name?.trim();
    if (!name) {
      throw new Error('Name ist erforderlich');
    }

    const lat = this.toNumberOrNull(data.lat);
    const lng = this.toNumberOrNull(data.lng);
    const address = data.address?.trim() ?? null;
    const startTimestamp =
      data.startTimestamp != null && Number.isFinite(data.startTimestamp)
        ? Math.trunc(data.startTimestamp)
        : null;

    const location: EventLocationMeta = {};
    if (address) {
      location.address = address;
    }
    if (lat != null) {
      location.lat = lat;
    }
    if (lng != null) {
      location.lng = lng;
    }

    const payload: FirestoreEventData = {
      name,
      startTimestamp,
      address,
      lat,
      lng,
      location: Object.keys(location).length ? location : null,
    };

    return payload;
  }

  private toNumberOrNull(value: number | string | null | undefined): number | null {
    if (value == null || value === '') return null;
    const num = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(num) ? num : null;
  }

  private async uploadBanner(eventId: string, file: File): Promise<{ url: string; path: string }> {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `events/${eventId}/${Date.now()}-${sanitizedName}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file, file.type ? { contentType: file.type } : undefined);
    const url = await getDownloadURL(storageRef);
    return { url, path };
  }

  private async safeDeleteBanner(path: string): Promise<void> {
    try {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('Failed to delete banner', err);
    }
  }
}