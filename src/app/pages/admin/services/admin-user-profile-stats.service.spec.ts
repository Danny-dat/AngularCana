import { TestBed } from '@angular/core/testing';

import { AdminUserProfileStatsService } from './admin-user-profile-stats.service';

describe('AdminUserProfileStatsService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminUserProfileStatsService);
    expect(service).toBeTruthy();
  });
});
