import { EnvironmentProviders, Provider } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';
import { disableNetwork } from 'firebase/firestore';
import { of } from 'rxjs';

const firebaseTestConfig = {
  apiKey: 'test',
  authDomain: 'test.firebaseapp.com',
  projectId: 'demo-test',
  appId: '1:1:web:1',
  messagingSenderId: '1',
};

function getOrCreateFirebaseApp() {
  const apps = getApps();
  return apps.length ? getApp() : initializeFirebaseApp(firebaseTestConfig);
}

export const TEST_PROVIDERS: Array<Provider | EnvironmentProviders> = [
  // Router + default ActivatedRoute Stub (bei Bedarf in Specs überschreiben)
  provideRouter([]),
  {
    provide: ActivatedRoute,
    useValue: {
      snapshot: {
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({}),
        params: {},
        queryParams: {},
        data: {},
      },
      paramMap: of(convertToParamMap({})),
      queryParamMap: of(convertToParamMap({})),
      params: of({}),
      queryParams: of({}),
      data: of({}),
    },
  },

  // Animations (stabiler für Tests)
  provideNoopAnimations(),

  // HttpClient (für Services wie GeocodingService etc.)
  provideHttpClient(withInterceptorsFromDi()),
  provideHttpClientTesting(),

  // AngularFire (Auth/Firestore Tokens, damit DI nicht crasht)
  provideFirebaseApp(() => getOrCreateFirebaseApp()),
  provideAuth(() => getAuth()),
  provideFirestore(() => {
    const fs = getFirestore();
    // verhindert echte Netzwerkzugriffe im Testlauf
    disableNetwork(fs).catch(() => void 0);
    return fs;
  }),
];

// IMPORTANT: required by @angular/build:unit-test
// The providers file MUST export the providers array as a *default export*.
export default TEST_PROVIDERS;
