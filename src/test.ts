// src/test.ts
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, disableNetwork } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';

declare const require: any;
declare const jasmine: any;

// =====================================================
// ✅ Deterministische Tests: Random zuverlässig AUS (Engine + UI)
// =====================================================
function forceJasmineDeterministic() {
  // 1) Reporter-UI-State löschen (Random Checkbox etc.)
  try {
    Object.keys(localStorage)
      .filter(k => k.toLowerCase().includes('jasmine'))
      .forEach(k => localStorage.removeItem(k));
  } catch {}

  // 2) Jasmine Engine: random AUS
  try {
    jasmine?.getEnv?.().configure({ random: false });
  } catch {}

  // 3) UI-Checkbox "run tests in random order" zwangsweise AUS + sperren
  const apply = () => {
    // Manche Jasmine-Versionen nutzen id="random"
    const cb =
      document.querySelector<HTMLInputElement>('input#random') ??
      document.querySelector<HTMLInputElement>('input[name="random"]');

    if (cb) {
      cb.checked = false;
      cb.defaultChecked = false;
      cb.disabled = true; // verhindert versehentliches Wieder-aktivieren
    }

    // Falls per URL ?random=true gesetzt wurde, rauspatchen
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('random') === 'true') {
        url.searchParams.set('random', 'false');
        history.replaceState({}, '', url.toString());
      }
    } catch {}
  };

  // sofort + mehrfach (UI wird oft später gerendert)
  apply();
  setTimeout(apply, 0);
  setTimeout(apply, 200);
  setTimeout(apply, 1000);

  // falls der Reporter/Options-Block dynamisch neu rendert
  try {
    new MutationObserver(apply).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch {}
}

forceJasmineDeterministic();

// =====================================================

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
      snapshot: {
        paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({}),
      },
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
    ...movedServices,      // <- Services aus imports nach providers
    ...GLOBAL_PROVIDERS,   // <- globale Provider für alles
  ];

  return originalConfigure(moduleDef);
};

// ---- Specs laden (stabil, alphabetisch) ----
const context = require.context('./', true, /\.spec\.ts$/);
context.keys().sort().forEach(context);
