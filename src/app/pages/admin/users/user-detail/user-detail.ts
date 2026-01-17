import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';
import { Observable, of, combineLatest, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import {
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdminModerationService } from '../../services/admin-moderation.service';
import { UserDataService, UserDataModel } from '../../../../services/user-data.service';
import { ProfileService } from '../../../../services/profile.service';
import { AVATAR_PRESETS, AvatarPreset } from '../../../../utils/avatar-presets';
import { BanDialogComponent } from '../../dialogs/ban-dialog';
import { LockDialogComponent } from '../../dialogs/lock-dialog';
import { ReasonDialogComponent } from '../../dialogs/reason-dialog';

type UserStatus = 'active' | 'locked' | 'banned' | 'deleted';

type UserDoc = {
  email?: string | null;
  displayName?: string | null; // legacy
  phoneNumber?: string | null; // legacy
  profile?: {
    displayName?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
    photoURL?: string | null;
    bio?: string | null;
    website?: string | null;
    location?: { city?: string | null; country?: string | null };
    birthday?: string | null;
    gender?: string | null;
    socials?: any;
    visibility?: any;
  };
  status?: { deletedAt?: any | null };
};

type PublicProfileDoc = {
  displayName?: string;
  username?: string;
  photoURL?: string;
  bio?: string | null;
  website?: string | null;
  locationText?: string | null;
  socials?: any;
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
  canManageAdmins: boolean;
};

@Component({
  standalone: true,
  selector: 'app-admin-user-detail',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
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
  private destroyRef = inject(DestroyRef);

  private fb = inject(FormBuilder);
  private userDataSvc = inject(UserDataService);
  private profileSvc = inject(ProfileService);

  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private moderation = inject(AdminModerationService);

  savingProfile = signal(false);

  editForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.maxLength(50)]],
    username: ['', [Validators.maxLength(20), Validators.pattern(/^[a-z0-9_]{3,20}$/)]],
    firstName: ['', [Validators.maxLength(40)]],
    lastName: ['', [Validators.maxLength(60)]],
    email: [{ value: '', disabled: true }],
    phoneNumber: [''],
    photoURL: ['', [Validators.maxLength(300)]],
    bio: ['', [Validators.maxLength(280)]],
    website: ['', [Validators.maxLength(200)]],
    city: ['', [Validators.maxLength(80)]],
    country: ['', [Validators.maxLength(80)]],
    birthday: [''],
    gender: ['unspecified'],

    instagram: ['', [Validators.maxLength(60)]],
    tiktok: ['', [Validators.maxLength(60)]],
    youtube: ['', [Validators.maxLength(120)]],
    discord: ['', [Validators.maxLength(60)]],
    telegram: ['', [Validators.maxLength(60)]],

    showBio: [true],
    showWebsite: [true],
    showLocation: [true],
    showSocials: [true],
  });

  // Spark Plan: Avatar Presets aus /assets
  avatarPresets: AvatarPreset[] = AVATAR_PRESETS;

  selectAvatar(path: string | null) {
    this.editForm.controls.photoURL.setValue(path ?? '');
    this.editForm.markAsDirty();
  }

  isAvatarSelected(path: string | null): boolean {
    return (this.editForm.getRawValue().photoURL ?? '') === (path ?? '');
  }

  /** Owner darf nicht gebannt/gesperrt/gelöscht werden */
  private readonly OWNER_UID = 'ZAz0Bnde5zYIS8qCDT86aOvEDX52';

  constructor() {
    // Form initial befüllen
    combineLatest([this.uid$, this.userDoc$, this.profile$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([uid, userDoc, pub]) => {
        if (!uid) return;
        const displayName =
          pub?.displayName?.trim() ||
          userDoc?.profile?.displayName?.trim() ||
          (userDoc?.displayName ?? '').trim() ||
          uid;

        this.editForm.reset(
          {
            displayName,
            username: (pub?.username ?? userDoc?.profile?.username ?? '').toString(),
            firstName: userDoc?.profile?.firstName ?? '',
            lastName: userDoc?.profile?.lastName ?? '',
            email: userDoc?.email ?? '',
            phoneNumber: userDoc?.profile?.phoneNumber ?? userDoc?.phoneNumber ?? '',
            photoURL: pub?.photoURL ?? userDoc?.profile?.photoURL ?? '',
            bio: pub?.bio ?? userDoc?.profile?.bio ?? '',
            website: pub?.website ?? userDoc?.profile?.website ?? '',
            city: userDoc?.profile?.location?.city ?? '',
            country: userDoc?.profile?.location?.country ?? '',
            birthday: userDoc?.profile?.birthday ?? '',
            gender: userDoc?.profile?.gender ?? 'unspecified',
            instagram: userDoc?.profile?.socials?.instagram ?? '',
            tiktok: userDoc?.profile?.socials?.tiktok ?? '',
            youtube: userDoc?.profile?.socials?.youtube ?? '',
            discord: userDoc?.profile?.socials?.discord ?? '',
            telegram: userDoc?.profile?.socials?.telegram ?? '',
            showBio: userDoc?.profile?.visibility?.showBio ?? true,
            showWebsite: userDoc?.profile?.visibility?.showWebsite ?? true,
            showLocation: userDoc?.profile?.visibility?.showLocation ?? true,
            showSocials: userDoc?.profile?.visibility?.showSocials ?? true,
          },
          { emitEvent: false }
        );

        this.editForm.markAsPristine();
      });
  }

  uid$: Observable<string> = this.route.paramMap.pipe(map((p) => p.get('uid') ?? ''));

  private actorUid$ = user(this.auth).pipe(
    map((u) => u?.uid ?? ''),
    catchError(() => of(''))
  );

  private userDoc$ = this.uid$.pipe(
    switchMap((uid) =>
      uid
        ? (docData(doc(this.firestore, 'users', uid)) as Observable<UserDoc>).pipe(
            map((d) => d ?? null),
            catchError(() => of(null))
          )
        : of(null)
    )
  );

  private profile$ = this.uid$.pipe(
    switchMap((uid) =>
      uid
        ? (docData(doc(this.firestore, 'profiles_public', uid)) as Observable<PublicProfileDoc>).pipe(
            map((d) => d ?? null),
            catchError(() => of(null))
          )
        : of(null)
    )
  );

  private ban$ = this.uid$.pipe(
    switchMap((uid) =>
      uid
        ? (docData(doc(this.firestore, 'banlist', uid)) as Observable<BanDoc>).pipe(
            map((d) => d ?? null),
            catchError(() => of(null))
          )
        : of(null)
    )
  );

  private isAdmin$ = this.uid$.pipe(
    switchMap((uid) =>
      uid
        ? (docData(doc(this.firestore, 'admins', uid)) as Observable<any>).pipe(
            map((d) => !!d),
            catchError(() => of(false))
          )
        : of(false)
    )
  );

  vm$: Observable<Vm> = combineLatest([
    this.uid$,
    this.userDoc$,
    this.profile$,
    this.ban$,
    this.isAdmin$,
    this.actorUid$,
  ]).pipe(
    map(([uid, userDoc, profile, ban, isAdmin, actorUid]) => {
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
        profile?.displayName?.trim() ||
        userDoc?.profile?.displayName?.trim() ||
        (profile?.username ? `@${profile.username}` : '') ||
        uid;

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

        lockUntil: ban?.type === 'lock' && ban?.until ? ban.until : null,

        isOwner: uid === this.OWNER_UID,
        canManageAdmins: actorUid === this.OWNER_UID,
      };
    })
  );

  async saveProfileAdmin() {
    const uid = await firstValueFrom(this.uid$);
    if (!uid || this.editForm.invalid) return;

    this.savingProfile.set(true);

    const raw = this.editForm.getRawValue();
    const displayName = (raw.displayName ?? '').trim();
    const username = (raw.username ?? '').trim().toLowerCase();

    const normUrl = (value: string) => {
      const v = (value ?? '').trim();
      if (!v) return null;
      if (!/^https?:\/\//i.test(v)) return `https://${v}`;
      return v;
    };

    const city = (raw.city ?? '').trim();
    const country = (raw.country ?? '').trim();
    const locationText = [city, country].filter(Boolean).join(', ') || null;

    try {
      // Username uniqueness check (optional)
      if (username) {
        const ok = await this.userDataSvc.isUsernameAvailable(username, uid);
        if (!ok) {
          this.editForm.controls.username.setErrors({ ...(this.editForm.controls.username.errors ?? {}), taken: true });
          this.snack.open('Username ist bereits vergeben.', 'OK', { duration: 3000 });
          return;
        }
      }

      const payload: Partial<UserDataModel> = {
        displayName,
        username: username || null,
        firstName: (raw.firstName ?? '').trim() || null,
        lastName: (raw.lastName ?? '').trim() || null,
        phoneNumber: (raw.phoneNumber ?? '').trim() || null,
        photoURL: (raw.photoURL ?? '').trim() || null,
        bio: (raw.bio ?? '').trim() || null,
        website: normUrl(raw.website ?? ''),
        city: city || null,
        country: country || null,
        birthday: (raw.birthday ?? '').trim() || null,
        gender: (raw.gender as any) ?? 'unspecified',
        socials: {
          instagram: (raw.instagram ?? '').trim() || null,
          tiktok: (raw.tiktok ?? '').trim() || null,
          youtube: (raw.youtube ?? '').trim() || null,
          discord: (raw.discord ?? '').trim() || null,
          telegram: (raw.telegram ?? '').trim() || null,
        },
        visibility: {
          showBio: !!raw.showBio,
          showWebsite: !!raw.showWebsite,
          showLocation: !!raw.showLocation,
          showSocials: !!raw.showSocials,
        },
      };

      await this.userDataSvc.saveUserData(uid, payload);

      await this.profileSvc.updatePublicProfile(uid, {
        displayName,
        username: username || null,
        photoURL: (raw.photoURL ?? '').trim() || null,
        bio: raw.showBio ? (raw.bio ?? '').trim() || null : null,
        website: raw.showWebsite ? normUrl(raw.website ?? '') : null,
        locationText: raw.showLocation ? locationText : null,
        socials: raw.showSocials
          ? {
              instagram: (raw.instagram ?? '').trim() || null,
              tiktok: (raw.tiktok ?? '').trim() || null,
              youtube: (raw.youtube ?? '').trim() || null,
              discord: (raw.discord ?? '').trim() || null,
              telegram: (raw.telegram ?? '').trim() || null,
            }
          : null,
      });

      this.editForm.markAsPristine();
      this.snack.open('Profil gespeichert.', 'OK', { duration: 2000 });
    } catch (e: any) {
      this.snack.open(e?.message ?? 'Speichern fehlgeschlagen.', 'OK', { duration: 4000 });
    } finally {
      this.savingProfile.set(false);
    }
  }

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

  private async audit(params: {
    action: string;
    targetUid: string;
    actorUid: string;
    reason: string;
    meta?: any;
  }) {
    await addDoc(collection(this.firestore as any, 'audit_logs'), {
      timestamp: serverTimestamp(),
      action: params.action,
      targetUid: params.targetUid,
      actorUid: params.actorUid,
      reason: params.reason ?? '',
      meta: params.meta ?? {},
    });
  }

  // =========================
  // Rollen (Admin ⇄ User)
  // =========================
  async onGrantAdmin(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    const actorUid = await this.actorUid();
    if (actorUid !== this.OWNER_UID) {
      this.fail('Nur der Owner darf Admins vergeben.');
      return;
    }

    const res = await firstValueFrom(
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'Zum Admin machen',
            hint: 'Optional: Notiz / Grund.',
            required: false,
            confirmText: 'Admin geben',
          },
        })
        .afterClosed()
    );
    if (!res) return;

    try {
      await setDoc(
        doc(this.firestore, 'admins', targetUid),
        {
          createdAt: serverTimestamp(),
          createdBy: actorUid,
          note: (res.reason ?? '').trim(),
        },
        { merge: true }
      );

      // optional fürs UI: roles[] pflegen
      await setDoc(
        doc(this.firestore, 'users', targetUid),
        { roles: arrayUnion('admin'), updatedAt: serverTimestamp() },
        { merge: true }
      );

      await this.audit({
        action: 'GRANT_ADMIN',
        targetUid,
        actorUid,
        reason: (res.reason ?? '').trim(),
        meta: {},
      });

      this.ok('Admin-Rechte vergeben');
    } catch {
      this.fail('Konnte Admin nicht vergeben (Rules/Permissions?)');
    }
  }

  async onRevokeAdmin(targetUid: string) {
    if (!targetUid || targetUid === this.OWNER_UID) return;

    const actorUid = await this.actorUid();
    if (actorUid !== this.OWNER_UID) {
      this.fail('Nur der Owner darf Admins entfernen.');
      return;
    }

    const res = await firstValueFrom(
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'Admin entfernen',
            hint: 'Optional: Grund.',
            required: false,
            confirmText: 'Admin entfernen',
          },
        })
        .afterClosed()
    );
    if (!res) return;

    try {
      await deleteDoc(doc(this.firestore, 'admins', targetUid));

      await setDoc(
        doc(this.firestore, 'users', targetUid),
        { roles: arrayRemove('admin'), updatedAt: serverTimestamp() },
        { merge: true }
      );

      await this.audit({
        action: 'REVOKE_ADMIN',
        targetUid,
        actorUid,
        reason: (res.reason ?? '').trim(),
        meta: {},
      });

      this.ok('Admin-Rechte entfernt');
    } catch {
      this.fail('Konnte Admin nicht entfernen (Rules/Permissions?)');
    }
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
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'User soft löschen',
            hint: 'User hat danach 0 Zugriff (wie gebannt).',
            required: true,
            confirmText: 'Soft Delete',
          },
        })
        .afterClosed()
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
      this.dialog
        .open(ReasonDialogComponent, {
          data: {
            title: 'User wiederherstellen',
            hint: 'DeletedAt wird entfernt.',
            required: false,
            confirmText: 'Restore',
          },
        })
        .afterClosed()
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
