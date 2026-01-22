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
  AdminUserProfileStatsService,
  AdminUserProfileStats,
} from '../services/admin-user-profile-stats.service';
import {
  AdminAnalyticsService,
  DailyTotal,
  RankingItem,
  RecentConsumption,
} from '../services/admin-analytics.service';

import {
  AdminPivotService,
  PivotDimensionId,
  PivotMetric,
  PivotRow,
  ConsumptionLite,
  UserProfileLite,
} from '../services/admin-pivot.service';

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
  templateUrl: './AdminStatistic.html',
  styleUrl: './AdminStatistic.css',
})
export class AdminStatistic {
  private stats = inject(AdminStatsService);
  private analytics = inject(AdminAnalyticsService);
  private userProfileStatsSvc = inject(AdminUserProfileStatsService);
  private pivot = inject(AdminPivotService);
  private destroyRef = inject(DestroyRef);
  private nf = new Intl.NumberFormat('de-DE');

  @ViewChild('dailyCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pivotCanvas') private pivotCanvasRef?: ElementRef<HTMLCanvasElement>;

  // ------- KPIs (live via Count Queries)
  readonly usersCount = toSignal(this.stats.usersCount$, { initialValue: 0 });
  readonly adminsCount = toSignal(this.stats.adminsCount$, { initialValue: 0 });
  readonly bansCount = toSignal(this.stats.bansCount$, { initialValue: 0 });
  readonly locksCount = toSignal(this.stats.locksCount$, { initialValue: 0 });
  readonly onlineNowCount = toSignal(this.stats.onlineNowCount$, { initialValue: 0 });
  readonly active24hCount = toSignal(this.stats.active24hCount$, { initialValue: 0 });
  readonly consumptions7dCount = toSignal(this.stats.consumptions7dCount$, { initialValue: 0 });
  readonly consumptions30dCount = toSignal(this.stats.consumptions30dCount$, { initialValue: 0 });

  // ------- User-Profile Auswertung (clientseitig aggregiert)
  private readonly emptyProfileStats: AdminUserProfileStats = {
    totalUsers: 0,
    activeUsers: 0,
    lockedUsers: 0,
    bannedUsers: 0,
    deletedUsers: 0,
    adminUsers: 0,

    withFirstName: 0,
    withLastName: 0,
    withPhone: 0,
    withPhoto: 0,
    withBirthday: 0,
    withBio: 0,
    withWebsite: 0,
    withLocation: 0,
    withAnySocials: 0,

    visibilityShowBio: 0,
    visibilityShowWebsite: 0,
    visibilityShowLocation: 0,
    visibilityShowSocials: 0,

    gender: { male: 0, female: 0, diverse: 0, unspecified: 0 },
    public: { bio: 0, website: 0, location: 0, socials: 0 },
    friends: { withFriends: 0, totalFriendRefs: 0 },
  };

  readonly userProfileStats = toSignal(this.userProfileStatsSvc.stats$, {
    initialValue: this.emptyProfileStats,
  });

  readonly profileFieldMetrics = computed(() => {
    const s = this.userProfileStats();
    return [
      { label: 'Mit Foto', count: s.withPhoto },
      { label: 'Mit Vorname', count: s.withFirstName },
      { label: 'Mit Nachname', count: s.withLastName },
      { label: 'Mit Telefon', count: s.withPhone },
      { label: 'Mit Geburtstag', count: s.withBirthday },
      { label: 'Mit Bio', count: s.withBio },
      { label: 'Mit Website', count: s.withWebsite },
      { label: 'Mit Ort', count: s.withLocation },
      { label: 'Mit Social Links', count: s.withAnySocials },
    ];
  });

  readonly visibilityMetrics = computed(() => {
    const s = this.userProfileStats();
    return [
      { label: 'Bio öffentlich (Toggle AN)', count: s.visibilityShowBio },
      { label: 'Website öffentlich (Toggle AN)', count: s.visibilityShowWebsite },
      { label: 'Ort öffentlich (Toggle AN)', count: s.visibilityShowLocation },
      { label: 'Socials öffentlich (Toggle AN)', count: s.visibilityShowSocials },
    ];
  });

  readonly publicProfileMetrics = computed(() => {
    const s = this.userProfileStats();
    return [
      { label: 'Public Bio gesetzt', count: s.public.bio },
      { label: 'Public Website gesetzt', count: s.public.website },
      { label: 'Public Ort gesetzt', count: s.public.location },
      { label: 'Public Socials gesetzt', count: s.public.socials },
    ];
  });

  readonly genderMetrics = computed(() => {
    const g = this.userProfileStats().gender;
    return [
      { label: 'Keine Angabe', count: g.unspecified },
      { label: 'Männlich', count: g.male },
      { label: 'Weiblich', count: g.female },
      { label: 'Divers', count: g.diverse },
    ];
  });

  readonly friendsMetrics = computed(() => {
    const f = this.userProfileStats().friends;
    return [
      { label: 'User mit Freunden', count: f.withFriends },
      { label: 'Freundes-Referenzen gesamt', count: f.totalFriendRefs },
    ];
  });

  readonly kpis = computed<KpiVm[]>(() => [
    { label: 'Users', value: this.nf.format(this.usersCount()), icon: 'group' },
    { label: 'Admins', value: this.nf.format(this.adminsCount()), icon: 'admin_panel_settings' },
    { label: 'Online jetzt', value: this.nf.format(this.onlineNowCount()), icon: 'wifi' },
    { label: 'Aktiv (24h)', value: this.nf.format(this.active24hCount()), icon: 'bolt' },
    { label: 'Bans', value: this.nf.format(this.bansCount()), icon: 'block' },
    { label: 'Locks', value: this.nf.format(this.locksCount()), icon: 'lock' },
    { label: 'Logs (7 Tage)', value: this.nf.format(this.consumptions7dCount()), icon: 'timeline' },
    {
      label: 'Logs (30 Tage)',
      value: this.nf.format(this.consumptions30dCount()),
      icon: 'insights',
    },
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
  private pivotChart?: Chart;

  // ------- Pivot / Custom Builder (frei kombinierbar)
  readonly pivotLoading = signal<boolean>(false);
  readonly pivotDocs = signal<ConsumptionLite[]>([]);
  readonly pivotUsers = signal<Map<string, UserProfileLite>>(new Map());

  readonly pivotDimensions = signal<PivotDimensionId[]>(['product', 'location']);
  readonly pivotMetric = signal<PivotMetric>('logs');
  readonly pivotTopN = signal<number>(25);
  readonly pivotRows = signal<PivotRow[]>([]);

  readonly pivotColumns = computed<string[]>(() => {
    const dims = this.pivotDimensions();
    const metric = this.pivotMetric();
    return metric === 'uniqueUsers' ? [...dims, 'uniqueUsers', 'logs'] : [...dims, 'logs'];
  });

  readonly pivotDimGroups: { label: string; options: { id: PivotDimensionId; label: string }[] }[] =
    [
      {
        label: 'Konsum-Log',
        options: [
          { id: 'product', label: 'Produkt' },
          { id: 'device', label: 'Gerät' },
          { id: 'location', label: 'Ort (Log)' },
          { id: 'weekday', label: 'Wochentag' },
          { id: 'hour', label: 'Uhrzeit' },
          { id: 'platform', label: 'Plattform' },
          { id: 'hasGeo', label: 'Geo vorhanden' },
          { id: 'geoCell', label: 'Geo-Zelle' },
          { id: 'user', label: 'User' },
        ],
      },
      {
        label: 'User Profil',
        options: [
          { id: 'userGender', label: 'Geschlecht' },
          { id: 'userCity', label: 'Stadt' },
          { id: 'userCountry', label: 'Land' },
        ],
      },
    ];

  constructor() {
    // initial + on range change
    effect(() => {
      const days = this.rangeDays();
      void this.reload(days);
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
    this.destroyRef.onDestroy(() => this.pivotChart?.destroy());

    // Pivot Recompute (ohne neue Reads) bei UI-Änderungen
    effect(() => {
      const docs = this.pivotDocs();
      const dims = this.pivotDimensions();
      const metric = this.pivotMetric();
      const topN = this.pivotTopN();
      const users = this.pivotUsers();

      const rows = this.pivot.aggregateConsumptions({
        docs,
        userMap: users,
        dimensions: dims,
        metric,
        topN,
      });

      this.pivotRows.set(rows);
      queueMicrotask(() => this.renderPivotChart());
    });
  }

  async syncNow(): Promise<void> {
    this.isSyncing.set(true);
    try {
      const res = await this.analytics.syncConsumptions({ batchSize: 200, maxBatches: 20 });
      // danach neu laden
      await this.reload(this.rangeDays());
      if (res.processed > 0) {
        this.metaText.set(
          `Sync: +${this.nf.format(res.processed)} neue Logs • letzter Cursor: ${res.lastProcessedAt?.toLocaleString('de-DE') ?? '—'}`,
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

      // Pivot Builder lädt Rohdaten unabhängig vom stats_daily Sync
      await this.loadPivotRaw(days);

      queueMicrotask(() => this.renderChart());
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadPivotRaw(days: number): Promise<void> {
    this.pivotLoading.set(true);
    try {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
      start.setDate(start.getDate() - Math.max(days - 1, 0));

      const docs = await this.pivot.loadConsumptionsInRange({
        start,
        end,
        pageSize: 500,
        maxDocs: 8000,
      });
      this.pivotDocs.set(docs);

      // Profile lite nachladen (nur die UserIds, die wirklich im Zeitraum vorkommen)
      const uids = [...new Set(docs.map((d) => d.userId).filter(Boolean))];
      const userMap = await this.pivot.loadUserProfilesLite(uids);
      this.pivotUsers.set(userMap);
    } catch (e) {
      console.error('[admin statistics] pivot load failed', e);
      this.pivotDocs.set([]);
      this.pivotUsers.set(new Map());
    } finally {
      this.pivotLoading.set(false);
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

  pivotColLabel(col: string): string {
    const map: Record<string, string> = {
      product: 'Produkt',
      device: 'Gerät',
      location: 'Ort (Log)',
      weekday: 'Wochentag',
      hour: 'Uhrzeit',
      platform: 'Plattform',
      hasGeo: 'Geo',
      geoCell: 'Geo-Zelle',
      userGender: 'Geschlecht',
      userCity: 'Stadt',
      userCountry: 'Land',
      user: 'User',
      logs: 'Logs',
      uniqueUsers: 'Unique User',
    };
    return map[col] ?? col;
  }

  setPivotDimensions(v: PivotDimensionId[]) {
    this.pivotDimensions.set((v ?? []).filter(Boolean));
  }

  private renderPivotChart(): void {
    const canvas = this.pivotCanvasRef?.nativeElement;
    if (!canvas) return;
    this.pivotChart?.destroy();

    const rows = this.pivotRows();
    if (!rows.length) return;

    const metric = this.pivotMetric();
    const valueKey = metric === 'uniqueUsers' ? 'uniqueUsers' : 'logs';

    const dims = this.pivotDimensions();
    const labels = rows.map((r) => dims.map((d) => String(r[d] ?? '—')).join(' · '));
    const values = rows.map((r) => Number((r as any)[valueKey] ?? 0));

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: metric === 'uniqueUsers' ? 'Unique User' : 'Logs',
            data: values,
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
        plugins: {
          legend: { display: false },
        },
      },
    };

    this.pivotChart = new Chart(canvas, config);
  }
}
