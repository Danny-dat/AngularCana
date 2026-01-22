import { TestBed } from '@angular/core/testing';

import { SessionService } from './session.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...FIREBASE_TEST_PROVIDERS],
    });

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(SessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
