import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, combineLatest } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export type UserStatus = 'active' | 'locked' | 'banned' | 'deleted';

export interface UserDoc {
  profile?: { displayName?: string; phoneNumber?: string };
  settings?: any;
  roles?: string[];
  status?: { deletedAt?: any | null; deletedBy?: string | null; deleteReason?: string | null };
  createdAt?: any;
  updatedAt?: any;
}

export interface PublicProfileDoc {
  displayName?: string;
  username?: string;
  photoURL?: string;
  lastActiveAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface BanDoc {
  type: 'ban' | 'lock';
  until?: any | null; // Timestamp | null
  reason?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface AdminDoc {
  createdAt?: any;
  createdBy?: string;
}

export interface AdminUserRow {
  uid: string;
  displayName: string;
  username?: string;
  role: 'admin' | 'user';
  status: UserStatus;
  statusLabel: string;
  // für später Detailseite:
  deletedAt?: any | null;
  lockUntil?: any | null;
  banUntil?: any | null;
}

@Injectable({ providedIn: 'root' })
export class AdminDirectoryService {
  private firestore = inject(Firestore);

  /** Alle User (users) */
  private users$ = collectionData(collection(this.firestore, 'users'), {
    idField: 'uid',
  }) as Observable<(UserDoc & { uid: string })[]>;

  /** Public Profiles */
  private profiles$ = collectionData(collection(this.firestore, 'profiles_public'), {
    idField: 'uid',
  }) as Observable<(PublicProfileDoc & { uid: string })[]>;

  /** Admin-Liste */
  private admins$ = collectionData(collection(this.firestore, 'admins'), {
    idField: 'uid',
  }) as Observable<(AdminDoc & { uid: string })[]>;

  /** Ban/Lock */
  private banlist$ = collectionData(collection(this.firestore, 'banlist'), {
    idField: 'uid',
  }) as Observable<(BanDoc & { uid: string })[]>;

  /** Gemergte View-Model Liste */
  readonly directory$: Observable<AdminUserRow[]> = combineLatest([
    this.users$,
    this.profiles$,
    this.admins$,
    this.banlist$,
  ]).pipe(
    map(([users, profiles, admins, bans]) => {
      const profileByUid = new Map(profiles.map((p) => [p.uid, p]));
      const adminSet = new Set(admins.map((a) => a.uid));
      const banByUid = new Map(bans.map((b) => [b.uid, b]));

      return users.map((u) => {
        const p = profileByUid.get(u.uid);
        const b = banByUid.get(u.uid);

        const deletedAt = u.status?.deletedAt ?? null;

        const { status, statusLabel, lockUntil, banUntil } = this.computeStatus(b, deletedAt);

        const displayName =
          p?.displayName?.trim() || u.profile?.displayName?.trim() || p?.username?.trim() || u.uid;

        return {
          uid: u.uid,
          displayName,
          username: p?.username,
          role: (adminSet.has(u.uid) ? 'admin' : 'user') as 'admin' | 'user',
          status,
          statusLabel,
          deletedAt,
          lockUntil,
          banUntil,
        };
      });
    }),
    // optional sort: Admins first, dann Name
    map((rows) =>
      rows.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      })
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private computeStatus(ban: (BanDoc & { uid: string }) | undefined, deletedAt: any | null) {
    if (deletedAt) {
      return {
        status: 'deleted' as const,
        statusLabel: 'Gelöscht',
        lockUntil: null,
        banUntil: null,
      };
    }

    if (!ban) {
      return {
        status: 'active' as const,
        statusLabel: 'Aktiv',
        lockUntil: null,
        banUntil: null,
      };
    }

    // ban/lock Dokument existiert
    if (ban.type === 'ban') {
      // permanent: until null/undefined
      return {
        status: 'banned' as const,
        statusLabel: 'Gebannt',
        lockUntil: null,
        banUntil: ban.until ?? null,
      };
    }

    // lock
    return {
      status: 'locked' as const,
      statusLabel: 'Gesperrt',
      lockUntil: ban.until ?? null,
      banUntil: null,
    };
  }
}
