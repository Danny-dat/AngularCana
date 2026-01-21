/* istanbul ignore file */
// src/app/services/ad.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Subscription, combineLatest, firstValueFrom, map, of, tap } from 'rxjs';
import { catchError, distinctUntilChanged, startWith } from 'rxjs/operators';
import type { AdSlotConfig } from '../models/ad.types';

import { Firestore, doc, docData } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AdService {
  private http = inject(HttpClient, { optional: true });
  private afs = inject(Firestore, { optional: true });

  /** Debug-Schalter */
  private readonly DEBUG = false;

  /** Schutz gegen Doppel-Init */
  private initialized = false;

  /** Bekannte Slots */
  private readonly slotIds = ['dashboard-werbung1', 'login-werbung1', 'thc-werbung1'] as const;

  /** Override-Basis (z. B. vom Server gemountet) */
  // Live-Override ueber FTP:
  // Auf einem klassischen FTP/Webserver kannst du Dateien in /assets/ ueberschreiben,
  // ohne neu zu deployen. Deshalb nutzen wir fuer Live-Overrides standardmaessig
  // denselben Pfad wie die Build-Assets.
  // (Spaeter kannst du das z.B. auf '/media' umstellen, wenn du ein separates Mounting willst.)
  private readonly OVERRIDE_BASE = '/assets/promo';

  /** Format-Reihenfolge für Overrides */
  // webp zuerst (sauberer Server-Standard), svg als kompatibles Fallback
  private readonly EXT_ORDER = ['webp', 'svg', 'png', 'jpg'] as const;

  /** State aller Slots */
  private slots$ = new BehaviorSubject<Record<string, AdSlotConfig>>({});

  private configSub?: Subscription;

  /** Ein Default für einen Slot (immer absoluter Pfad) */
  private defaultFor(id: (typeof this.slotIds)[number]): AdSlotConfig {
    return {
      id,
      imgUrl: `/assets/promo/${id}/banner.svg`,
      alt: id,
      linkEnabled: true,
      linkUrl: null,
      // Default: SVG (existiert im Build immer) → keine 404-Spam-HEADs.
      activeExt: 'svg',
    };
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
    if (this.http) {
      this.loadOverrides(base).then(() => {
        if (this.DEBUG) console.debug('[AdService] overrides merged', this.slots$.value);
      });
    }

    // 3) Konfig aus Firestore mergen (Link + ActiveExt + Refresh-Hint)
    if (this.afs) this.watchSlotConfig();
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
    const results = await Promise.all(this.slotIds.map(id => {
      const current = base[id];
      const order = this.extOrderFor(current?.activeExt);
      return this.fetchOverride(id, order, current?.configUpdatedAt);
    }));
    const merged = { ...base };
    for (const r of results) {
      if (!r) continue;
      // wichtig: base properties (Link, activeExt, etc.) behalten
      merged[r.id] = { ...(merged[r.id] ?? this.defaultFor(r.id as any)), ...r };
    }
    this.slots$.next(merged);
  }

  /** Prüft EXT_ORDER via HEAD und baut eine Version (ETag/Last-Modified oder config hint) für Cache-Bust */
  private async fetchOverride(
    id: (typeof this.slotIds)[number],
    extOrder: ReadonlyArray<(typeof this.EXT_ORDER)[number]>,
    versionHint?: string
  ): Promise<AdSlotConfig | null> {
    for (const ext of extOrder) {
      const url = `${this.OFFLINE_SAFE(this.OVERRIDE_BASE)}/${id}/banner.${ext}`;
      const head = await this.headResponse(url);
      if (!head?.ok) continue;

      const etag = head.headers.get('ETag') ?? head.headers.get('Etag');
      const lastMod = head.headers.get('Last-Modified') ?? head.headers.get('Last-modified');
      // Wenn der Server keine ETags/Last-Modified liefert, nutzen wir eine konstante
      // Version. Fuer echte Updates sorgt der Admin-Button "Speichern" (updatedAt).
      const version = versionHint ?? etag ?? lastMod ?? '1';

      if (this.DEBUG) console.debug('[AdService] override found', { id, url, version });
      return { id, imgUrl: `${url}?v=${encodeURIComponent(version)}`, alt: id, updatedAt: version };
    }
    if (this.DEBUG) console.debug('[AdService] no override for', id);
    return null;
  }

  /** HEAD-Request: ok + Header-Wrapper zurückgeben (oder null bei Fehler) */
  private async headResponse(url: string): Promise<{ ok: boolean; headers: Headers } | null> {
    if (!this.http) return null;
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

  private extOrderFor(activeExt?: string | null) {
    const base = [...this.EXT_ORDER];
    const ext = (activeExt ?? '').toLowerCase();
    if (!ext) return base;

    // nur erlaubte Endungen
    if (!base.includes(ext as any)) return base;
    return [ext as any, ...base.filter(x => x !== (ext as any))];
  }

  /**
   * Firestore: /adSlots/{slotId}
   * Felder: linkEnabled:boolean, linkUrl:string|null, activeExt:string, updatedAt:Timestamp
   */
  private watchSlotConfig() {
    // NOTE: Klassen-Properties werden von TypeScript NICHT sicher "narrowed",
    // weil sie theoretisch zwischen Check und Verwendung mutiert werden koennen.
    // Daher: in eine lokale Konstante kopieren.
    const afs = this.afs;
    if (!afs) return;
    if (this.configSub) return;

    const streams = this.slotIds.map((id) => {
      const r = doc(afs, 'adSlots', id);
      return (docData(r) as any).pipe(
        startWith(null),
        map((d: any) => {
          const ts = this.toIsoSafe(d?.updatedAt);
          return {
            id,
            linkEnabled: typeof d?.linkEnabled === 'boolean' ? d.linkEnabled : true,
            linkUrl: (d?.linkUrl ?? null) as string | null,
            activeExt: (d?.activeExt ?? null) as AdSlotConfig['activeExt'] | null,
            configUpdatedAt: ts ?? undefined,
          } as Partial<AdSlotConfig> & { id: string };
        }),
        catchError(() => of({ id, linkEnabled: true, linkUrl: null } as any)),
        distinctUntilChanged((a: any, b: any) =>
          (a?.linkEnabled ?? true) === (b?.linkEnabled ?? true)
          && (a?.linkUrl ?? null) === (b?.linkUrl ?? null)
          && (a?.activeExt ?? null) === (b?.activeExt ?? null)
          && (a?.configUpdatedAt ?? '') === (b?.configUpdatedAt ?? '')
        )
      );
    });

    this.configSub = combineLatest(streams).subscribe((cfgs: any[]) => {
      const current = { ...this.slots$.value };

      for (const cfg of cfgs) {
        const id = cfg.id as (typeof this.slotIds)[number];
        const prev = current[id] ?? this.defaultFor(id);
        const next: AdSlotConfig = {
          ...prev,
          linkEnabled: cfg.linkEnabled ?? prev.linkEnabled ?? true,
          linkUrl: cfg.linkUrl ?? null,
          activeExt: (cfg.activeExt ?? prev.activeExt ?? 'webp') as any,
          configUpdatedAt: cfg.configUpdatedAt ?? prev.configUpdatedAt,
        };
        current[id] = next;

        // Bei Konfig-Aenderung: Override neu pruefen, damit Banner sofort aktualisiert
        // (und mit configUpdatedAt als Cache-Bust)
        this.refreshOverrideFor(id).catch(() => {});
      }

      this.slots$.next(current);
    });
  }

  private async refreshOverrideFor(id: (typeof this.slotIds)[number]) {
    const current = this.slots$.value[id] ?? this.defaultFor(id);
    const order = this.extOrderFor(current.activeExt);
    const res = await this.fetchOverride(id, order, current.configUpdatedAt);
    if (!res) return;

    const merged: AdSlotConfig = { ...current, ...res };
    this.slots$.next({ ...this.slots$.value, [id]: merged });
  }

  private toIsoSafe(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    return null;
  }
}
