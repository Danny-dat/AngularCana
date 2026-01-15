import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { Observable, of, combineLatest, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdminModerationService } from '../../services/admin-moderation.service';
import { BanDialogComponent } from './dialogs/ban-dialog';
import { LockDialogComponent } from './dialogs/lock-dialog';
import { ReasonDialogComponent } from './dialogs/reason-dialog';

type UserStatus = 'active' | 'locked' | 'banned' | 'deleted';

type UserDoc = {
  profile?: { displayName?: string };
  status?: { deletedAt?: any | null };
};

type PublicProfileDoc = {
  displayName?: string;
  username?: string;
  photoURL?: string;
  lastActiveAt?: any;
};

type BanDoc = {
  type: 'ban' | 'lock';
  until?: any | null;
  reason?: string;
};

type Vm = {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;

  roleLabel: 'admin' | 'user';
  status: UserStatus;
  statusLabel: string;

  lastActiveAt: any | null;
  deletedAt: any | null;
  ban: BanDoc | null;

  lockUntil: any | null;

  isOwner: boolean;
};

@Component({
  standalone: true,
  selector: 'app-admin-user-detail',
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-detail.html',
  styleUrls: ['./user-detail.css'],
})
export class AdminUserDetailComponent {
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private moderation = inject(AdminModerationService);

  /** Owner darf nicht gebannt/gesperrt/gelöscht werden */
  private readonly OWNER_UID = 'ZAz0Bnde5zYIS8qCDT86aOvEDX52';

  uid$: Observable<string> = this.route.paramMap.pipe(
    map(p => p.get('uid') ?? '')
  );

  private userDoc$ = this.uid$.pipe(
    switchMap(uid =>
      uid
        ? (docData(doc(this.firestore, 'users', uid)) as Observable<UserDoc>)
            .pipe(map(d => d ?? null), catchError(() => of(null)))
        : of(null)
    )
  );

  private profile$ = this.uid$.pipe(
    switchMap(uid =>
      uid
        ? (docData(doc(this.firestore, 'profiles_public', uid)) as Observable<PublicProfileDoc>)
            .pipe(map(d => d ?? null), catchError(() => of(null)))
        : of(null)
    )
  );

  private ban$ = this.uid$.pipe(
    switchMap(uid =>
      uid
        ? (docData(doc(this.firestore, 'banlist', uid)) as Observable<BanDoc>)
            .pipe(map(d => d ?? null), catchError(() => of(null)))
        : of(null)
    )
  );

  private isAdmin$ = this.uid$.pipe(
    switchMap(uid =>
      uid
        ? (docData(doc(this.firestore, 'admins', uid)) as Observable<any>)
            .pipe(map(() => true), catchError(() => of(false)))
        : of(false)
    )
  );

  vm$: Observable<Vm> = combineLatest([
    this.uid$,
    this.userDoc$,
    this.profile$,
    this.ban$,
    this.isAdmin$,
  ]).pipe(
    map(([uid, userDoc, profile, ban, isAdmin]) => {
      const deletedAt = userDoc?.status?.deletedAt ?? null;

      let status: UserStatus = 'active';
      let statusLabel = 'Aktiv';

      if (deletedAt) {
        status = 'deleted';
        statusLabel = 'Gelöscht';
      } else if (ban?.type === 'ban') {
        status = 'banned';
        statusLabel = 'Gebannt';
      } else if (ban?.type === 'lock') {
        status = 'locked';
        statusLabel = 'Gesperrt';
      }

      const displayName =
        profile?.displayName?.trim()
        || userDoc?.profile?.displayName?.trim()
        || (profile?.username ? `@${profile.username}` : '')
        || uid;

      return {
        uid,
        displayName,
        username: profile?.username ? `@${profile.username}` : '',
        photoURL: profile?.photoURL ?? null,

        roleLabel: isAdmin ? 'admin' : 'user',
        status,
        statusLabel,

        lastActiveAt: profile?.lastActiveAt ?? null,
        deletedAt,
        ban: ban ?? null,

        lockUntil: (ban?.type === 'lock' && ban?.until) ? ban.until : null,
        
        isOwner: uid === this.OWNER_UID,
      };
    })
  );

  // =========================
  // Helpers
  // =========================
  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }

  private ok(msg: string) {
    this.snack.open(msg, 'OK', { duration: 2500 });
  }

  private fail(msg: string) {
    this.snack.open(msg, 'OK', { duration: 3500 });
  }

  // =========================
  // Actions (Phase 2)
  // =========================
  async onBan(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    const res = await firstValueFrom(this.dialog.open(BanDialogComponent).afterClosed());
    if (!res) return;

    try {
      await this.moderation.banUser({
        targetUid,
        actorUid: await this.actorUid(),
        reason: res.reason,
        until: res.until,
      });
      this.ok('Bann gesetzt');
    } catch {
      this.fail('Bann fehlgeschlagen (Rules/Permissions?)');
    }
  }

  async onLock(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    const res = await firstValueFrom(this.dialog.open(LockDialogComponent).afterClosed());
    if (!res) return;

    try {
      await this.moderation.lockUser({
        targetUid,
        actorUid: await this.actorUid(),
        reason: res.reason,
        until: res.until,
      });
      this.ok('Sperre gesetzt');
    } catch {
      this.fail('Sperre fehlgeschlagen (Rules/Permissions?)');
    }
  }

  async onUnlock(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    try {
      await this.moderation.unlockUser({
        targetUid,
        actorUid: await this.actorUid(),
        reason: 'Manual unlock',
      });
      this.ok('Entsperrt');
    } catch {
      this.fail('Entsperren fehlgeschlagen (Rules/Permissions?)');
    }
  }

  async onSoftDelete(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    const res = await firstValueFrom(
      this.dialog.open(ReasonDialogComponent, {
        data: {
          title: 'User soft löschen',
          hint: 'User hat danach 0 Zugriff (wie gebannt).',
          required: true,
          confirmText: 'Soft Delete',
        },
      }).afterClosed()
    );

    if (!res) return;

    try {
      await this.moderation.softDeleteUser({
        targetUid,
        actorUid: await this.actorUid(),
        reason: res.reason,
      });
      this.ok('User gelöscht (soft)');
    } catch {
      this.fail('Soft Delete fehlgeschlagen (Rules/Permissions?)');
    }
  }

  async onRestore(targetUid: string) {
    if (!targetUid) return;

    const res = await firstValueFrom(
      this.dialog.open(ReasonDialogComponent, {
        data: {
          title: 'User wiederherstellen',
          hint: 'DeletedAt wird entfernt.',
          required: false,
          confirmText: 'Restore',
        },
      }).afterClosed()
    );

    if (!res) return;

    try {
      await this.moderation.restoreUser({
        targetUid,
        actorUid: await this.actorUid(),
        reason: res.reason,
      });
      this.ok('User restored');
    } catch {
      this.fail('Restore fehlgeschlagen (Rules/Permissions?)');
    }
  }
}
