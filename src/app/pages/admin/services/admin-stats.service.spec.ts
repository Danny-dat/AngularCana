import { TestBed } from '@angular/core/testing';

import { AdminStatsService } from './admin-stats.service';

describe('AdminStatsService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminStatsService);
    expect(service).toBeTruthy();
  });
});
