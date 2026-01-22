// src/app/app.config.ts
import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideFirestore, getFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { AdService } from './services/ad.service';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { isPlatformBrowser } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNativeDateAdapter(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: 'app-dialog',
        autoFocus: false,
        restoreFocus: true,
      },
    },
    provideRouter(routes),
    importProvidersFrom(FormsModule),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),

    provideFirebaseApp(() => initializeApp(environment.firebase)),

    provideAuth(() => {
      const auth = getAuth();
      if (!environment.production && environment.useEmulators) {
        // Auth-Emulator (Standard-Port 9099)
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),

    provideFirestore(() => {
      const fs = getFirestore();
      if (!environment.production && environment.useEmulators) {
        // Firestore-Emulator (Standard-Port 8080)
        connectFirestoreEmulator(fs, 'localhost', 8080);
      }
      return fs;
    }),

    provideAppInitializer(() => {
      const ads = inject(AdService);
      const platformId = inject(PLATFORM_ID);

      if (isPlatformBrowser(platformId)) {
        ads.init(); // Defaults setzen + Overrides prüfen
      }
      // nichts zurückgeben nötig; Promise wäre auch erlaubt
    }),
  ],
};
