import { Injectable, inject, DestroyRef } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { PresenceService } from './presence.service'; // der, den wir gebaut haben
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private auth = inject(Auth);
  private presence = inject(PresenceService);
  private destroyRef = inject(DestroyRef);
  
  constructor() {        
    // Reagiere EINMAL global auf Login/Logout
    user(this.auth)
      .pipe(
        map(u => u?.uid ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(uid => {
        if (uid) {
          this.presence.start(uid);
        } else {
          this.presence.stop();
        }
      });
  }
}
