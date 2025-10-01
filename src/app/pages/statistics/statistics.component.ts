// src/app/pages/statistics/statistics.component.ts
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatisticsService, StatsRange } from '../../services/statistics.service';
import { Chart, type ChartConfiguration } from 'chart.js/auto';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent {
  private statsSvc = inject(StatisticsService);
  private destroyRef = inject(DestroyRef);

  // echte User-ID eintragen
  readonly uid = signal<string>('CURRENT_USER_ID');

  readonly range = signal<StatsRange>('week');
  readonly labels = signal<string[]>([]);
  readonly values = signal<number[]>([]);
  readonly rankings = signal({
    byProduct: [] as { name: string; count: number }[],
    byDevice:  [] as { name: string; count: number }[],
    byPair:    [] as { name: string; count: number }[],
  });

  private chart?: Chart;

  constructor() {
    // Reagiere auf Range/User-Wechsel
    effect(() => {
      const uid = this.uid();
      const r = this.range();
      if (!uid) return;
      // explicit: wir ignorieren das Promise-Ergebnis (Side-Effect)
      void this.load(uid, r);
    });

    // Chart sauber zerstören bei Destroy
    this.destroyRef.onDestroy(() => { this.chart?.destroy(); });
  }

  // <-- expliziter Rückgabetyp hilft gegen strikte Checks
  async load(uid: string, range: StatsRange): Promise<void> {
    // Falls dein Service korrekt typisiert ist, bekommst du hier AdvancedStatsResult
    const data = await this.statsSvc.loadAdvancedConsumptionStats(uid, range);

    // Sollte TypeScript hier noch 'unknown' meckern, gib dem Ergebnis notfalls hart den Typ:
    // const data: AdvancedStatsResult = await this.statsSvc.loadAdvancedConsumptionStats(uid, range);

    this.labels.set(data.chartLabels);
    this.values.set(data.chartValues);
    this.rankings.set(data.rankings);
    this.renderChart();
  }

  setRange(r: StatsRange): void {
    this.range.set(r);
  }

  private renderChart(): void {
    const ctx = document.getElementById('consumptionChart') as HTMLCanvasElement | null;
    if (!ctx) return;

    this.chart?.destroy();

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: this.labels(),
        datasets: [{
          label: 'Anzahl Konsumeinheiten',
          data: this.values(),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    };

    this.chart = new Chart(ctx, config);
  }
}
