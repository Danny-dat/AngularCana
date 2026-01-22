import { TestBed } from '@angular/core/testing';

import { EventsService } from './events.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,
      ],
    }).compileComponents?.();

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(EventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
