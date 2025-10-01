import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { map } from 'rxjs/operators';

// hier deine Admin-UIDs eintragen:
const ADMIN_UIDS = new Set<string>([
  'ZAz0Bnde5zYIS8qCDT86aOvEDX52',
  // '87654321-uuid-admin'
]);

function checkAdmin() {
  const auth = inject(Auth);
  const router = inject(Router);

  return user(auth).pipe(
    map(u => {
      if (!u) {
        return router.createUrlTree(['/login']);
      }
      return ADMIN_UIDS.has(u.uid) ? true : router.createUrlTree(['/dashboard']);
    })
  );
}

export const adminGuard: CanActivateFn = () => checkAdmin();
export const adminMatchGuard: CanMatchFn = () => checkAdmin();
