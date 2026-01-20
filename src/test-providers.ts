import { Provider, EnvironmentProviders } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { initializeApp } from 'firebase/app';
import { provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { of } from 'rxjs';

// ⚠️ Dummy-Firebase-Config: keine echten Keys/Netzwerkzugriffe
const firebaseTestConfig = {
  apiKey: 'demo',
  authDomain: 'demo.firebaseapp.com',
  projectId: 'demo',
  appId: 'demo',
};

// Globale Provider für ALLE Specs (reduziert Boilerplate in .spec.ts)
const testProviders: Array<Provider | EnvironmentProviders> = [
  provideNoopAnimations(),
  provideRouter([]),

  // HTTP
  provideHttpClient(withInterceptorsFromDi()),
  provideHttpClientTesting(),

  // Firebase (AngularFire)
  provideFirebaseApp(() => initializeApp(firebaseTestConfig)),
  provideAuth(() => getAuth()),
  provideFirestore(() => getFirestore()),

  // Material: minimal stubs, damit Services in Unit-Tests nicht crashen
  {
    provide: MatSnackBar,
    useValue: { open: () => void 0 },
  },
  {
    provide: MatDialog,
    useValue: {
      open: () => ({ afterClosed: () => of(true) }),
      closeAll: () => void 0,
    },
  },
  {
    provide: MatBottomSheet,
    useValue: {
      open: () => ({ afterDismissed: () => of(true) }),
      dismiss: () => void 0,
    },
  },
];

export default testProviders;
