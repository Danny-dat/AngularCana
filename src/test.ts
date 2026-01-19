// src/test.ts
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { getApp, getApps, initializeApp as initializeFirebaseApp } from 'firebase/app';
import { disableNetwork } from 'firebase/firestore';

const firebaseTestConfig = {
  apiKey: 'demo',
  authDomain: 'demo.firebaseapp.com',
  projectId: 'demo',
  appId: 'demo',
};

const app = getApps().length ? getApp() : initializeFirebaseApp(firebaseTestConfig);

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});

// globaler Default-Provider-Setup (einmalig)
TestBed.configureTestingModule({
  imports: [RouterTestingModule, HttpClientTestingModule],
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

    provideFirebaseApp(() => app),
    provideAuth(() => getAuth(app)),
    provideFirestore(() => {
      const fs = getFirestore(app);
      disableNetwork(fs).catch(() => void 0);
      return fs;
    }),
  ],
});
