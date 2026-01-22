import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { GlobalChatPage } from './global-chat';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../testing/firebase-test-providers';

describe('GlobalChat', () => {
  let component: GlobalChatPage;
  let fixture: ComponentFixture<GlobalChatPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalChatPage],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        ...FIREBASE_TEST_PROVIDERS,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    await disableFirestoreNetworkForTests();

    fixture = TestBed.createComponent(GlobalChatPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
