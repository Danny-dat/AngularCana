import { TestBed } from '@angular/core/testing';

import { AdminModerationService } from './admin-moderation.service';

describe('AdminModerationService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminModerationService);
    expect(service).toBeTruthy();
  });
});
