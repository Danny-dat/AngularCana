/* istanbul ignore file */
import { Component, DestroyRef, effect, inject, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatisticsService, StatsRange } from '../../services/statistics.service';
import { Chart, type ChartConfiguration } from 'chart.js/auto';
import { Auth, user as authUser } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements AfterViewInit {
  private statsSvc = inject(StatisticsService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(Auth);

  @ViewChild('consumptionCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  // Auth
  readonly uid = signal<string>('');

  // UI-State
  readonly range = signal<StatsRange>('week');          // Start = Woche
  readonly labels = signal<string[]>([]);
  readonly values = signal<number[]>([]);
  readonly rankings = signal({ byProduct: [] as {name:string;count:number}[], byDevice: [] as {name:string;count:number}[], byPair: [] as {name:string;count:number}[] });
  readonly isLoading = signal<boolean>(false);

  // Custom-Range
  readonly minDate = signal<string>(''); // yyyy-MM-dd (Registrierung)
  readonly maxDate = signal<string>(''); // heute
  readonly startDate = signal<string>(''); // für Custom
  readonly endDate   = signal<string>(''); // für Custom

  readonly hasData = computed(() => this.values().some(v => v > 0));
  readonly totalCount = computed(() => this.values().reduce((a,b)=>a+b, 0));

  private chart?: Chart;

  constructor() {
    authUser(this.auth).subscribe(u => {
      this.uid.set(u?.uid ?? '');
      // frühester Zeitpunkt = Registrierungsdatum (aus Auth-Metadata)
      const created = u?.metadata?.creationTime ? new Date(u.metadata.creationTime) : new Date();
      const today = new Date();
      const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      this.minDate.set(toStr(created));
      this.maxDate.set(toStr(today));
      // Default-Custom: von Registrierung bis heute
      this.startDate.set(toStr(created));
      this.endDate.set(toStr(today));
    });

    // neu laden bei UID/Range
    effect(() => {
      const uid = this.uid(); const r = this.range();
      if (!uid) return;
      void this.load(uid, r);
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.renderChart());
  }

  async load(uid: string, range: StatsRange): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.statsSvc.loadAdvancedConsumptionStats(
        uid,
        range,
        range === 'custom' ? {
          start: new Date(this.startDate()),
          end:   new Date(this.endDate())
        } : undefined
      );

      this.labels.set(data.chartLabels);
      this.values.set(data.chartValues);
      this.rankings.set(data.rankings);

      queueMicrotask(() => this.renderChart());
    } finally {
      this.isLoading.set(false);
    }
  }

  setRange(r: StatsRange): void {
    this.range.set(r);
  }

  applyCustomRange(): void {
    this.setRange('custom');
  }

  private renderChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) { setTimeout(()=>this.renderChart(), 0); return; }
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
        animation: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    };
    this.chart = new Chart(canvas, config);
  }
}
