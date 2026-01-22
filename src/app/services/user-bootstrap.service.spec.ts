import { TestBed } from '@angular/core/testing';

import { UserBootstrapService } from './user-bootstrap.service';

describe('UserBootstrapService', () => {
  it('should be created', () => {
    const service = TestBed.inject(UserBootstrapService);
    expect(service).toBeTruthy();
  });

  it('bootstrapNow should resolve for empty uid', async () => {
    const service = TestBed.inject(UserBootstrapService);
    await expectAsync(service.bootstrapNow('')).toBeResolved();
  });
});
