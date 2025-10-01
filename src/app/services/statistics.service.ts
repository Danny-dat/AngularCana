// src/app/services/statistics.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';

export type StatsRange = 'week' | 'month' | 'year';

export interface RankingItem { name: string; count: number; }
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
  constructor(private firestore: Firestore) {}

  async loadAdvancedConsumptionStats(uid: string, range: StatsRange = 'week'): Promise<AdvancedStatsResult> {
    try {
      const today = new Date();
      const startDate = this.getStartDate(today, range);

      const col = collection(this.firestore, 'consumptions');
      const q = query(col, where('userId', '==', uid), where('timestamp', '>=', Timestamp.fromDate(startDate)));
      const snap = await getDocs(q);

      const chartStats = new Map<string, number>();
      const productCounts = new Map<string, number>();
      const deviceCounts = new Map<string, number>();
      const pairCounts = new Map<string, number>();

      // Woche vorbefüllen (7 Tage)
      if (range === 'week') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.toLocaleDateString('de-DE');
          chartStats.set(key, 0);
        }
      }

      snap.forEach(doc => {
        const data: any = doc.data();
        const ts: Date = (data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp));

        let label: string;
        if (range === 'week') {
          label = ts.toLocaleDateString('de-DE'); // z. B. 02.10.2025
        } else if (range === 'month') {
          label = `${ts.getDate()}.${ts.getMonth() + 1}.`; // 1.–31.
        } else {
          label = ts.toLocaleString('de-DE', { month: 'short', year: '2-digit' }); // „Okt. 25“
        }

        chartStats.set(label, (chartStats.get(label) ?? 0) + 1);

        const product = data.product as string | undefined;
        const device = data.device as string | undefined;
        if (product) productCounts.set(product, (productCounts.get(product) ?? 0) + 1);
        if (device) deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
        if (product && device) {
          const pair = `${product} + ${device}`;
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
      });

      const labels = this.sortLabels(chartStats.keys(), range);
      const values = labels.map(l => chartStats.get(l) ?? 0);

      return {
        chartLabels: labels,
        chartValues: values,
        rankings: {
          byProduct: this.sortMap(productCounts),
          byDevice: this.sortMap(deviceCounts),
          byPair: this.sortMap(pairCounts),
        }
      };
    } catch {
      // Fallback – garantiert ein Return-Wert
      return {
        chartLabels: [],
        chartValues: [],
        rankings: { byProduct: [], byDevice: [], byPair: [] }
      };
    }
  }

  // --- Helpers ---

  private getStartDate(today: Date, range: StatsRange): Date {
    switch (range) {
      case 'month':
        return new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      case 'year':
        return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      case 'week':
      default:
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    }
  }

  private sortMap(m: Map<string, number>): RankingItem[] {
    // explizites return verhindert 2355 bei manchen TS-Konfigurationen
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private sortLabels(keys: Iterable<string>, range: StatsRange): string[] {
    const labels = [...keys];
    if (range === 'week') {
      return labels.sort((a, b) => {
        const [da, ma, ya] = a.split('.');
        const [db, mb, yb] = b.split('.');
        const A = new Date(Number(ya), Number(ma) - 1, Number(da));
        const B = new Date(Number(yb), Number(mb) - 1, Number(db));
        return A.getTime() - B.getTime();
      });
    }
    // Monat/Jahr belassen (einfaches, stabiles Sorting)
    return labels;
  }
}
