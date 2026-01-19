import { TestBed } from '@angular/core/testing';

import { AdminAdminsService } from './admin-admins.service';

describe('AdminAdminsService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminAdminsService);
    expect(service).toBeTruthy();
  });
});
