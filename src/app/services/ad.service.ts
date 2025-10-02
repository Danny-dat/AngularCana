// src/app/services/ad.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, map } from 'rxjs';
import type { AdSlotConfig } from '../models/ad.types';

@Injectable({ providedIn: 'root' })
export class AdService {
  private http = inject(HttpClient);

  /** Welche Slots existieren (IDs müssen zu deinen <promo-slot slotId="…"> passen) */
  private readonly slotIds = ['dashboard-werbung1', 'login-werbung1', 'thc-werbung1'];

  /** Laufzeit-Overrides liegen hier (per FTP/SCP etc.), z. B. /media/<slotId>/banner.svg */
  private readonly OVERRIDE_BASE = '/media';

  /** Reihenfolge, in der wir Formate testen */
  private readonly EXT_ORDER = ['svg', 'webp', 'png', 'jpg'] as const;

  /** App-weiter State der Slots */
  private slots$ = new BehaviorSubject<Record<string, AdSlotConfig>>({});

  /** Beim App-Start aufrufen (z. B. in AppComponent.ngOnInit()) */
  init(): void {
    // 1) Defaults aus assets (du kannst hier jederzeit auf .svg wechseln)
    const defaults: AdSlotConfig[] = [
      { id: 'dashboard-werbung1', imgUrl: 'assets/promo/dashboard-werbung1/banner.svg', alt: 'dashboard-werbung1' },
      { id: 'thc-werbung1',       imgUrl: 'assets/promo/thc-werbung1/banner.svg',       alt: 'thc-werbung1' },
      { id: 'login-werbung1',     imgUrl: 'assets/promo/login-werbung1/banner.svg',     alt: 'login-werbung1' },
    ];
    const base = Object.fromEntries(defaults.map(d => [d.id, d]));
    this.slots$.next(base);

    // 2) Laufzeit-Overrides asynchron mergen
    this.loadOverrides(base);
  }

  /** Observable für eine Slot-ID */
  slot$(id: string) {
    return this.slots$.pipe(map(all => all[id]));
  }

  /** Lädt für alle Slots das beste verfügbare Override (svg→webp→png→jpg) und merged */
  private async loadOverrides(base: Record<string, AdSlotConfig>) {
    const results = await Promise.all(this.slotIds.map(id => this.fetchOverride(id)));
    const merged = { ...base };
    for (const r of results) if (r) merged[r.id] = r;
    this.slots$.next(merged);
  }

  /** Prüft Formate in EXT_ORDER, nutzt ETag/Last-Modified als Versionsstring für Cache-Bust */
  private async fetchOverride(id: string): Promise<AdSlotConfig | null> {
    for (const ext of this.EXT_ORDER) {
      const url = `${this.OVERRIDE_BASE}/${id}/banner.${ext}`;
      const head = await this.headResponse(url);
      if (!head?.ok) continue;

      // Version ableiten
      const etag = head.headers.get('ETag') ?? head.headers.get('Etag');
      const lastMod = head.headers.get('Last-Modified') ?? head.headers.get('Last-modified');
      const version = etag ?? lastMod ?? new Date().toISOString();

      return {
        id,
        imgUrl: `${url}?v=${encodeURIComponent(version)}`, // Cache-Bust
        alt: id,
        updatedAt: version
      };
    }
    return null; // kein Override vorhanden
  }

  /** HEAD-Request: gibt ok + Header-Wrapper zurück (oder null bei Fehler) */
  private async headResponse(url: string): Promise<{ ok: boolean; headers: Headers } | null> {
    try {
      const res = await firstValueFrom(this.http.head(url, { observe: 'response' })) as HttpResponse<unknown>;
      const ok = res.status >= 200 && res.status < 300;

      // HttpHeaders → Headers-Wrapper für bequemen get()
      const headers = new Headers();
      res.headers.keys().forEach(k => {
        const val = res.headers.get(k);
        if (val != null) headers.set(k, val);
      });

      return { ok, headers };
    } catch {
      return null;
    }
  }
}
