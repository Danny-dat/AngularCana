/// <reference types="jasmine" />

import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

import { FirebaseApp } from '@angular/fire/app';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';
import { disableNetwork, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
declare const jasmine: any;

// ✅ löscht gespeicherte Jasmine-UI-Optionen (damit Checkbox nicht direkt wieder an ist)
try {
  Object.keys(localStorage)
    .filter((k) => k.toLowerCase().includes('jasmine'))
    .forEach((k) => localStorage.removeItem(k));
} catch {}

// ✅ erzwingt random=false mehrfach (falls Reporter später nochmal überschreibt)
const forceNoRandom = () => {
  try {
    jasmine.getEnv().configure({ random: false });
  } catch {}
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
const auth = getAuth(app);
const fs = getFirestore(app);
// keine echten Netzwerk-Calls in Unit-Tests
disableNetwork(fs).catch(() => void 0);

const __g: any = globalThis as any;
if (!__g.__cannatrackTestEnvInited) {
  __g.__cannatrackTestEnvInited = true;
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true },
  });
}

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
    imports: [HttpClientTestingModule, RouterTestingModule, NoopAnimationsModule],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { params: {}, data: {}, paramMap: convertToParamMap({}) },
          params: of({}),
          data: of({}),
          paramMap: of(convertToParamMap({})),
        },
      },

      // Material stubs (SnackBar/Dialog/BottomSheet)
      { provide: MatSnackBar, useValue: { open: () => void 0 } },
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

      // Direkt als DI-Token bereitstellen (robuster als EnvironmentProviders in TestBed)
      { provide: FirebaseApp, useValue: app as any },
      { provide: Auth, useValue: auth },
      { provide: Firestore, useValue: fs },
    ],
  });
});

// verhindert echte Reloads/Redirects in Karma (einige Flows nutzen window.location.*)
beforeAll(() => {
  try {
    // Karma darf nicht neu laden/redirecten – das wuerde den Test-Runner abbrechen.
    spyOn(window.location, 'reload').and.callFake(() => void 0);
    spyOn(window.location, 'assign').and.callFake(() => void 0);
    spyOn(window.location, 'replace').and.callFake(() => void 0);
  } catch {
    // manche Browser blocken location mocking – dann muessen einzelne Specs gezielt stubben
  }
});
