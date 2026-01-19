/* istanbul ignore file */
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

// Optional: Owner-Notbremse (falls Firestore mal klemmt)
const OWNER_UID = 'ZAz0Bnde5zYIS8qCDT86aOvEDX52';

function checkAdmin() {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return user(auth).pipe(
    switchMap(u => {
      if (!u) return from([router.createUrlTree(['/login'])]);

      // Owner darf immer rein (optional)
      if (u.uid === OWNER_UID) return from([true]);

      // Admin = admins/{uid} existiert
      const ref = doc(firestore, 'admins', u.uid);
      return from(getDoc(ref)).pipe(
        map(snap => (snap.exists() ? true : router.createUrlTree(['/dashboard'])))
      );
    })
  );
}

export const adminGuard: CanActivateFn = () => checkAdmin();
export const adminMatchGuard: CanMatchFn = () => checkAdmin();
