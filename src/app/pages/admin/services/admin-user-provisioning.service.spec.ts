import { TestBed } from '@angular/core/testing';

import { AdminUserProvisioningService } from './admin-user-provisioning.service';

describe('AdminUserProvisioningService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminUserProvisioningService);
    expect(service).toBeTruthy();
  });
});
