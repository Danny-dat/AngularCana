import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AdminStatsService } from '../services/admin-stats.service';
import {
  Firestore,
  collection,
  collectionData,
  limit,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

type Kpi = { label: string; value: string; icon: string; link: string };

type InboxItem = { title: string; meta: string; count: number; link: string };

type RecentReportVm = {
  id: string;
  title: string;
  status: string;
  when: string;
  link: any;
};

type ActivityVm = { id: string; icon: string; title: string; detail: string; when: string };

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './AdminDashboard.html',
  styleUrl: './AdminDashboard.css',
})
export class AdminDashboardComponent {
  private stats = inject(AdminStatsService);
  private afs = inject(Firestore);
  private nf = new Intl.NumberFormat('de-DE');

  /** KPIs live */
  kpis$: Observable<Kpi[]> = combineLatest([
    this.stats.usersCount$,
    this.stats.reportsOpenCount$,
    this.stats.eventsCount$,
    this.stats.promoSlotsActiveCount$,
    this.stats.promoSlotsCount$,
    this.stats.onlineNowCount$,
  ]).pipe(
    map(([users, openReports, events, promoActive, promoTotal, onlineNow]) => {
      const promoValue =
        promoTotal > 0
          ? `${this.nf.format(promoActive)}/${this.nf.format(promoTotal)}`
          : this.nf.format(promoActive);

      return [
        { label: 'Users', value: this.nf.format(users), icon: 'group', link: '/admin/users' },
        {
          label: 'Offene Reports',
          value: this.nf.format(openReports),
          icon: 'rule',
          link: '/admin/reports',
        },
        { label: 'Events', value: this.nf.format(events), icon: 'event', link: '/admin/events' },
        { label: 'Promo Slots', value: promoValue, icon: 'local_offer', link: '/admin/promo' },
        {
          label: 'Online jetzt',
          value: this.nf.format(onlineNow),
          icon: 'wifi',
          link: '/admin/statistics',
        },
      ];
    }),
    startWith([
      { label: 'Users', value: '…', icon: 'group', link: '/admin/users' },
      { label: 'Offene Reports', value: '…', icon: 'rule', link: '/admin/reports' },
      { label: 'Events', value: '…', icon: 'event', link: '/admin/events' },
      { label: 'Promo Slots', value: '…', icon: 'local_offer', link: '/admin/promo' },
      { label: 'Online jetzt', value: '…', icon: 'wifi', link: '/admin/statistics' },
    ]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  quick: Array<{
    text: string;
    icon: string;
    link: string;
    queryParams?: Record<string, any>;
  }> = [
    // öffnet direkt den "User anlegen" Dialog (users Seite liest queryParam)
    {
      text: 'Neuen User anlegen',
      icon: 'person_add',
      link: '/admin/users',
      queryParams: { create: 1 },
    },
    { text: 'Reports prüfen', icon: 'rule', link: '/admin/reports' },
    { text: 'Events verwalten', icon: 'event', link: '/admin/events' },
    { text: 'Promo verwalten', icon: 'local_offer', link: '/admin/promo' },
  ];

  /** Inbox: Counts live */
  inbox$: Observable<InboxItem[]> = combineLatest([
    this.stats.reportsOpenCount$,
    this.stats.eventSuggestionsOpenCount$,
    this.stats.bansCount$,
    this.stats.locksCount$,
  ]).pipe(
    map(([openReports, openSuggestions, bans, locks]) => [
      {
        title: 'Offene Reports',
        meta: 'prüfen & zuweisen',
        count: openReports,
        link: '/admin/reports',
      },
      {
        title: 'Event-Vorschläge',
        meta: 'offen · annehmen / ablehnen',
        count: openSuggestions,
        link: '/admin/events',
      },
      {
        title: 'Moderation aktiv',
        meta: `Bans: ${this.nf.format(bans)} · Locks: ${this.nf.format(locks)}`,
        count: bans + locks,
        link: '/admin/users',
      },
    ]),
    startWith([
      { title: 'Offene Reports', meta: 'prüfen & zuweisen', count: 0, link: '/admin/reports' },
      {
        title: 'Event-Vorschläge',
        meta: 'offen · annehmen / ablehnen',
        count: 0,
        link: '/admin/events',
      },
      { title: 'Moderation aktiv', meta: 'Bans/L... ', count: 0, link: '/admin/users' },
    ]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Neueste Reports (live) */
  recentReports$: Observable<RecentReportVm[]> = (
    collectionData(query(collection(this.afs, 'reports'), orderBy('createdAt', 'desc'), limit(5)), {
      idField: 'id',
    }) as Observable<any[]>
  ).pipe(
    map((rows) =>
      (rows || []).map((r) => {
        const createdAt = this.toDateSafe(r?.createdAt);
        const status = this.reportStatusLabel(r?.status);
        const title = this.reportTitle(r);
        return {
          id: String(r?.id ?? ''),
          title,
          status,
          when: createdAt ? createdAt.toLocaleString('de-DE') : '—',
          link: '/admin/reports',
        } satisfies RecentReportVm;
      }),
    ),
    catchError(() => of([] as RecentReportVm[])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Letzte Aktivitäten (Audit Logs) */
  activity$: Observable<ActivityVm[]> = (
    collectionData(
      query(collection(this.afs, 'audit_logs'), orderBy('timestamp', 'desc'), limit(8)),
      { idField: 'id' },
    ) as Observable<any[]>
  ).pipe(
    map((rows) =>
      (rows || []).map((a) => {
        const d = this.toDateSafe(a?.timestamp);
        const action = String(a?.action ?? 'ACTION');
        const target = this.shortUid(String(a?.targetUid ?? ''));
        const actor = this.shortUid(String(a?.actorUid ?? ''));
        const reason = (a?.reason ?? '').toString().trim();

        const icon = this.auditIcon(action);
        const title = this.auditTitle(action, target);
        const detail = this.auditDetail(action, actor, reason);
        return {
          id: String(a?.id ?? ''),
          icon,
          title,
          detail,
          when: d ? d.toLocaleString('de-DE') : '—',
        } satisfies ActivityVm;
      }),
    ),
    catchError(() => of([] as ActivityVm[])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private toDateSafe(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    return null;
  }

  private reportStatusLabel(status: any): string {
    switch (String(status ?? 'new')) {
      case 'new':
        return 'Neu';
      case 'in_review':
        return 'In Prüfung';
      case 'resolved':
        return 'Erledigt';
      default:
        return String(status ?? '—');
    }
  }

  private reportTitle(r: any): string {
    const cat = String(r?.reasonCategory ?? '').toLowerCase();
    const catLabel =
      cat === 'spam'
        ? 'Spam / Werbung'
        : cat === 'harassment'
          ? 'Belästigung / Mobbing'
          : cat === 'hate'
            ? 'Hass / Hetze'
            : cat === 'misinfo'
              ? 'Falsche Informationen'
              : cat === 'illegal'
                ? 'Illegale Inhalte'
                : cat === 'other'
                  ? 'Sonstiges'
                  : r?.reasonCategory
                    ? String(r.reasonCategory)
                    : 'Report';

    const msg = (r?.messageText ?? '').toString().trim();
    const snippet = msg ? ` · ${msg.slice(0, 42)}${msg.length > 42 ? '…' : ''}` : '';
    return `${catLabel}${snippet}`;
  }

  private auditIcon(action: string): string {
    switch (String(action ?? '')) {
      case 'BAN':
        return 'gavel';
      case 'LOCK':
        return 'lock';
      case 'UNLOCK':
        return 'lock_open';
      case 'SOFT_DELETE':
        return 'delete';
      case 'RESTORE':
        return 'restore';
      case 'CREATE_USER':
        return 'person_add';
      default:
        return 'history';
    }
  }

  private auditTitle(action: string, target: string): string {
    switch (String(action ?? 'ACTION')) {
      case 'BAN':
        return `Ban · ${target}`;
      case 'LOCK':
        return `Sperre · ${target}`;
      case 'UNLOCK':
        return `Entsperrt · ${target}`;
      case 'SOFT_DELETE':
        return `Gelöscht · ${target}`;
      case 'RESTORE':
        return `Wiederhergestellt · ${target}`;
      case 'CREATE_USER':
        return `User erstellt · ${target}`;
      default:
        return `${action} · ${target}`;
    }
  }

  private auditDetail(action: string, actor: string, reason: string): string {
    if (reason) return reason;
    if (String(action ?? '') === 'CREATE_USER') return `by ${actor}`;
    return actor ? `by ${actor}` : '';
  }

  private auditText(a: any): string {
    const action = String(a?.action ?? 'ACTION');
    const target = this.shortUid(String(a?.targetUid ?? ''));
    const actor = this.shortUid(String(a?.actorUid ?? ''));
    const reason = (a?.reason ?? '').toString().trim();

    switch (action) {
      case 'BAN':
        return `BAN · ${target}${reason ? ` · ${reason}` : ''}`;
      case 'LOCK':
        return `LOCK · ${target}${reason ? ` · ${reason}` : ''}`;
      case 'UNLOCK':
        return `UNLOCK · ${target}${reason ? ` · ${reason}` : ''}`;
      case 'SOFT_DELETE':
        return `SOFT DELETE · ${target}${reason ? ` · ${reason}` : ''}`;
      case 'RESTORE':
        return `RESTORE · ${target}${reason ? ` · ${reason}` : ''}`;
      case 'CREATE_USER':
        return `CREATE USER · ${target} · by ${actor}`;
      default:
        return `${action} · ${target} · by ${actor}`;
    }
  }

  private shortUid(uid: string): string {
    const v = (uid ?? '').toString();
    if (!v) return '—';
    if (v.length <= 12) return v;
    return `${v.slice(0, 6)}…${v.slice(-4)}`;
  }
}
