import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import {
  Timestamp,
  serverTimestamp,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  collection,
  doc,
  writeBatch,
  increment,
  collectionGroup,
  documentId,
} from 'firebase/firestore';

import { geoCellE2, keyify } from '../../../utils/analytics-utils';

export type BreakdownKind = 'products' | 'devices' | 'locations' | 'pairs' | 'hours' | 'weekdays' | 'geo';

export interface DailyTotal {
  day: string; // YYYY-MM-DD
  totalCount: number;
}

export interface RankingItem {
  key: string;
  label: string;
  count: number;
}

export interface StatsMeta {
  lastProcessedAt?: any;
  updatedAt?: any;
  totalProcessed?: number;
}

export interface SyncSummary {
  processed: number;
  batches: number;
  lastProcessedAt: Date | null;
}

export interface RecentConsumption {
  id: string;
  when: Date | null;
  userId: string;
  userDisplayName: string | null;
  product: string;
  device: string;
  location: string;
  hasGeo: boolean;
}

function dayKey(d: Date): string {
  // ISO-ähnlich, aber ohne TZ-Shift-Probleme (lokal = Berlin)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
  private fs = inject(Firestore);

  async loadMeta(): Promise<StatsMeta | null> {
    const ref = doc(this.fs as any, 'stats_meta', 'global');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as any as StatsMeta) : null;
  }

  async loadRecentConsumptions(max = 25): Promise<RecentConsumption[]> {
    const col = collection(this.fs as any, 'consumptions');
    const q = query(col, orderBy('timestamp', 'desc'), limit(Math.min(Math.max(max, 1), 100)));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data: any = d.data();
      const ts = data?.timestamp?.toDate ? data.timestamp.toDate() : null;
      return {
        id: d.id,
        when: ts,
        userId: String(data?.userId ?? '—'),
        userDisplayName: (data?.userDisplayName ?? null) as any,
        product: String(data?.product ?? '—'),
        device: String(data?.device ?? '—'),
        location: String(data?.location ?? '—'),
        hasGeo: Boolean(data?.hasGeo ?? data?.locationGeo),
      } as RecentConsumption;
    });
  }

  /**
   * Liest die letzten N Tage aus stats_daily (nur 1 Query).
   */
  async loadDailyTotals(days: number): Promise<DailyTotal[]> {
    const col = collection(this.fs as any, 'stats_daily');
    const q = query(col, orderBy(documentId(), 'desc'), limit(Math.max(1, days)));
    const snap = await getDocs(q);

    const rows: DailyTotal[] = snap.docs.map((d) => {
      const data: any = d.data();
      return {
        day: d.id,
        totalCount: Number(data?.totalCount ?? 0),
      };
    });

    // für Charts lieber aufsteigend
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  }

  /**
   * Summiert ein Breakdown (z.B. products/devices/locations/pairs/hours) über einen Day-Range.
   * Nutzt collectionGroup, damit es nur 1 Query pro Breakdown ist.
   */
  async loadBreakdown(kind: BreakdownKind, startDay: string, endDay: string, topN = 12): Promise<RankingItem[]> {
    const cg = collectionGroup(this.fs as any, kind);
    const q = query(
      cg,
      where('day', '>=', startDay),
      where('day', '<=', endDay),
      orderBy('day', 'asc')
    );

    const snap = await getDocs(q);
    const sum = new Map<string, { label: string; count: number }>();

    for (const docSnap of snap.docs) {
      const data: any = docSnap.data();
      const key = String(data?.key ?? docSnap.id);
      const label = String(data?.label ?? key);
      const c = Number(data?.count ?? 0);

      const prev = sum.get(key);
      if (prev) prev.count += c;
      else sum.set(key, { label, count: c });
    }

    return [...sum.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }

  /**
   * Inkrementelle Stats-Synchronisation:
   * - liest neue consumptions seit lastProcessedAt
   * - schreibt aggregiert nach stats_daily/{day} + Subcollections
   *
   * Wichtig: Firestore Rules müssen Admin das Schreiben auf stats_* erlauben.
   */
  async syncConsumptions(opts?: { batchSize?: number; maxBatches?: number }): Promise<SyncSummary> {
    const batchSize = Math.min(Math.max(opts?.batchSize ?? 200, 50), 400);
    const maxBatches = Math.min(Math.max(opts?.maxBatches ?? 20, 1), 100);

    const metaRef = doc(this.fs as any, 'stats_meta', 'global');
    let metaSnap = await getDoc(metaRef);
    let lastProcessedAt: Timestamp | null = null;

    if (metaSnap.exists()) {
      const m: any = metaSnap.data();
      const ts = m?.lastProcessedAt;
      if (ts?.toMillis) lastProcessedAt = ts as Timestamp;
    }

    let processedTotal = 0;
    let batches = 0;
    let newestTs: Timestamp | null = lastProcessedAt;

    while (batches < maxBatches) {
      const col = collection(this.fs as any, 'consumptions');
      const q = lastProcessedAt
        ? query(col, where('timestamp', '>', lastProcessedAt), orderBy('timestamp', 'asc'), limit(batchSize))
        : query(col, orderBy('timestamp', 'asc'), limit(batchSize));

      const snap = await getDocs(q);
      if (snap.empty) break;

      // --- Aggregation in Memory (damit Writes klein bleiben)
      const dailyTotals = new Map<string, number>();
      const ops = new Map<string, { path: string[]; data: any; incField: string; incBy: number }>();

      let maxTsThisBatch: Timestamp | null = null;

      const addOp = (path: string[], baseData: any, incField: string, incBy: number) => {
        const id = path.join('/');
        const existing = ops.get(id);
        if (existing) {
          existing.incBy += incBy;
          // label etc. bleibt
        } else {
          ops.set(id, { path, data: baseData, incField, incBy });
        }
      };

      for (const d of snap.docs) {
        const data: any = d.data();
        const ts: Timestamp | null = data?.timestamp?.toMillis ? (data.timestamp as Timestamp) : null;
        if (!ts) continue;

        if (!maxTsThisBatch || ts.toMillis() > maxTsThisBatch.toMillis()) {
          maxTsThisBatch = ts;
        }

        const dt = ts.toDate();
        const day = dayKey(dt);
        const hour = String(dt.getHours()).padStart(2, '0');
        const weekday = String(dt.getDay()); // 0=So ... 6=Sa

        // daily total
        dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + 1);

        // Strings aus altem Modell
        const productLabel = String(data?.product ?? data?.productName ?? 'Unbekannt');
        const deviceLabel = String(data?.device ?? data?.deviceName ?? 'Unbekannt');
        const locationLabel = String(data?.location ?? 'Unbekannt');

        const productKey = String(data?.productKey ?? keyify(productLabel));
        const deviceKey = String(data?.deviceKey ?? keyify(deviceLabel));
        const locationKey = String(data?.locationKey ?? keyify(locationLabel));

        // Breakdown docs
        addOp(
          ['stats_daily', day, 'products', productKey],
          { day, key: productKey, label: productLabel, updatedAt: serverTimestamp() },
          'count',
          1
        );

        addOp(
          ['stats_daily', day, 'devices', deviceKey],
          { day, key: deviceKey, label: deviceLabel, updatedAt: serverTimestamp() },
          'count',
          1
        );

        addOp(
          ['stats_daily', day, 'locations', locationKey],
          { day, key: locationKey, label: locationLabel, updatedAt: serverTimestamp() },
          'count',
          1
        );

        const pairKey = `${productKey}__${deviceKey}`.slice(0, 120);
        const pairLabel = `${productLabel} + ${deviceLabel}`;
        addOp(
          ['stats_daily', day, 'pairs', pairKey],
          { day, key: pairKey, label: pairLabel, updatedAt: serverTimestamp() },
          'count',
          1
        );

        addOp(
          ['stats_daily', day, 'hours', hour],
          { day, key: hour, label: `${hour} Uhr`, updatedAt: serverTimestamp() },
          'count',
          1
        );

        addOp(
          ['stats_daily', day, 'weekdays', weekday],
          { day, key: weekday, label: weekday, updatedAt: serverTimestamp() },
          'count',
          1
        );

        // Geo (nur grob & nur wenn vorhanden)
        const geo = data?.locationGeo;
        const lat = typeof geo?.latitude === 'number' ? geo.latitude : null;
        const lng = typeof geo?.longitude === 'number' ? geo.longitude : null;
        if (lat != null && lng != null) {
          const cell = geoCellE2(lat, lng);
          addOp(
            ['stats_daily', day, 'geo', cell.id],
            {
              day,
              key: cell.id,
              label: cell.id,
              lat: cell.latE2 / 100,
              lng: cell.lngE2 / 100,
              updatedAt: serverTimestamp(),
            },
            'count',
            1
          );
        }
      }

      // daily totals als Ops hinzufügen
      for (const [day, inc] of dailyTotals.entries()) {
        const dt = startOfDay(new Date(`${day}T00:00:00`));
        addOp(
          ['stats_daily', day],
          {
            day,
            date: Timestamp.fromDate(dt),
            updatedAt: serverTimestamp(),
          },
          'totalCount',
          inc
        );
      }

      const opList = [...ops.values()];
      if (!opList.length) {
        // nix brauchbares verarbeitet
        lastProcessedAt = maxTsThisBatch ?? lastProcessedAt;
        newestTs = lastProcessedAt;
        batches++;
        continue;
      }

      // --- Writes in Chunk-Batches (writeBatch max 500 ops)
      const CHUNK = 450;
      for (let i = 0; i < opList.length; i += CHUNK) {
        const chunk = opList.slice(i, i + CHUNK);
        const wb = writeBatch(this.fs as any);
        for (const op of chunk) {
          const ref = doc(this.fs as any, ...op.path);
          wb.set(ref, { ...op.data, [op.incField]: increment(op.incBy) }, { merge: true });
        }
        await wb.commit();
      }

      // Cursor fortschreiben (nur wenn wir Timestamp haben)
      if (maxTsThisBatch) {
        lastProcessedAt = maxTsThisBatch;
        newestTs = maxTsThisBatch;
      }

      processedTotal += snap.size;
      batches += 1;

      // nächste Runde nur wenn wirklich batchSize voll (sonst sind wir am Ende)
      if (snap.size < batchSize) break;
    }

    // Meta erst am Ende schreiben (nur wenn wirklich neue Docs verarbeitet wurden)
    if (processedTotal > 0 && newestTs) {
      await setDoc(
        metaRef,
        {
          lastProcessedAt: newestTs,
          updatedAt: serverTimestamp(),
          totalProcessed: increment(processedTotal),
        },
        { merge: true }
      );
    }

    return {
      processed: processedTotal,
      batches,
      lastProcessedAt: newestTs ? newestTs.toDate() : null,
    };
  }
}
