// src/testing/firebase-test-providers.ts
import { Provider, EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';

// ✅ Full Firestore
import {
  provideFirestore as provideFirestoreFull,
  getFirestore as getFirestoreFull,
  Firestore as AFirestore,
} from '@angular/fire/firestore';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { disableNetwork } from 'firebase/firestore';

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

  // ✅ beide Tokens verfügbar -> sehr robust gegen "Firestore2"
  provideFirestoreFull(() => getFirestoreFull()),
];

/** Optional: blockt echte Netzwerkzugriffe in Unit-Tests */
export async function disableFirestoreNetworkForTests(): Promise<void> {
  try {
    await disableNetwork(TestBed.inject(AFirestore) as any);
  } catch {}
}
