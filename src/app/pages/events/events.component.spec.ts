import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { EventsComponent } from './events.component';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../testing/firebase-test-providers';

describe('Events Page', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideNoopAnimations(),

        provideHttpClient(),
        provideHttpClientTesting(),

        ...FIREBASE_TEST_PROVIDERS,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    await disableFirestoreNetworkForTests();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
