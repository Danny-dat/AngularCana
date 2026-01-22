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
// ✅ FIX: Random AUS erzwingen (wichtig: Top-Window __karma__ patchen!)
// =====================================================
(function forceNoRandomJasmine() {
  const topWin: any = (window.top && window.top !== window) ? window.top : window;

  // gespeicherte Jasmine UI-Optionen löschen (Checkbox “klebt” sonst)
  try {
    Object.keys(topWin.localStorage)
      .filter(k => k.toLowerCase().includes('jasmine'))
      .forEach(k => topWin.localStorage.removeItem(k));
  } catch {}

  const patchJasmineEnv = (win: any) => {
    try {
      const env = win?.jasmine?.getEnv?.();
      if (!env) return;

      if (!env.__noRandomPatched) {
        // configure nie random:true erlauben
        const origConfigure = env.configure?.bind(env);
        if (typeof origConfigure === 'function') {
          env.configure = (cfg: any) => origConfigure({ ...(cfg ?? {}), random: false });
        }

        // execute: direkt vor Start nochmal random:false setzen
        const origExecute = env.execute?.bind(env);
        if (typeof origExecute === 'function') {
          env.execute = (...args: any[]) => {
            try { env.configure({ random: false }); } catch {}
            return origExecute(...args);
          };
        }

        env.__noRandomPatched = true;
      }

      // sofort setzen
      env.configure({ random: false });
    } catch {}
  };

  const patchKarmaTopConfig = () => {
    try {
      const k = topWin.__karma__;
      if (!k) return;

      k.config = k.config || {};
      k.config.client = k.config.client || {};
      k.config.client.jasmine = k.config.client.jasmine || {};
      k.config.client.jasmine.random = false;

      // sehr wichtig: direkt vor Start nochmal erzwingen
      if (!k.__noRandomPatched && typeof k.start === 'function') {
        const origStart = k.start.bind(k);
        k.start = (...args: any[]) => {
          try {
            k.config.client.jasmine.random = false;
          } catch {}
          try {
            // env im Test-Frame + alle Frames patchen
            patchJasmineEnv(window);
            for (const fw of Array.from(topWin.frames as any)) patchJasmineEnv(fw);
          } catch {}
          return origStart(...args);
        };
        k.__noRandomPatched = true;
      }
    } catch {}
  };

  const patchTopUiCheckbox = () => {
    try {
      const doc: Document = topWin.document;
      const cb =
        doc.querySelector<HTMLInputElement>('input#random') ??
        doc.querySelector<HTMLInputElement>('input[name="random"]');

      if (cb) {
        cb.checked = false;
        cb.defaultChecked = false;
        cb.disabled = true;
      }
    } catch {}
  };

  // mehrfach versuchen, weil Runner/iframes/karma-config zeitversetzt kommen
  const deadline = Date.now() + 15000;
  const tick = () => {
    patchKarmaTopConfig();
    patchTopUiCheckbox();

    // aktuelle Umgebung patchen
    patchJasmineEnv(window);

    // alle Frames im Top-Window patchen (da sitzt oft jasmine)
    try {
      for (const fw of Array.from(topWin.frames as any)) patchJasmineEnv(fw);
    } catch {}

    if (Date.now() < deadline) {
      setTimeout(tick, 50);
    }
  };

  tick();
})();

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    disableNetwork(fs).catch(() => {});
    return fs;
  }),
];

// ---- Patch: configureTestingModule immer mit GLOBAL_PROVIDERS + "Service-in-imports" Fix ----
const originalConfigure = TestBed.configureTestingModule.bind(TestBed);

function isProbablyService(x: any): boolean {
  return !!x?.ɵprov && !x?.ɵcmp && !x?.ɵdir && !x?.ɵpipe && !x?.ɵmod;
}

(TestBed as any).configureTestingModule = (moduleDef: any = {}) => {
  const imports = moduleDef.imports ?? [];
  const movedServices = imports.filter(isProbablyService);

  moduleDef.imports = imports.filter((i: any) => !isProbablyService(i));
  moduleDef.providers = [
    ...(moduleDef.providers ?? []),
    ...movedServices,
    ...GLOBAL_PROVIDERS,
  ];

  return originalConfigure(moduleDef);
};

// ---- Specs laden (stabil!) ----
const context = require.context('./', true, /\.spec\.ts$/);
context.keys().sort().forEach(context);
