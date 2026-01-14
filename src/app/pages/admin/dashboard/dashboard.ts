import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AdminStatsService } from '../services/admin-stats.service';
import { map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

type Kpi = { label: string; value: string; icon: string; link: string };

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AdminDashboardComponent {
  private stats = inject(AdminStatsService);
  private nf = new Intl.NumberFormat('de-DE');

  /** KPIs dynamisch: Users live, Rest erstmal hardcoded */
  kpis$: Observable<Kpi[]> = this.stats.usersCount$.pipe(
    map((count) => [
      { label: 'Users', value: this.nf.format(count), icon: 'group', link: '/admin/users' },
      { label: 'Reports', value: '12', icon: 'description', link: '/admin/reports' },
      { label: 'Events (live)', value: '3', icon: 'event', link: '/admin/events' },
      { label: 'Active Promos', value: '5', icon: 'local_offer', link: '/admin/promo' },
      { label: 'Conversion', value: '4.7%', icon: 'insights', link: '/admin/statistics' },
    ]),
    startWith([
      { label: 'Users', value: '…', icon: 'group', link: '/admin/users' },
      { label: 'Reports', value: '12', icon: 'description', link: '/admin/reports' },
      { label: 'Events (live)', value: '3', icon: 'event', link: '/admin/events' },
      { label: 'Active Promos', value: '5', icon: 'local_offer', link: '/admin/promo' },
      { label: 'Conversion', value: '4.7%', icon: 'insights', link: '/admin/statistics' },
    ])
  );

  quick = [
    { text: 'Neuen User anlegen', icon: 'person_add', link: '/admin/users' },
    { text: 'Report prüfen', icon: 'rule', link: '/admin/reports' },
    { text: 'Event erstellen', icon: 'add_circle', link: '/admin/events' },
    { text: 'Promo starten', icon: 'campaign', link: '/admin/promo' },
  ];

  inbox = [
    { title: 'Offene Reports', meta: 'prüfen & zuweisen', count: 12, link: '/admin/reports' },
    { title: 'User Fälle', meta: 'Support / Prüfung', count: 4, link: '/admin/users' },
    { title: 'Events heute', meta: 'Start in < 24h', count: 3, link: '/admin/events' },
  ];

  recentReports = [
    { id: 'r1', title: 'Spam-Verdacht: Kommentar', status: 'Neu', when: 'vor 5 Min' },
    { id: 'r2', title: 'User meldet Bug', status: 'Offen', when: 'vor 30 Min' },
  ];

  activity = [
    { id: 'a1', text: 'Mod Max hat Report #123 übernommen', when: 'vor 2 Min' },
    { id: 'a2', text: 'Admin hat Promo gestartet', when: 'heute 09:12' },
  ];
}
