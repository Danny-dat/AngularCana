import { TestBed } from '@angular/core/testing';

import { AdminRolesService } from './admin-roles.service';

describe('AdminRolesService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminRolesService);
    expect(service).toBeTruthy();
  });
});
