import { Injectable, inject } from '@angular/core';
import { Firestore, collection } from '@angular/fire/firestore';
import { getCountFromServer, query } from 'firebase/firestore';
import { timer, from, Observable } from 'rxjs';
import { switchMap, map, shareReplay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private firestore = inject(Firestore);

  /** User-Anzahl – initial + alle 120 Sekunden */
  usersCount$: Observable<number> = timer(0, 120_000).pipe(
    switchMap(() =>
      from(
        getCountFromServer(
          query(collection(this.firestore, 'users'))
        )
      )
    ),
    map(snap => snap.data().count),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
