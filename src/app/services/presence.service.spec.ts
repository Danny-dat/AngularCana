import { TestBed } from '@angular/core/testing';

import { PresenceService } from './presence.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,
      ],
    }).compileComponents?.();

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(PresenceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
