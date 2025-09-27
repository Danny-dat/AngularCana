import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { first, map, tap } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wir nehmen den ersten Wert vom authState$ (ist der User null oder ein Objekt?)
  return authService.authState$.pipe(
    first(), // Wichtig: Wir wollen nur den aktuellen Status, keinen Live-Stream
    map(user => !!user), // Konvertiert das User-Objekt zu true, und null zu false
    tap(isLoggedIn => {
      // Wenn nicht eingeloggt, leite zum Login um
      if (!isLoggedIn) {
        router.navigate(['/login']);
      }
    })
  );
};