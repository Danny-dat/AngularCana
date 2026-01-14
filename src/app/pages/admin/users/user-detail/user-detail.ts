import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

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
  ],
  templateUrl: './user-detail.html',
  styleUrls: ['./user-detail.css'],
})
export class AdminUserDetailComponent {
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);

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

  vm$ = combineLatest([
    this.uid$,
    this.userDoc$,
    this.profile$,
    this.ban$,
    this.isAdmin$
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
        ban,
      };
    })
  );
}
