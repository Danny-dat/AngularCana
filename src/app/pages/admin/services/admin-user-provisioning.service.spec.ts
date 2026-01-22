import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminUserProvisioningService } from './admin-user-provisioning.service';
import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../../testing/firebase-test-providers';

describe('AdminUserProvisioningService', () => {
  let service: AdminUserProvisioningService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...FIREBASE_TEST_PROVIDERS,
        AdminUserProvisioningService,
      ],
    });

    await disableFirestoreNetworkForTests();
    service = TestBed.inject(AdminUserProvisioningService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
