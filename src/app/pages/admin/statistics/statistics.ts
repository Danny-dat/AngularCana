/* istanbul ignore file */
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { toSignal } from '@angular/core/rxjs-interop';
import { Chart, type ChartConfiguration } from 'chart.js/auto';

import { AdminStatsService } from '../services/admin-stats.service';
import {
  AdminAnalyticsService,
  DailyTotal,
  RankingItem,
  RecentConsumption,
} from '../services/admin-analytics.service';

type KpiVm = { label: string; value: string; icon: string; hint?: string };

@Component({
  standalone: true,
  selector: 'app-AdminStatistic',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTableModule,
  ],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class AdminStatistic {
  private stats = inject(AdminStatsService);
  private analytics = inject(AdminAnalyticsService);
  private destroyRef = inject(DestroyRef);
  private nf = new Intl.NumberFormat('de-DE');

  @ViewChild('dailyCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  // ------- KPIs (live via Count Queries)
  readonly usersCount = toSignal(this.stats.usersCount$, { initialValue: 0 });
  readonly adminsCount = toSignal(this.stats.adminsCount$, { initialValue: 0 });
  readonly bansCount = toSignal(this.stats.bansCount$, { initialValue: 0 });
  readonly locksCount = toSignal(this.stats.locksCount$, { initialValue: 0 });
  readonly onlineNowCount = toSignal(this.stats.onlineNowCount$, { initialValue: 0 });
  readonly active24hCount = toSignal(this.stats.active24hCount$, { initialValue: 0 });
  readonly consumptions7dCount = toSignal(this.stats.consumptions7dCount$, { initialValue: 0 });
  readonly consumptions30dCount = toSignal(this.stats.consumptions30dCount$, { initialValue: 0 });

  readonly kpis = computed<KpiVm[]>(() => [
    { label: 'Users', value: this.nf.format(this.usersCount()), icon: 'group' },
    { label: 'Admins', value: this.nf.format(this.adminsCount()), icon: 'admin_panel_settings' },
    { label: 'Online jetzt', value: this.nf.format(this.onlineNowCount()), icon: 'wifi' },
    { label: 'Aktiv (24h)', value: this.nf.format(this.active24hCount()), icon: 'bolt' },
    { label: 'Bans', value: this.nf.format(this.bansCount()), icon: 'block' },
    { label: 'Locks', value: this.nf.format(this.locksCount()), icon: 'lock' },
    { label: 'Logs (7 Tage)', value: this.nf.format(this.consumptions7dCount()), icon: 'timeline' },
    { label: 'Logs (30 Tage)', value: this.nf.format(this.consumptions30dCount()), icon: 'insights' },
  ]);

  // ------- Window / Charts
  readonly rangeDays = signal<number>(30);
  readonly isLoading = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);

  readonly metaText = signal<string>('—');
  readonly daily = signal<DailyTotal[]>([]);

  readonly topProducts = signal<RankingItem[]>([]);
  readonly topDevices = signal<RankingItem[]>([]);
  readonly topLocations = signal<RankingItem[]>([]);
  readonly topPairs = signal<RankingItem[]>([]);
  readonly topHours = signal<RankingItem[]>([]);

  readonly recent = signal<RecentConsumption[]>([]);

  readonly displayedColumns = ['label', 'count'];
  readonly recentColumns = ['when', 'user', 'product', 'device', 'location'];

  private chart?: Chart;

  constructor() {
    // initial + on range change
    effect(() => {
      const days = this.rangeDays();
      void this.reload(days);
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }

  async syncNow(): Promise<void> {
    this.isSyncing.set(true);
    try {
      const res = await this.analytics.syncConsumptions({ batchSize: 200, maxBatches: 20 });
      // danach neu laden
      await this.reload(this.rangeDays());
      if (res.processed > 0) {
        this.metaText.set(
          `Sync: +${this.nf.format(res.processed)} neue Logs • letzter Cursor: ${res.lastProcessedAt?.toLocaleString('de-DE') ?? '—'}`
        );
      }
    } catch (e) {
      console.error('[admin statistics] sync failed', e);
      this.metaText.set('Sync fehlgeschlagen (siehe Konsole).');
    } finally {
      this.isSyncing.set(false);
    }
  }

  async reload(days: number): Promise<void> {
    this.isLoading.set(true);
    try {
      const meta = await this.analytics.loadMeta();
      const last = meta?.lastProcessedAt?.toDate ? meta.lastProcessedAt.toDate() : null;
      if (last) {
        this.metaText.set(`Letzter Sync: ${last.toLocaleString('de-DE')}`);
      } else {
        this.metaText.set('Noch kein Sync gelaufen.');
      }

      const daily = await this.analytics.loadDailyTotals(days);
      this.daily.set(daily);

      // Quick audit: letzte Logs
      const recent = await this.analytics.loadRecentConsumptions(25);
      this.recent.set(recent);

      // ... und zusätzlich eine kleine "letzte Logs" Liste
      this.recent.set(await this.analytics.loadRecentConsumptions(25));

      // Breakdowns nur wenn wir wenigstens einen Tag haben
      if (daily.length) {
        const startDay = daily[0].day;
        const endDay = daily[daily.length - 1].day;

        const [p, d, l, pair, h] = await Promise.all([
          this.analytics.loadBreakdown('products', startDay, endDay, 10),
          this.analytics.loadBreakdown('devices', startDay, endDay, 10),
          this.analytics.loadBreakdown('locations', startDay, endDay, 10),
          this.analytics.loadBreakdown('pairs', startDay, endDay, 10),
          this.analytics.loadBreakdown('hours', startDay, endDay, 8),
        ]);

        this.topProducts.set(p);
        this.topDevices.set(d);
        this.topLocations.set(l);
        this.topPairs.set(pair);
        this.topHours.set(h);
      } else {
        this.topProducts.set([]);
        this.topDevices.set([]);
        this.topLocations.set([]);
        this.topPairs.set([]);
        this.topHours.set([]);
      }

      queueMicrotask(() => this.renderChart());
    } finally {
      this.isLoading.set(false);
    }
  }

  setRange(days: number) {
    this.rangeDays.set(days);
  }

  private renderChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.chart?.destroy();

    const rows = this.daily();
    const labels = rows.map((r) => r.day.slice(5)); // MM-DD
    const values = rows.map((r) => r.totalCount);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `Logs pro Tag (letzte ${this.rangeDays()} Tage)`,
            data: values,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    };

    this.chart = new Chart(canvas, config);
  }
}
