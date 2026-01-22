import { Provider, EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FirebaseApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, Firestore } from '@angular/fire/firestore';

import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  Firestore as FirebaseFirestore,
  getFirestore as getFirebaseFirestore,
  disableNetwork,
} from 'firebase/firestore';

export const FIREBASE_TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideFirebaseApp(() => {
    // ✅ verhindert "Firebase App already exists"
    return getApps().length
      ? getApp()
      : initializeApp({
          projectId: 'demo-unit-test',
          apiKey: 'fake',
          appId: '1:123:web:abc',
        });
  }),

  provideAuth(() => getAuth()),
  provideFirestore(() => getFirestore()),

  // ✅ WICHTIG: Provider für Firestore aus "firebase/firestore"
  // Damit verschwindet "Firestore2" bei Services, die den SDK-Firestore injizieren.
  {
    provide: FirebaseFirestore,
    useFactory: (app: FirebaseApp) => getFirebaseFirestore(app as any),
    deps: [FirebaseApp],
  },
];

/** Optional: blockt echte Netzwerkzugriffe in Unit-Tests */
export async function disableFirestoreNetworkForTests(): Promise<void> {
  try {
    await disableNetwork(TestBed.inject(Firestore) as any);
  } catch {}
  try {
    await disableNetwork(TestBed.inject(FirebaseFirestore) as any);
  } catch {}
}
