import { Provider, EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FirebaseApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';

// AngularFire Firestore (full)
import {
  provideFirestore,
  getFirestore as getAFirestore,
  Firestore as AFirestore,
} from '@angular/fire/firestore';

// AngularFire Firestore (lite) – nur DI-Token
import { Firestore as AFirestoreLite } from '@angular/fire/firestore/lite';

import { initializeApp, getApp, getApps } from 'firebase/app';

// Web SDK Firestore (full)
import {
  Firestore as FirebaseFirestore,
  getFirestore as getFirebaseFirestore,
  disableNetwork,
} from 'firebase/firestore';

// Web SDK Firestore (lite)  ✅ DAS fehlt dir für "Firestore2"
import {
  Firestore as FirebaseFirestoreLite,
  getFirestore as getFirebaseFirestoreLite,
} from 'firebase/firestore/lite';

export const FIREBASE_TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideFirebaseApp(() => {
    return getApps().length
      ? getApp()
      : initializeApp({
          projectId: 'demo-unit-test',
          apiKey: 'fake',
          appId: '1:123:web:abc',
        });
  }),

  provideAuth(() => getAuth()),

  // ✅ AngularFire Firestore (full)
  provideFirestore(() => getAFirestore()),

  // ✅ AngularFire Lite-Token -> nutzt denselben Full-Instance
  { provide: AFirestoreLite, useExisting: AFirestore },

  // ✅ Web SDK Firestore (full) – falls irgendwo direkt injiziert/benutzt
  {
    provide: FirebaseFirestore,
    useFactory: (app: FirebaseApp) => getFirebaseFirestore(app as any),
    deps: [FirebaseApp],
  },

  // ✅ Web SDK Firestore (lite) – das ist sehr oft "Firestore2"
  {
    provide: FirebaseFirestoreLite,
    useFactory: (app: FirebaseApp) => getFirebaseFirestoreLite(app as any),
    deps: [FirebaseApp],
  },
];

export async function disableFirestoreNetworkForTests(): Promise<void> {
  // nur full hat disableNetwork – lite ignorieren
  try { await disableNetwork(TestBed.inject(AFirestore) as any); } catch {}
  try { await disableNetwork(TestBed.inject(FirebaseFirestore) as any); } catch {}
}
