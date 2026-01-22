// src/test.ts
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, disableNetwork } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';

declare const require: any;

/**
 * ✅ Force deterministic order in Karma/Jasmine Browser UI
 * Angular 20 + @angular/build:unit-test (runner=karma) can ignore karma.conf.js settings.
 * This patch forces random=false right before Karma starts executing specs.
 */
(function forceNoRandomJasmine() {
  const w = window as any;

  // 1) Remove persisted Jasmine UI settings (random checkbox can be "sticky")
  try {
    Object.keys(localStorage)
      .filter((k) => k.toLowerCase().includes('jasmine'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }

  const apply = () => {
    const j = w.jasmine;
    const env = j?.getEnv?.();
    if (env?.configure) {
      env.configure({ random: false });
    }
  };

  // 2) Try once immediately (may be overwritten later by adapter)
  try {
    apply();
  } catch {
    /* ignore */
  }

  // 3) Patch Karma start: apply right before execution (wins)
  try {
    const karma = w.__karma__;
    if (karma) {
      // also try to influence the adapter config if present
      try {
        if (karma.config?.client?.jasmine) {
          karma.config.client.jasmine.random = false;
        }
      } catch {
        /* ignore */
      }

      const origStart = karma.start;
      if (typeof origStart === 'function') {
        karma.start = (...args: any[]) => {
          try {
            apply();
          } catch {
            /* ignore */
          }
          return origStart.apply(karma, args);
        };
      }
    }
  } catch {
    /* ignore */
  }
})();

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  { teardown: { destroyAfterEach: true } }
);

// ---- GLOBAL TEST PROVIDERS (für ALLE Specs) ----
const firebaseConfig = {
  apiKey: 'test',
  authDomain: 'test.local',
  projectId: 'demo-test',
  appId: '1:1:web:test',
};

function getOrInitApp() {
  return getApps().length ? getApp() : initializeFirebaseApp(firebaseConfig);
}

const GLOBAL_PROVIDERS: any[] = [
  provideHttpClientTesting(),
  provideRouter([]),

  // ActivatedRoute Default-Stub (kann jede Spec bei Bedarf overriden)
  {
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
      paramMap: of(convertToParamMap({})),
      queryParamMap: of(convertToParamMap({})),
      data: of({}),
    },
  },

  provideFirebaseApp(() => getOrInitApp()),
  provideAuth(() => getAuth()),
  provideFirestore(() => {
    const fs = getFirestore();
    // optional: Firestore-Netzwerk aus (verhindert unnötige Verbindungsversuche in Unit-Tests)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    disableNetwork(fs).catch(() => {});
    return fs;
  }),
];

// ---- Patch: configureTestingModule immer mit GLOBAL_PROVIDERS + "Service-in-imports" Fix ----
const originalConfigure = TestBed.configureTestingModule.bind(TestBed);

function isProbablyService(x: any): boolean {
  // Services haben typischerweise ɵprov, aber kein ɵcmp/ɵdir/ɵpipe/ɵmod
  return !!x?.ɵprov && !x?.ɵcmp && !x?.ɵdir && !x?.ɵpipe && !x?.ɵmod;
}

(TestBed as any).configureTestingModule = (moduleDef: any = {}) => {
  const imports = moduleDef.imports ?? [];
  const movedServices = imports.filter(isProbablyService);

  moduleDef.imports = imports.filter((i: any) => !isProbablyService(i));
  moduleDef.providers = [
    ...(moduleDef.providers ?? []),
    ...movedServices,    // <- Services aus imports nach providers
    ...GLOBAL_PROVIDERS, // <- globale Provider für alles
  ];

  return originalConfigure(moduleDef);
};

// ---- Specs laden (Standard Angular CLI) ----
const context = require.context('./', true, /\.spec\.ts$/);
context.keys().forEach(context);
