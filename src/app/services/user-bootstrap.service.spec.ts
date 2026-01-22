import { TestBed } from '@angular/core/testing';
import { UserBootstrapService } from './user-bootstrap.service';

import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('UserBootstrapService', () => {
  let service: UserBootstrapService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        ...FIREBASE_TEST_PROVIDERS,
      ],
    });

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(UserBootstrapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('bootstrapNow should resolve for empty uid', async () => {
    await expectAsync(service.bootstrapNow('')).toBeResolved();
  });
});
