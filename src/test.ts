// src/test.ts
import 'zone.js/testing';

import { NgModule } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { disableNetwork } from 'firebase/firestore';

const firebaseTestConfig = {
  apiKey: 'test',
  authDomain: 'localhost',
  projectId: 'demo-test',
  appId: '1:123:web:123',
};

@NgModule({
  imports: [BrowserDynamicTestingModule],
  providers: [
    // RouterLink, ActivatedRoute, Router, etc.
    provideRouter([]),

    // HttpClient without real network.
    provideHttpClient(),
    provideHttpClientTesting(),

    // AngularFire tokens used across the app.
    provideFirebaseApp(() => initializeApp(firebaseTestConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      const fs = getFirestore();
      // Prevent Firestore from attempting to talk to the network in unit tests.
      void disableNetwork(fs).catch(() => void 0);
      return fs;
    }),
  ],
})
class TestEnvironmentModule {}

getTestBed().initTestEnvironment(
  TestEnvironmentModule,
  platformBrowserDynamicTesting()
);
