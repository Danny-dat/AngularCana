import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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

import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { ReasonDialogComponent } from '../dialogs/reason-dialog';
import { BanDialogComponent } from '../dialogs/ban-dialog';
import { LockDialogComponent } from '../dialogs/lock-dialog';
import { AdminModerationService } from '../services/admin-moderation.service';

type ReportStatus = 'new' | 'in_review' | 'resolved';
type ReportScope = 'direct' | 'channel' | 'group' | 'unknown';

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
    case 'new':
      return 'Offen';
    case 'in_review':
      return 'In Bearbeitung';
    case 'resolved':
      return 'Erledigt';
  }
}

function scopeLabel(s: ReportScope) {
  switch (s) {
    case 'direct':
      return 'Privat';
    case 'channel':
      return 'Global';
    case 'group':
      return 'Gruppe';
    default:
      return '—';
  }
}

function reasonLabel(cat?: string | null) {
  switch ((cat ?? '').toLowerCase()) {
    case 'spam':
      return 'Spam / Werbung';
    case 'harassment':
      return 'Belästigung / Mobbing';
    case 'hate':
      return 'Hass / Hetze';
    case 'misinfo':
      return 'Falsche Informationen';
    case 'illegal':
      return 'Illegale Inhalte';
    case 'other':
      return 'Sonstiges';
    default:
      return cat ? String(cat) : '—';
  }
}

type ReportsVm = {
  open: ReportRow[];
  inProgress: ReportRow[];
  done: ReportRow[];
  uid: string | null;
};

@Component({
  standalone: true,
  selector: 'app-admin-reports',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,

    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
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
  private router = inject(Router);
  private moderation = inject(AdminModerationService);
  // NOTE: router & moderation are injected once (avoid duplicate class members)

  readonly reasonLabel = reasonLabel;

  private userInfoCache = new Map<string, Observable<UserSummary>>();

  searchCtrl = new FormControl<string>('', { nonNullable: true });

  uid$: Observable<string | null> = user(this.auth).pipe(
    map((u) => u?.uid ?? null),
    startWith(null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private reportsRaw$: Observable<ReportDoc[]> = collectionData(
    query(collection(this.afs, 'reports'), orderBy('createdAt', 'desc'), limit(500)),
    { idField: 'id' },
  ) as Observable<ReportDoc[]>;

  /** Reports (convert + search filter) */
  private rowsFiltered$: Observable<ReportRow[]> = combineLatest([
    this.reportsRaw$,
    this.searchCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([docs, q]) => {
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
        } as ReportRow;
      });

      if (!queryTxt) return rows;

      return rows.filter((r) => {
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
          r.resolutionNote ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return hay.includes(queryTxt);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * VM für die Kanban-Ansicht:
   * - Offen: status=new (und ggf. in_review ohne assignedTo)
   * - In Bearbeitung: NUR die dem aktuellen Admin zugewiesenen (Ticket-System)
   * - Erledigt: status=resolved
   */
  vm$: Observable<ReportsVm> = combineLatest([this.rowsFiltered$, this.uid$]).pipe(
    map(([rows, uid]) => {
      const open = rows.filter(
        (r) => r.statusFixed === 'new' || (r.statusFixed === 'in_review' && !r.assignedTo),
      );
      const inProgress = uid
        ? rows.filter((r) => r.statusFixed === 'in_review' && r.assignedTo === uid)
        : [];
      const done = rows.filter((r) => r.statusFixed === 'resolved');
      return { open, inProgress, done, uid };
    }),
  );

  admins$: Observable<AdminItem[]> = collectionData(collection(this.afs, 'admins'), {
    idField: 'uid',
  }).pipe(
    map((docs: any[]) => docs.map((d) => String(d.uid)).filter(Boolean)),
    switchMap((uids: string[]) => {
      if (!uids.length) return of([] as AdminItem[]);
      return combineLatest(
        uids.map((uid) =>
          this.userInfo$(uid).pipe(
            map((u) => ({ uid: u.uid, name: u.name, email: u.email }) as AdminItem),
          ),
        ),
      );
    }),
    map((list) => list.sort((a, b) => a.name.localeCompare(b.name))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  trackById(_: number, r: ReportRow) {
    return r.id;
  }

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
        const name = (p?.username || p?.displayName || u?.displayName || u?.email || '')
          .toString()
          .trim();
        const email = u?.email || null ? String(u?.email) : null;

        return {
          uid: id,
          name: name || this.shortId(id, 6, 4),
          email,
        } as UserSummary;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
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
    await this.safeUpdate(
      r,
      {
        status: 'in_review',
        assignedTo: r.assignedTo ?? actorUid,
        assignedAt: serverTimestamp(),
      } as any,
      'Report auf "In Bearbeitung" gesetzt',
    );
  }

  async assignToMe(r: ReportRow) {
    if (r.statusFixed === 'resolved') return;
    const actorUid = await this.actorUid();
    await this.safeUpdate(
      r,
      {
        assignedTo: actorUid,
        assignedAt: serverTimestamp(),
        status: 'in_review',
      } as any,
      'Report dir zugewiesen',
    );
  }

  async assignTo(r: ReportRow, adminUid: string) {
    if (!adminUid || r.statusFixed === 'resolved') return;
    await this.safeUpdate(
      r,
      {
        assignedTo: adminUid,
        assignedAt: serverTimestamp(),
        status: 'in_review',
      } as any,
      'Report zugewiesen',
    );
  }

  async resolve(r: ReportRow) {
    if (r.statusFixed === 'resolved') return;

    const res = await firstValueFrom(
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'Report erledigen',
            hint: 'Optional: Notiz / Ergebnis (z. B. "User verwarnt", "kein Verstoß").',
            required: false,
            confirmText: 'Erledigen',
          },
        })
        .afterClosed(),
    );

    const actorUid = await this.actorUid();

    await this.safeUpdate(
      r,
      {
        status: 'resolved',
        resolvedBy: actorUid,
        resolvedAt: serverTimestamp(),
        resolutionNote: res?.reason?.trim?.() || null,
      } as any,
      'Report erledigt',
    );
  }

  async reopen(r: ReportRow) {
    await this.safeUpdate(
      r,
      {
        status: 'new',
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      } as any,
      'Report wieder geöffnet',
    );
  }

  openChat(uid: string, ev?: Event) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    void this.router.navigate(['/social'], { queryParams: { openChatWith: uid } });
  }

  async ban(uid: string) {
    const res = await firstValueFrom(
      this.dialog
        .open(BanDialogComponent, {
          data: { uid, displayName: uid },
        })
        .afterClosed(),
    );
    if (!res) return;

    try {
      await this.moderation.banUser({
        targetUid: uid,
        actorUid: await this.actorUid(),
        reason: res.reason ?? '',
        until: res.until ?? null,
      });
      this.snack.open('User gebannt', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Bannen fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async lock(uid: string) {
    const res = await firstValueFrom(
      this.dialog
        .open(LockDialogComponent, {
          data: { uid, displayName: uid },
        })
        .afterClosed(),
    );
    if (!res) return;

    try {
      await this.moderation.lockUser({
        targetUid: uid,
        actorUid: await this.actorUid(),
        reason: res.reason ?? '',
        until: res.until,
      });
      this.snack.open('User gesperrt', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Sperren fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async unblock(uid: string) {
    try {
      await this.moderation.unlockUser({ targetUid: uid, actorUid: await this.actorUid() });
      this.snack.open('Sperre/Ban aufgehoben', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Entsperren fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }
}
