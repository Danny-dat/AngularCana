import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminDirectoryService } from './admin-directory.service';
import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../../testing/firebase-test-providers';

describe('AdminDirectoryService', () => {
  let service: AdminDirectoryService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...FIREBASE_TEST_PROVIDERS,
        AdminDirectoryService,
      ],
    });

    await disableFirestoreNetworkForTests();
    service = TestBed.inject(AdminDirectoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
