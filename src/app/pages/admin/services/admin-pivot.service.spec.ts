import { TestBed } from '@angular/core/testing';

import { AdminPivotService } from './admin-pivot.service';

describe('AdminPivotService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminPivotService);
    expect(service).toBeTruthy();
  });
});
