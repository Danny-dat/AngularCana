// This file is required by the Angular CLI test builder.
// It configures the global testing environment.
//
// IMPORTANT:
// Some Angular 20 setups compile this file without Jasmine globals
// (beforeEach/describe/it) in the TS context, which makes `beforeEach`
// a TS compile error. To keep the setup robust, we do NOT rely on Jasmine
// hooks here.

import 'zone.js/testing';

import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, disableNetwork } from 'firebase/firestore';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';

// Minimal config for unit tests. It's only used to satisfy DI.
// No real network calls should be made (we disable Firestore networking below).
const firebaseTestConfig = {
  apiKey: 'demo',
  authDomain: 'demo.firebaseapp.com',
  projectId: 'demo',
  appId: 'demo',
};

const app = getApps().length ? getApp() : initializeApp(firebaseTestConfig);

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  {
    teardown: { destroyAfterEach: true },
  },
);

function applyBaseProviders(): void {
  // NOTE: configureTestingModule merges into the current testing module.
  // After a reset, we re-apply these providers so "should create" specs that
  // inject Auth/Firestore/Router don't fail.
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      provideLocationMocks(),
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),

      // Firebase / AngularFire DI
      provideFirebaseApp(() => app),
      provideAuth(() => getAuth(app)),
      provideFirestore(() => {
        const fs = getFirestore(app);
        // Prevent any network access in unit tests.
        disableNetwork(fs).catch(() => void 0);
        return fs;
      }),
    ],
  });
}

// Apply once at startup.
applyBaseProviders();

// Ensure the base providers are restored after any TestBed reset.
// This works even when teardown/reset is handled by Angular internally.
try {
  const tbAny: any = getTestBed();

  const origResetInstance = tbAny.resetTestingModule?.bind(tbAny);
  if (origResetInstance) {
    tbAny.resetTestingModule = (...args: any[]) => {
      const res = origResetInstance(...args);
      try {
        applyBaseProviders();
      } catch {
        // ignore
      }
      return res;
    };
  }

  const origResetStatic = (TestBed as any).resetTestingModule?.bind(TestBed);
  if (origResetStatic) {
    (TestBed as any).resetTestingModule = (...args: any[]) => {
      const res = origResetStatic(...args);
      try {
        applyBaseProviders();
      } catch {
        // ignore
      }
      return res;
    };
  }
} catch {
  // ignore
}
