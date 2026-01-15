import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Auth, user } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';

import { combineLatest, Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap } from 'rxjs/operators';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { ReasonDialogComponent } from '../dialogs/reason-dialog';

type ReportStatus = 'new' | 'in_review' | 'resolved';
type ReportScope = 'direct' | 'channel' | 'group' | 'unknown';
type StatusFilter = 'all' | ReportStatus;

type ReportDoc = {
  id: string;
  type?: string;

  scope?: ReportScope;
  chatId?: string;

  reporterId: string;
  reportedId: string;

  messageId?: string | null;
  messageText?: string;

  reasonCategory?: string;
  reasonText?: string | null;

  status?: ReportStatus;

  assignedTo?: string | null;
  assignedAt?: any;

  resolvedBy?: string | null;
  resolvedAt?: any;
  resolutionNote?: string | null;

  createdAt?: any;
};

type UserSummary = {
  uid: string;
  name: string;
  email: string | null;
};

type AdminItem = { uid: string; name: string; email?: string | null };

type ReportRow = ReportDoc & {
  createdAtDate: Date | null;
  statusFixed: ReportStatus;
  scopeFixed: ReportScope;
  statusLabel: string;
  scopeLabel: string;
};

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  return null;
}

function statusLabel(s: ReportStatus) {
  switch (s) {
    case 'new': return 'Neu';
    case 'in_review': return 'In Prüfung';
    case 'resolved': return 'Erledigt';
  }
}

function scopeLabel(s: ReportScope) {
  switch (s) {
    case 'direct': return 'Privat';
    case 'channel': return 'Global';
    case 'group': return 'Gruppe';
    default: return '—';
  }
}

function reasonLabel(cat?: string | null) {
  switch ((cat ?? '').toLowerCase()) {
    case 'spam': return 'Spam / Werbung';
    case 'harassment': return 'Belästigung / Mobbing';
    case 'hate': return 'Hass / Hetze';
    case 'misinfo': return 'Falsche Informationen';
    case 'illegal': return 'Illegale Inhalte';
    case 'other': return 'Sonstiges';
    default: return cat ? String(cat) : '—';
  }
}

@Component({
  standalone: true,
  selector: 'app-admin-reports',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,

    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css'],
})
export class AdminReports {
  private afs = inject(Firestore);
  private auth = inject(Auth);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  readonly reasonLabel = reasonLabel;

  private userInfoCache = new Map<string, Observable<UserSummary>>();

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  statusCtrl = new FormControl<StatusFilter>('all', { nonNullable: true });

  displayedColumns: string[] = [
    'createdAt',
    'scope',
    'reporter',
    'reported',
    'message',
    'reason',
    'status',
    'actions',
  ];

  private reportsRaw$: Observable<ReportDoc[]> = collectionData(
    query(collection(this.afs, 'reports'), orderBy('createdAt', 'desc'), limit(500)),
    { idField: 'id' }
  ) as Observable<ReportDoc[]>;

  rows$: Observable<ReportRow[]> = combineLatest([
    this.reportsRaw$,
    this.searchCtrl.valueChanges.pipe(startWith('')),
    this.statusCtrl.valueChanges.pipe(startWith('all' as StatusFilter)),
  ]).pipe(
    map(([docs, q, status]) => {
      const queryTxt = (q ?? '').trim().toLowerCase();

      const rows = docs.map((r) => {
        const inferredScope: ReportScope =
          (r.scope as ReportScope) ??
          (r.chatId === 'global' ? 'channel' : r.chatId ? 'direct' : 'unknown');

        const fixedStatus: ReportStatus = (r.status as ReportStatus) ?? 'new';

        return {
          ...r,
          createdAtDate: toDateSafe(r.createdAt),
          statusFixed: fixedStatus,
          scopeFixed: inferredScope,
          statusLabel: statusLabel(fixedStatus),
          scopeLabel: scopeLabel(inferredScope),
        };
      });

      return rows.filter((r) => {
        if (status !== 'all' && r.statusFixed !== status) return false;
        if (!queryTxt) return true;

        const hay = [
          r.reporterId,
          r.reportedId,
          r.chatId ?? '',
          r.messageId ?? '',
          r.messageText ?? '',
          r.reasonCategory ?? '',
          r.reasonText ?? '',
          r.statusFixed ?? '',
          r.assignedTo ?? '',
        ].join(' ').toLowerCase();

        return hay.includes(queryTxt);
      });
    })
  );

  admins$: Observable<AdminItem[]> = collectionData(
    collection(this.afs, 'admins'),
    { idField: 'uid' }
  ).pipe(
    map((docs: any[]) => docs.map(d => String(d.uid)).filter(Boolean)),
    switchMap((uids: string[]) => {
      if (!uids.length) return of([] as AdminItem[]);
      return combineLatest(
        uids.map(uid =>
          this.userInfo$(uid).pipe(map(u => ({ uid: u.uid, name: u.name, email: u.email } as AdminItem)))
        )
      );
    }),
    map(list => list.sort((a, b) => a.name.localeCompare(b.name))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  shortId(id: string | null | undefined, start = 6, end = 4): string {
    const v = (id ?? '').toString();
    if (!v) return '—';
    if (v.length <= start + end + 1) return v;
    return `${v.slice(0, start)}…${v.slice(-end)}`;
  }

  userInfo$(uid: string | null | undefined): Observable<UserSummary> {
    const id = (uid ?? '').toString();
    if (!id) return of({ uid: '', name: '—', email: null });

    const cached = this.userInfoCache.get(id);
    if (cached) return cached;

    const profileRef = doc(this.afs, 'profiles_public', id);
    const userRef = doc(this.afs, 'users', id);

    const profile$ = docData(profileRef).pipe(catchError(() => of(null as any)));
    const user$ = docData(userRef).pipe(catchError(() => of(null as any)));

    const obs = combineLatest([profile$, user$]).pipe(
      map(([p, u]) => {
        const name =
          (p?.username || p?.displayName || u?.displayName || u?.email || '').toString().trim();
        const email = (u?.email || null) ? String(u?.email) : null;

        return {
          uid: id,
          name: name || this.shortId(id, 6, 4),
          email,
        } as UserSummary;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.userInfoCache.set(id, obs);
    return obs;
  }

  // ---- Actions -------------------------------------------------------------

  private async safeUpdate(r: ReportRow, data: any, okMsg: string) {
    try {
      await updateDoc(doc(this.afs, 'reports', r.id), data);
      this.snack.open(okMsg, 'OK', { duration: 2000 });
    } catch (e) {
      console.error('Update fehlgeschlagen', e);
      this.snack.open('Aktion fehlgeschlagen (Permissions?)', 'OK', { duration: 3000 });
    }
  }

  async markInReview(r: ReportRow) {
    if (r.statusFixed === 'resolved') return;
    const actorUid = await this.actorUid();
    await this.safeUpdate(r, {
      status: 'in_review',
      assignedTo: r.assignedTo ?? actorUid,
      assignedAt: serverTimestamp(),
    } as any, 'Report auf "In Prüfung" gesetzt');
  }

  async assignToMe(r: ReportRow) {
    if (r.statusFixed === 'resolved') return;
    const actorUid = await this.actorUid();
    await this.safeUpdate(r, {
      assignedTo: actorUid,
      assignedAt: serverTimestamp(),
      status: 'in_review',
    } as any, 'Report dir zugewiesen');
  }

  async assignTo(r: ReportRow, adminUid: string) {
    if (!adminUid || r.statusFixed === 'resolved') return;
    await this.safeUpdate(r, {
      assignedTo: adminUid,
      assignedAt: serverTimestamp(),
      status: 'in_review',
    } as any, 'Report zugewiesen');
  }

  async resolve(r: ReportRow) {
    if (r.statusFixed === 'resolved') return;

    const res = await firstValueFrom(
      this.dialog.open(ReasonDialogComponent, {
        data: {
          title: 'Report erledigen',
          hint: 'Optional: Notiz / Ergebnis (z. B. "User verwarnt", "kein Verstoß").',
          required: false,
          confirmText: 'Erledigen',
        },
      }).afterClosed()
    );

    const actorUid = await this.actorUid();

    await this.safeUpdate(r, {
      status: 'resolved',
      resolvedBy: actorUid,
      resolvedAt: serverTimestamp(),
      resolutionNote: res?.reason?.trim?.() || null,
    } as any, 'Report erledigt');
  }

  async reopen(r: ReportRow) {
    await this.safeUpdate(r, {
      status: 'new',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
    } as any, 'Report wieder geöffnet');
  }

  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }
}
