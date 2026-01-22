import { TestBed } from '@angular/core/testing';

import { FriendsService } from './friends.services';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('FriendsServices', () => {
  let service: FriendsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,
      ],
    }).compileComponents?.();

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(FriendsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
