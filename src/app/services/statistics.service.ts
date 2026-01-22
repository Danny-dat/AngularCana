import { Injectable, EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

export type StatsRange = 'week' | 'month' | 'year' | 'custom';

export interface RankingItem {
  name: string;
  count: number;
}
export interface AdvancedStatsResult {
  chartLabels: string[];
  chartValues: number[];
  rankings: {
    byProduct: RankingItem[];
    byDevice: RankingItem[];
    byPair: RankingItem[];
  };
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly firestore = inject(Firestore);
  private readonly env = inject(EnvironmentInjector);

  async loadAdvancedConsumptionStats(
    uid: string,
    range: StatsRange = 'week',
    opts?: { start?: Date; end?: Date },
  ): Promise<AdvancedStatsResult> {
    const empty: AdvancedStatsResult = {
      chartLabels: [],
      chartValues: [],
      rankings: { byProduct: [], byDevice: [], byPair: [] },
    };
    if (!uid) return empty;

    return await runInInjectionContext(this.env, async () => {
      const today = this.trimDate(new Date());

      // --- Zeitraum bestimmen + Buckets vorbefüllen ---
      let start: Date,
        end: Date,
        bucketKeys: string[],
        bucketLabels: string[],
        bucketBy: 'day' | 'month';

      if (range === 'week') {
        end = today;
        start = this.addDays(end, -6);
        ({ keys: bucketKeys, labels: bucketLabels } = this.makeDailyBuckets(start, end));
        bucketBy = 'day';
      } else if (range === 'month') {
        const y = today.getFullYear(),
          m = today.getMonth();
        start = new Date(y, m, 1);
        end = new Date(y, m + 1, 0);
        ({ keys: bucketKeys, labels: bucketLabels } = this.makeDailyBuckets(start, end));
        bucketBy = 'day';
      } else if (range === 'year') {
        const y = today.getFullYear();
        start = new Date(y, 0, 1);
        end = new Date(y, 11, 31);
        ({ keys: bucketKeys, labels: bucketLabels } = this.makeMonthlyBuckets(y));
        bucketBy = 'month';
      } else {
        // custom
        start = this.trimDate(opts?.start ?? today);
        end = this.trimDate(opts?.end ?? today);
        if (start > end) [start, end] = [end, start];
        // <= 62 Tage -> täglich, sonst monatlich
        const diffDays = Math.round((+end - +start) / 86400000) + 1;
        if (diffDays <= 62) {
          ({ keys: bucketKeys, labels: bucketLabels } = this.makeDailyBuckets(start, end));
          bucketBy = 'day';
        } else {
          ({ keys: bucketKeys, labels: bucketLabels } = this.makeMonthlyBuckets(
            start.getFullYear(),
            end.getFullYear(),
          ));
          bucketBy = 'month';
        }
      }

      // --- Daten laden (top-level + optional collectionGroup) ---
      const docsTop = await this.tryLoadDocsFromTopLevel(uid);
      const docsCg = docsTop.length ? [] : await this.tryLoadDocsFromCollectionGroup(uid);
      const docs = docsTop.length ? docsTop : docsCg;

      if (!docs.length) return empty;

      const TS_FIELDS = ['timestamp', 'createdAt', 'date', 'loggedAt'];
      const PRODUCT_FIELDS = ['product', 'productName', 'type'];
      const DEVICE_FIELDS = ['device', 'deviceName'];

      const toDate = (v: any): Date | null => {
        if (!v) return null;
        if (v instanceof Date) return this.trimDate(v);
        if (typeof v?.toDate === 'function') {
          try {
            return this.trimDate(v.toDate());
          } catch {}
        }
        if (typeof v === 'number') {
          const ms = v < 10_000_000_000 ? v * 1000 : v;
          const d = new Date(ms);
          return isNaN(d.getTime()) ? null : this.trimDate(d);
        }
        if (typeof v === 'string') {
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : this.trimDate(d);
        }
        return null;
      };

      // Maps vorbereiten (mit 0 vorbefüllt)
      const counts = new Map<string, number>(bucketKeys.map((k) => [k, 0]));
      const productCounts = new Map<string, number>();
      const deviceCounts = new Map<string, number>();
      const pairCounts = new Map<string, number>();

      // zählen
      for (const data of docs) {
        // Zeitstempel finden + in Range?
        let rawTs: any;
        for (const f of TS_FIELDS) {
          if (data?.[f] !== undefined) {
            rawTs = data[f];
            break;
          }
        }
        const ts = toDate(rawTs);
        if (!ts) continue;
        if (ts < start || ts > end) continue;

        // Bucket-Key
        const key =
          bucketBy === 'day'
            ? this.keyDay(ts) // YYYY-MM-DD
            : this.keyMonth(ts); // YYYY-MM

        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);

        // Rankings
        let product: string | undefined;
        for (const f of PRODUCT_FIELDS) {
          const v = data?.[f];
          if (typeof v === 'string' && v.trim()) {
            product = v.trim();
            break;
          }
        }
        let device: string | undefined;
        for (const f of DEVICE_FIELDS) {
          const v = data?.[f];
          if (typeof v === 'string' && v.trim()) {
            device = v.trim();
            break;
          }
        }
        if (product) productCounts.set(product, (productCounts.get(product) ?? 0) + 1);
        if (device) deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
        if (product && device) {
          const pair = `${product} + ${device}`;
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
      }

      const values = bucketKeys.map((k) => counts.get(k) ?? 0);
      const sortMap = (m: Map<string, number>): RankingItem[] =>
        [...m.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

      return {
        chartLabels: bucketLabels,
        chartValues: values,
        rankings: {
          byProduct: sortMap(productCounts),
          byDevice: sortMap(deviceCounts),
          byPair: sortMap(pairCounts),
        },
      };
    });
  }

  // -------- Datenquellen

  private async tryLoadDocsFromTopLevel(uid: string): Promise<any[]> {
    try {
      const col = collection(this.firestore, 'consumptions');
      let snap = await getDocs(query(col, where('userId', '==', uid)));
      if (snap.empty) snap = await getDocs(query(col, where('uid', '==', uid)));
      return snap.docs.map((d) => d.data());
    } catch {
      return [];
    }
  }

  private async tryLoadDocsFromCollectionGroup(uid: string): Promise<any[]> {
    try {
      const cg = collectionGroup(this.firestore, 'consumptions');
      const [byUserId, byUid] = await Promise.all([
        getDocs(query(cg, where('userId', '==', uid))),
        getDocs(query(cg, where('uid', '==', uid))),
      ]);
      return [...byUserId.docs, ...byUid.docs].map((d) => d.data());
    } catch {
      return [];
    }
  }

  // -------- Buckets & Date-Utils

  private trimDate(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  private addDays(d: Date, delta: number): Date {
    const n = new Date(d);
    n.setDate(n.getDate() + delta);
    return this.trimDate(n);
  }
  private keyDay(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private keyMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private makeDailyBuckets(start: Date, end: Date): { keys: string[]; labels: string[] } {
    const keys: string[] = [],
      labels: string[] = [];
    const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'numeric' });
    for (let d = new Date(start); d <= end; d = this.addDays(d, 1)) {
      keys.push(this.keyDay(d));
      labels.push(fmt.format(d)); // z. B. 23.9.
    }
    return { keys, labels };
  }

  private makeMonthlyBuckets(
    startYear: number,
    endYear?: number,
  ): { keys: string[]; labels: string[] } {
    const keys: string[] = [],
      labels: string[] = [];
    const fmt = new Intl.DateTimeFormat('de-DE', { month: 'short' });
    const yEnd = endYear ?? startYear;
    for (let y = startYear; y <= yEnd; y++) {
      for (let m = 0; m < 12; m++) {
        keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        labels.push(
          `${fmt.format(new Date(y, m, 1))}${yEnd > startYear ? ' ' + String(y).slice(2) : ''}`,
        );
      }
    }
    return { keys, labels };
  }
}
