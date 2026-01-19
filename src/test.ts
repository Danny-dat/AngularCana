/// <reference types="jasmine" />

import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Router providers are configured via provideRouter below.
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';
import { disableNetwork } from 'firebase/firestore';
declare const jasmine: any;

// ✅ löscht gespeicherte Jasmine-UI-Optionen (damit Checkbox nicht direkt wieder an ist)
try {
  Object.keys(localStorage)
    .filter(k => k.toLowerCase().includes('jasmine'))
    .forEach(k => localStorage.removeItem(k));
} catch {}

// ✅ erzwingt random=false mehrfach (falls Reporter später nochmal überschreibt)
const forceNoRandom = () => {
  try { jasmine.getEnv().configure({ random: false }); } catch {}
};

forceNoRandom();
setTimeout(forceNoRandom, 0);
setTimeout(forceNoRandom, 50);
setTimeout(forceNoRandom, 200);

const firebaseTestConfig = {
  apiKey: 'demo',
  authDomain: 'demo.firebaseapp.com',
  projectId: 'demo',
  appId: 'demo',
};

const app = getApps().length ? getApp() : initializeFirebaseApp(firebaseTestConfig);

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    teardown: { destroyAfterEach: true },
  }
);

// ✅ nach Angular Test-Env init nochmal erzwingen
forceNoRandom();
setTimeout(forceNoRandom, 0);

// IMPORTANT:
// Angular resets the TestBed between tests (and many specs also call TestBed.configureTestingModule themselves).
// A one-time TestBed.configureTestingModule() here is NOT enough.
// We must re-register the common providers for every test.
beforeEach(() => {
  // erlaubt mehrfaches spyOn() (nützlich bei vielen Specs)
  try {
    jasmine.getEnv().allowRespy(true);
  } catch {}

  TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
    providers: [
      // Router ist in vielen Komponenten/Services benötigt
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: {}, data: {}, paramMap: convertToParamMap({}) },
          params: of({}),
          data: of({}),
          paramMap: of(convertToParamMap({})),
        },
      },

      provideFirebaseApp(() => app),
      provideAuth(() => getAuth(app)),
      provideFirestore(() => {
        const fs = getFirestore(app);
        // keine echten Netzwerk-Calls in Unit-Tests
        disableNetwork(fs).catch(() => void 0);
        return fs;
      }),
    ],
  });
});
