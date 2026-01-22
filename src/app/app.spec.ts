import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { AppComponent } from './app';
import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../testing/firebase-test-providers';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideLocationMocks(),
        ...FIREBASE_TEST_PROVIDERS,
      ],
    }).compileComponents();

    await disableFirestoreNetworkForTests();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
