import { TestBed } from '@angular/core/testing';

import { EventSuggestionsService } from './event-suggestions.service';
import { ChatService } from './chat.services';

import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('EventSuggestionsService', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),

        // ✅ Firebase (Auth/Firestore/App + SDK-Tokens)
        ...FIREBASE_TEST_PROVIDERS,

        // ✅ ChatService mocken (damit keine echten Side-Effects passieren)
        {
          provide: ChatService,
          useValue: {
            sendDirect: jasmine.createSpy('sendDirect').and.resolveTo(undefined),
          },
        },
      ],
    });

    await disableFirestoreNetworkForTests();
  });

  it('should be created', () => {
    const service = TestBed.inject(EventSuggestionsService);
    expect(service).toBeTruthy();
  });
});
