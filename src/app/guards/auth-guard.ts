import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Firestore, doc } from '@angular/fire/firestore';
import { getDoc } from 'firebase/firestore';
import { from, of } from 'rxjs';
import { first, switchMap, map, catchError } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const firestore = inject(Firestore);

  // Seite für gesperrte User nicht blocken (keine Schleife)
  if (state.url.startsWith('/account-blocked')) {
    return of(true);
  }

  return authService.authState$.pipe(
    first(),
    switchMap(user => {
      if (!user) {
        return of(
          router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url },
          })
        );
      }

      //Access-Check: gebannte/gesperrte User dürfen profiles_public NICHT lesen (deine Rules)
      return from(getDoc(doc(firestore as any, 'profiles_public', user.uid))).pipe(
        map(() => true),

        catchError(async (err: any) => {
          if (err?.code === 'permission-denied') {
            // => gebannt / gesperrt / gelöscht
            await authService.logout();
            return router.createUrlTree(['/account-blocked']);
          }

          // unknown error -> sicherheitshalber raus
          await authService.logout();
          return router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url },
          });
        })
      );
    })
  );
};
