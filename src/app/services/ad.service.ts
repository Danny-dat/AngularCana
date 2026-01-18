// src/app/services/ad.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, map, tap } from 'rxjs';
import type { AdSlotConfig } from '../models/ad.types';

@Injectable({ providedIn: 'root' })
export class AdService {
  private http = inject(HttpClient);

  /** Debug-Schalter */
  private readonly DEBUG = true;

  /** Schutz gegen Doppel-Init */
  private initialized = false;

  /** Bekannte Slots */
  private readonly slotIds = ['dashboard-werbung1', 'login-werbung1', 'thc-werbung1'] as const;

  /** Override-Basis (z. B. vom Server gemountet) */
  private readonly OVERRIDE_BASE = '/media';

  /** Format-Reihenfolge für Overrides */
  private readonly EXT_ORDER = ['svg', 'webp', 'png', 'jpg'] as const;

  /** State aller Slots */
  private slots$ = new BehaviorSubject<Record<string, AdSlotConfig>>({});

  /** Ein Default für einen Slot (immer absoluter Pfad) */
  private defaultFor(id: (typeof this.slotIds)[number]): AdSlotConfig {
    return { id, imgUrl: `/assets/promo/${id}/banner.svg`, alt: id };
  }

  /** Öffentliche Initialisierung (idempotent) */
  init(): void {
    if (this.initialized) {
      if (this.DEBUG) console.debug('[AdService] init() skipped (already initialized)');
      return;
    }
    this.initialized = true;

    // 1) Defaults setzen
    const defaults: AdSlotConfig[] = this.slotIds.map(id => this.defaultFor(id));
    const base = Object.fromEntries(defaults.map(d => [d.id, d]));
    this.slots$.next(base);
    if (this.DEBUG) console.debug('[AdService] init → defaults', base);

    // 2) Overrides laden und mergen
    this.loadOverrides(base).then(() => {
      if (this.DEBUG) console.debug('[AdService] overrides merged', this.slots$.value);
    });
  }

  /** Observable für einen Slot – liefert immer *mindestens* den Default */
  slot$(id: string) {
    return this.slots$.pipe(
      map(all => all[id] ?? (this.slotIds.includes(id as any) ? this.defaultFor(id as any) : undefined)),
      tap(cfg => { if (this.DEBUG) console.debug('[AdService] slot update:', id, cfg); })
    );
  }

  /** Lädt für alle Slots das beste verfügbare Override und merged */
  private async loadOverrides(base: Record<string, AdSlotConfig>) {
    const results = await Promise.all(this.slotIds.map(id => this.fetchOverride(id)));
    const merged = { ...base };
    for (const r of results) if (r) merged[r.id] = r;
    this.slots$.next(merged);
  }

  /** Prüft EXT_ORDER via HEAD und baut eine Version (ETag/Last-Modified) für Cache-Bust */
  private async fetchOverride(id: (typeof this.slotIds)[number]): Promise<AdSlotConfig | null> {
    for (const ext of this.EXT_ORDER) {
      const url = `${this.OFFLINE_SAFE(this.OVERRIDE_BASE)}/${id}/banner.${ext}`;
      const head = await this.headResponse(url);
      if (!head?.ok) continue;

      const etag = head.headers.get('ETag') ?? head.headers.get('Etag');
      const lastMod = head.headers.get('Last-Modified') ?? head.headers.get('Last-modified');
      const version = etag ?? lastMod ?? new Date().toISOString();

      if (this.DEBUG) console.debug('[AdService] override found', { id, url, version });
      return { id, imgUrl: `${url}?v=${encodeURIComponent(version)}`, alt: id, updatedAt: version };
    }
    if (this.DEBUG) console.debug('[AdService] no override for', id);
    return null;
  }

  /** HEAD-Request: ok + Header-Wrapper zurückgeben (oder null bei Fehler) */
  private async headResponse(url: string): Promise<{ ok: boolean; headers: Headers } | null> {
    try {
      const res = await firstValueFrom(this.http.head(url, { observe: 'response' })) as HttpResponse<unknown>;
      const ok = res.status >= 200 && res.status < 300;

      // HttpHeaders → Headers-Wrapper
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

  /** Sicherheitsnetz gegen doppelte Slashes in Offline/Dev-Setups */
  private OFFLINE_SAFE(p: string): string {
    return p.replace(/\/{2,}/g, '/');
  }
}
