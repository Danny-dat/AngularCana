/* istanbul ignore file */
import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import {
  Timestamp,
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';

export type PivotMetric = 'logs' | 'uniqueUsers';

/** Welche Dimensionen der Admin frei kombinieren kann. */
export type PivotDimensionId =
  | 'product'
  | 'device'
  | 'location'
  | 'hour'
  | 'weekday'
  | 'platform'
  | 'hasGeo'
  | 'geoCell'
  | 'userGender'
  | 'userCity'
  | 'userCountry'
  | 'user';

export type UserProfileLite = {
  gender: 'male' | 'female' | 'diverse' | 'unspecified';
  city: string | null;
  country: string | null;
  displayName: string | null;
};

export type ConsumptionLite = {
  id: string;
  userId: string;
  userDisplayName: string | null;
  product: string | null;
  device: string | null;
  location: string | null;
  platform: string | null;
  hasGeo: boolean;
  geoCellId: string | null;
  timestamp: Date | null;
};

export type PivotRow = Record<string, string | number> & {
  logs: number;
  uniqueUsers?: number;
};

function safeStr(v: any, fallback = '—'): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : fallback;
}

function parseTs(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') {
    try {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof v === 'number') {
    const ms = v < 10_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class AdminPivotService {
  private readonly fs = inject(Firestore);

  /**
   * Lädt Roh-Logs aus `consumptions` für einen Zeitraum.
   * Pagination ist wichtig, weil Firestore keine unendlichen Query-Results liefert.
   */
  async loadConsumptionsInRange(opts: {
    start: Date;
    end: Date;
    pageSize?: number;
    maxDocs?: number;
  }): Promise<ConsumptionLite[]> {
    const pageSize = Math.min(Math.max(opts.pageSize ?? 500, 50), 1000);
    const maxDocs = Math.min(Math.max(opts.maxDocs ?? 5000, 200), 20000);

    const startTs = Timestamp.fromDate(opts.start);
    const endTs = Timestamp.fromDate(opts.end);

    const col = collection(this.fs as any, 'consumptions');
    let q = query(
      col,
      where('timestamp', '>=', startTs),
      where('timestamp', '<=', endTs),
      orderBy('timestamp', 'asc'),
      limit(pageSize)
    );

    const out: ConsumptionLite[] = [];
    let last: any = null;

    while (out.length < maxDocs) {
      const snap = await getDocs(q);
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data: any = d.data();
        const ts = parseTs(data?.timestamp);
        out.push({
          id: d.id,
          userId: safeStr(data?.userId ?? data?.uid ?? '', ''),
          userDisplayName: (typeof data?.userDisplayName === 'string' && data.userDisplayName.trim())
            ? data.userDisplayName.trim()
            : null,
          product: (typeof data?.product === 'string' && data.product.trim()) ? data.product.trim() : null,
          device: (typeof data?.device === 'string' && data.device.trim()) ? data.device.trim() : null,
          location: (typeof data?.location === 'string' && data.location.trim()) ? data.location.trim() : null,
          platform: (typeof data?.platform === 'string' && data.platform.trim()) ? data.platform.trim() : null,
          hasGeo: Boolean(data?.hasGeo ?? data?.locationGeo),
          geoCellId: (typeof data?.geoCellId === 'string' && data.geoCellId.trim()) ? data.geoCellId.trim() : null,
          timestamp: ts,
        });
        if (out.length >= maxDocs) break;
      }

      last = snap.docs[snap.docs.length - 1];
      if (!last) break;
      q = query(
        col,
        where('timestamp', '>=', startTs),
        where('timestamp', '<=', endTs),
        orderBy('timestamp', 'asc'),
        startAfter(last),
        limit(pageSize)
      );
    }

    return out;
  }

  /**
   * Lädt Profile-lite aus `users/{uid}` (nur Felder, die wir für Pivot brauchen).
   * Batch via "in" ist auf 10 limitiert -> chunking.
   */
  async loadUserProfilesLite(uids: string[]): Promise<Map<string, UserProfileLite>> {
    const uniq = [...new Set((uids ?? []).map((u) => String(u || '').trim()).filter(Boolean))];
    const map = new Map<string, UserProfileLite>();
    if (!uniq.length) return map;

    const col = collection(this.fs as any, 'users');
    const chunks: string[][] = [];
    for (let i = 0; i < uniq.length; i += 10) chunks.push(uniq.slice(i, i + 10));

    const snaps = await Promise.all(
      chunks.map((c) => getDocs(query(col, where(documentId(), 'in', c))))
    );

    for (const snap of snaps) {
      for (const d of snap.docs) {
        const data: any = d.data();
        const p: any = data?.profile ?? {};
        const loc: any = p?.location ?? {};

        const genderRaw = String(p?.gender ?? 'unspecified');
        const gender: UserProfileLite['gender'] =
          genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'diverse'
            ? (genderRaw as any)
            : 'unspecified';

        map.set(d.id, {
          gender,
          city: typeof loc?.city === 'string' && loc.city.trim() ? loc.city.trim() : null,
          country: typeof loc?.country === 'string' && loc.country.trim() ? loc.country.trim() : null,
          displayName:
            typeof p?.displayName === 'string' && p.displayName.trim()
              ? p.displayName.trim()
              : typeof data?.displayName === 'string' && data.displayName.trim()
                ? data.displayName.trim()
                : null,
        });
      }
    }

    return map;
  }

  /**
   * Clientseitige Aggregation: beliebige Kombinationen aus Dimensionen.
   */
  aggregateConsumptions(opts: {
    docs: ConsumptionLite[];
    userMap?: Map<string, UserProfileLite>;
    dimensions: PivotDimensionId[];
    metric: PivotMetric;
    topN?: number;
  }): PivotRow[] {
    const docs = opts.docs ?? [];
    const dims = (opts.dimensions ?? []).filter(Boolean);
    const topN = Math.min(Math.max(opts.topN ?? 25, 1), 500);
    const metric = opts.metric;
    const userMap = opts.userMap ?? new Map<string, UserProfileLite>();

    const weekdayLabel = (n: number): string => {
      // JS: 0=So
      return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][n] ?? String(n);
    };

    const genderLabel = (g: UserProfileLite['gender']): string => {
      if (g === 'male') return 'Männlich';
      if (g === 'female') return 'Weiblich';
      if (g === 'diverse') return 'Divers';
      return 'Keine Angabe';
    };

    const dimValue = (d: ConsumptionLite, dim: PivotDimensionId): string => {
      if (dim === 'product') return safeStr(d.product);
      if (dim === 'device') return safeStr(d.device);
      if (dim === 'location') return safeStr(d.location);
      if (dim === 'platform') return safeStr(d.platform);
      if (dim === 'hasGeo') return d.hasGeo ? 'Ja' : 'Nein';
      if (dim === 'geoCell') return safeStr(d.geoCellId);
      if (dim === 'hour') {
        const ts = d.timestamp;
        return ts ? String(ts.getHours()).padStart(2, '0') : '—';
      }
      if (dim === 'weekday') {
        const ts = d.timestamp;
        return ts ? weekdayLabel(ts.getDay()) : '—';
      }
      if (dim === 'user') {
        return safeStr(d.userDisplayName ?? (d.userId ? d.userId.slice(0, 8) : ''), '—');
      }
      // Profil-Dimensionen
      const u = d.userId ? userMap.get(d.userId) : undefined;
      if (dim === 'userGender') return genderLabel(u?.gender ?? 'unspecified');
      if (dim === 'userCity') return safeStr(u?.city);
      if (dim === 'userCountry') return safeStr(u?.country);
      return '—';
    };

    type Bucket = {
      values: Record<string, string>;
      logs: number;
      users?: Set<string>;
    };

    const sep = '\u001f'; // Unit Separator
    const buckets = new Map<string, Bucket>();

    for (const d of docs) {
      // wenn keine Dimension gewählt ist -> alles in einen Bucket
      const values: Record<string, string> = {};
      const key = dims.length
        ? dims.map((dim) => {
            const v = dimValue(d, dim);
            values[dim] = v;
            return v;
          }).join(sep)
        : '__all__';

      const b = buckets.get(key);
      if (!b) {
        buckets.set(key, {
          values: dims.length ? values : {},
          logs: 1,
          users: metric === 'uniqueUsers' ? new Set(d.userId ? [d.userId] : []) : undefined,
        });
      } else {
        b.logs++;
        if (metric === 'uniqueUsers' && d.userId) b.users?.add(d.userId);
      }
    }

    const rows: PivotRow[] = [...buckets.values()].map((b) => {
      const base: any = { ...b.values, logs: b.logs };
      if (metric === 'uniqueUsers') base.uniqueUsers = b.users ? b.users.size : 0;
      return base as PivotRow;
    });

    const metricKey: keyof PivotRow = metric === 'uniqueUsers' ? 'uniqueUsers' : 'logs';
    rows.sort((a, b) => Number(b[metricKey] ?? 0) - Number(a[metricKey] ?? 0));

    return rows.slice(0, topN);
  }
}
