import { TestBed } from '@angular/core/testing';

import { StatisticsService } from './statistics.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('StatisticsService', () => {
  let service: StatisticsService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...FIREBASE_TEST_PROVIDERS],
    });

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(StatisticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
