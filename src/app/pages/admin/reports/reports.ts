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
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';

import { combineLatest, Observable, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

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

  status?: ReportStatus;

  assignedTo?: string | null;
  assignedAt?: any;

  resolvedBy?: string | null;
  resolvedAt?: any;
  resolutionNote?: string | null;

  createdAt?: any;
};

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
      return 'Neu';
    case 'in_review':
      return 'In Prüfung';
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
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class AdminReports {
  private afs = inject(Firestore);
  private auth = inject(Auth);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  statusCtrl = new FormControl<StatusFilter>('all', { nonNullable: true });

  displayedColumns: string[] = ['createdAt', 'scope', 'reporter', 'reported', 'message', 'status', 'actions'];

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
        // backward compatible: alte Reports hatten kein status/scope
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

      const filtered = rows.filter((r) => {
        if (status !== 'all' && r.statusFixed !== status) return false;
        if (!queryTxt) return true;

        const hay = [
          r.reporterId,
          r.reportedId,
          r.chatId ?? '',
          r.messageId ?? '',
          r.messageText ?? '',
          r.type ?? '',
          r.scopeFixed ?? '',
          r.statusFixed ?? '',
          r.assignedTo ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return hay.includes(queryTxt);
      });

      return filtered;
    })
  );

  async markInReview(r: ReportRow) {
    const actorUid = await this.actorUid();
    await updateDoc(doc(this.afs, 'reports', r.id), {
      status: 'in_review',
      assignedTo: r.assignedTo ?? actorUid,
      assignedAt: serverTimestamp(),
    } as any);
    this.snack.open('Report auf "In Prüfung" gesetzt', 'OK', { duration: 2500 });
  }

  async assignToMe(r: ReportRow) {
    const actorUid = await this.actorUid();
    await updateDoc(doc(this.afs, 'reports', r.id), {
      assignedTo: actorUid,
      assignedAt: serverTimestamp(),
      status: r.statusFixed === 'resolved' ? 'resolved' : 'in_review',
    } as any);
    this.snack.open('Report dir zugewiesen', 'OK', { duration: 2500 });
  }

  async resolve(r: ReportRow) {
    const res = await firstValueFrom(
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'Report erledigen',
            hint: 'Optional: Notiz / Ergebnis für die Doku (z. B. "User verwarnt", "kein Verstoß").',
            required: false,
            confirmText: 'Erledigen',
          },
        })
        .afterClosed()
    );

    const actorUid = await this.actorUid();

    await updateDoc(doc(this.afs, 'reports', r.id), {
      status: 'resolved',
      resolvedBy: actorUid,
      resolvedAt: serverTimestamp(),
      resolutionNote: res?.reason?.trim?.() || null,
    } as any);

    this.snack.open('Report erledigt', 'OK', { duration: 2500 });
  }

  async reopen(r: ReportRow) {
    await updateDoc(doc(this.afs, 'reports', r.id), {
      status: 'new',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
    } as any);
    this.snack.open('Report wieder geöffnet', 'OK', { duration: 2500 });
  }

  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }
}
