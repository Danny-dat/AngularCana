import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { Chart, ChartItem, registerables } from 'chart.js';

Chart.register(...registerables); // Chart.js initialisieren

// Interfaces für unsere Statistik-Daten
export interface ChartStats {
  [key: string]: number; // z.B. { '27.09.2025': 5, '28.09.2025': 3 }
}

export interface RankingItem {
  name: string;
  count: number;
}

export interface Rankings {
  byProduct: RankingItem[];
  byDevice: RankingItem[];
  byPair: RankingItem[];
}

export interface AdvancedStats {
  chartStats: ChartStats;
  rankings: Rankings;
}

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private chartInstance: Chart | null = null;

  constructor(private firestore: Firestore) { }

  /**
   * Lädt die Konsum-Statistiken für einen Nutzer und einen bestimmten Zeitraum.
   */
  async loadAdvancedConsumptionStats(uid: string, range: 'week' | 'month' | 'year' = 'week'): Promise<AdvancedStats> {
    const today = new Date();
    let startDate: Date;

    if (range === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    } else if (range === 'year') {
      startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    } else { // 'week'
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    }

    // Daten aus Firestore abrufen
    const consumptionsRef = collection(this.firestore, 'consumptions');
    const q = query(consumptionsRef, where('userId', '==', uid), where('timestamp', '>=', startDate));
    const querySnapshot = await getDocs(q);

    const chartStats: ChartStats = {};
    const productCounts: { [key: string]: number } = {};
    const deviceCounts: { [key: string]: number } = {};
    const pairCounts: { [key: string]: number } = {};

    // Chart-Daten für die Woche mit Nullen vor belegen, um alle Tage anzuzeigen
    if (range === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        chartStats[d.toLocaleDateString('de-DE')] = 0;
      }
    }

    querySnapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = (data['timestamp'] as Timestamp).toDate();

      // Chart-Daten füllen
      let key: string;
      if (range === 'week') {
        key = timestamp.toLocaleDateString('de-DE');
      } else if (range === 'month') {
        key = `${timestamp.getDate()}.${timestamp.getMonth() + 1}.`;
      } else { // 'year'
        key = timestamp.toLocaleString('de-DE', { month: 'short', year: '2-digit' });
      }
      if (!chartStats[key]) chartStats[key] = 0;
      chartStats[key]++;

      // Ranglisten-Daten zählen
      const product = data['product'];
      const device = data['device'];
      if (product) {
        productCounts[product] = (productCounts[product] || 0) + 1;
      }
      if (device) {
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      }
      if (product && device) {
        const pairKey = `${product} + ${device}`;
        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
      }
    });

    // Helper-Funktion zum Sortieren
    const sortRankings = (counts: { [key: string]: number }): RankingItem[] => {
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      chartStats,
      rankings: {
        byProduct: sortRankings(productCounts),
        byDevice: sortRankings(deviceCounts),
        byPair: sortRankings(pairCounts),
      }
    };
  }

  /**
   * Rendert ein Balkendiagramm in einem Canvas-Element.
   */
  renderChart(canvasId: string, stats: ChartStats): void {
    const ctx = document.getElementById(canvasId) as ChartItem;
    if (!ctx) return;

    // Zerstört ein eventuell vorhandenes altes Diagramm, um Speicherlecks zu vermeiden
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(stats),
        datasets: [{
          label: 'Anzahl Konsumeinheiten',
          data: Object.values(stats),
          backgroundColor: 'rgba(76, 175, 80, 0.5)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 } // Nur ganze Zahlen auf der Y-Achse
          }
        }
      }
    });
  }
}