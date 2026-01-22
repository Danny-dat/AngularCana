import { TestBed } from '@angular/core/testing';
import { UserDataService } from './user-data.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('UserDataService', () => {
  let service: UserDataService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,
      ],
    });

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(UserDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
