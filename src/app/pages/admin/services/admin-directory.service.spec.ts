import { TestBed } from '@angular/core/testing';

import { AdminDirectoryService } from './admin-directory.service';

describe('AdminDirectoryService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminDirectoryService);
    expect(service).toBeTruthy();
  });
});
