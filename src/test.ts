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
function patchJasmineEnv(win: any) {
  try {
    const env = win?.jasmine?.getEnv?.();
    if (!env) return;

    // configure() dauerhaft so patchen, dass random niemals true wird
    if (!env.__randomPatched) {
      const orig = env.configure.bind(env);
      env.configure = (cfg: any) => orig({ ...(cfg ?? {}), random: false });
      env.__randomPatched = true;
    }

    env.configure({ random: false });
  } catch {
    // ignore
  }
}

function clearJasmineUiState(win: any) {
  try {
    Object.keys(win.localStorage)
      .filter(k => k.toLowerCase().includes('jasmine'))
      .forEach(k => win.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function forceRandomCheckboxOffInTopUI() {
  const topWin: any = (window.top && window.top !== window) ? window.top : window;

  const apply = () => {
    // 1) UI-Checkbox im Top-DOM finden und ausschalten
    try {
      const doc: Document = topWin.document;

      const cb =
        doc.querySelector<HTMLInputElement>('input#random') ??
        doc.querySelector<HTMLInputElement>('input[name="random"]');

      if (cb) {
        cb.checked = false;
        cb.defaultChecked = false;
        cb.disabled = true; // sperren
      }
    } catch {
      // ignore
    }

    // 2) Falls ?random=true im URL Query steht -> neutralisieren
    try {
      const url = new URL(topWin.location.href);
      if (url.searchParams.get('random') === 'true') {
        url.searchParams.set('random', 'false');
        topWin.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore
    }

    // 3) Jasmine-Engine in topWin (falls vorhanden) patchen
    patchJasmineEnv(topWin);

    // 4) Zusätzlich: alle iframes im Top-Doc durchsuchen und patchen (falls jasmine dort sitzt)
    try {
      const frames = Array.from(topWin.document.querySelectorAll('iframe'));
      for (const f of frames) {
        const cw = (f as HTMLIFrameElement).contentWindow;
        if (cw) patchJasmineEnv(cw);
      }
    } catch {
      // ignore
    }
  };

  // gespeicherte Reporter-Optionen löschen (Top + Frame)
  clearJasmineUiState(topWin);
  clearJasmineUiState(window);

  // sofort + mehrfach (weil UI/Reporter oft später gerendert wird)
  apply();
  topWin.setTimeout(apply, 0);
  topWin.setTimeout(apply, 200);
  topWin.setTimeout(apply, 1000);

  // wenn UI/Reporter neu rendert: wieder anwenden
  try {
    new topWin.MutationObserver(apply).observe(topWin.document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch {
    // ignore
  }
}

// 1) Engine im aktuellen Test-Frame patchen (hier läuft test.ts)
patchJasmineEnv(window);

// 2) UI + Top-Window patchen (Checkbox & ggf. top jasmine)
forceRandomCheckboxOffInTopUI();

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
    ...movedServices,      // <- Services aus imports nach providers
    ...GLOBAL_PROVIDERS,   // <- globale Provider für alles
  ];

  return originalConfigure(moduleDef);
};

// ---- Specs laden (stabil, alphabetisch) ----
const context = require.context('./', true, /\.spec\.ts$/);
context.keys().sort().forEach(context);
