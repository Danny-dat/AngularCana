import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { from, of } from 'rxjs';
import { first, switchMap, map } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // keine Redirect-Schleife
  if (state.url.startsWith('/account-blocked')) return of(true);

  return authService.authState$.pipe(
    first(),
    switchMap((u) => {
      if (!u) {
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
      }

      // Check über Service (cached!)
      return from(authService.checkNotBlocked(u.uid, { silent: true })).pipe(
        map((ok) => (ok ? true : router.createUrlTree(['/account-blocked']))),
      );
    }),
  );
};
