// src/app/services/ad.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, retry, shareReplay, tap } from 'rxjs/operators';
import type { AdSlotConfig } from '../models/ad.types';

import { Firestore, doc, docData } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AdService {
  private afs = inject(Firestore, { optional: true });

  private readonly DEBUG = true;

  // pro Slot eigener Stream + State (damit KEIN Slot “untergeht”)
  private slotStreams = new Map<string, Observable<AdSlotConfig>>();
  private slotSubjects = new Map<string, BehaviorSubject<AdSlotConfig>>();

  private defaultFor(id: string): AdSlotConfig {
    return {
      id,
      imgUrl: `/assets/promo/${id}/banner.svg`,
      alt: id,
      linkEnabled: true,
      linkUrl: null,
      activeExt: 'svg',
    };
  }

  slot$(id: string): Observable<AdSlotConfig> {
    // schon vorhanden -> zurückgeben
    const existing = this.slotStreams.get(id);
    if (existing) return existing;

    const subject = new BehaviorSubject<AdSlotConfig>(this.defaultFor(id));
    this.slotSubjects.set(id, subject);

    // Firestore Watch NUR für diesen Slot
    if (this.afs) {
      const ref = doc(this.afs, 'adSlots', id);

      (docData(ref) as any).pipe(
        // WICHTIG: Fehler NICHT verstecken -> sonst glaubst du es lädt “nicht”
        catchError((err) => {
          console.error('[AdService] adSlots read failed for', id, err);
          return of(null); // lässt Stream weiterleben
        }),
        // wenn Firestore beim Start kurz zickt: wiederholen
        retry({ delay: 1500 }),
        map((d: any) => {
          if (!d) return null;

          const next: Partial<AdSlotConfig> = {};

          if ('linkEnabled' in d) next.linkEnabled = typeof d.linkEnabled === 'boolean' ? d.linkEnabled : true;
          if ('linkUrl' in d) next.linkUrl = typeof d.linkUrl === 'string' ? d.linkUrl : null;
          if ('activeExt' in d) next.activeExt = typeof d.activeExt === 'string' ? d.activeExt : undefined;

          // optional imgUrl aus Firestore
          if ('imgUrl' in d && typeof d.imgUrl === 'string' && d.imgUrl.length) next.imgUrl = d.imgUrl;

          return next;
        }),
        tap((patch) => {
          if (!patch) return;
          const prev = subject.value;
          const merged: AdSlotConfig = { ...prev, ...patch, id: prev.id };
          subject.next(merged);
          if (this.DEBUG) console.debug('[AdService] slot patch', id, patch, '=>', merged);
        }),
      ).subscribe();
    }

    const stream$ = subject.asObservable().pipe(
      tap((cfg) => this.DEBUG && console.debug('[AdService] slot update:', id, cfg)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.slotStreams.set(id, stream$);
    return stream$;
  }
}
