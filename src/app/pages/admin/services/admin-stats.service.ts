import { Injectable, inject } from '@angular/core';
import { Firestore, collection } from '@angular/fire/firestore';
import { getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { timer, from, Observable, of } from 'rxjs';
import { switchMap, map, shareReplay, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private firestore = inject(Firestore);

  private count$(buildQuery: () => any, intervalMs = 120_000): Observable<number> {
    return timer(0, intervalMs).pipe(
      switchMap(() =>
        from(getCountFromServer(buildQuery())).pipe(
          map((snap) => snap.data().count),
          catchError(() => of(0))
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /** User-Anzahl – initial + alle 120 Sekunden */
  usersCount$ = this.count$(() => query(collection(this.firestore, 'users')));

  /** Admins (Collection: admins/{uid}) */
  adminsCount$ = this.count$(() => query(collection(this.firestore, 'admins')));

  /** Bans / Locks (Collection: banlist/{uid}) */
  bansCount$ = this.count$(() =>
    query(collection(this.firestore, 'banlist'), where('type', '==', 'ban'))
  );

  locksCount$ = this.count$(() =>
    query(collection(this.firestore, 'banlist'), where('type', '==', 'lock'))
  );

  /**
   * Online „jetzt“ (Presence Heartbeat):
   * state == 'online' und lastActiveAt innerhalb Threshold.
   * Hinweis: kann ein Composite Index brauchen (state + lastActiveAt).
   */
  onlineNowCount$ = this.count$(() => {
    const since = Timestamp.fromMillis(Date.now() - 45_000);
return query(
  collection(this.firestore, 'presence'),
  where('lastActiveAt', '>=', since)
);
  }, 30_000);

  /** Aktiv in den letzten 24h/7d (Presence lastActiveAt) */
  active24hCount$ = this.count$(() => {
    const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    return query(collection(this.firestore, 'presence'), where('lastActiveAt', '>=', since));
  }, 120_000);

  active7dCount$ = this.count$(() => {
    const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return query(collection(this.firestore, 'presence'), where('lastActiveAt', '>=', since));
  }, 120_000);

  /** Konsum-Logs in den letzten 7/30 Tagen (Count Query) */
  consumptions7dCount$ = this.count$(() => {
    const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return query(collection(this.firestore, 'consumptions'), where('timestamp', '>=', since));
  }, 120_000);

  consumptions30dCount$ = this.count$(() => {
    const since = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return query(collection(this.firestore, 'consumptions'), where('timestamp', '>=', since));
  }, 120_000);
}
