import { TestBed } from '@angular/core/testing';

import { UserBootstrapService } from './user-bootstrap.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('UserBootstrapService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: UserBootstrapService, useValue: {} as any },
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(UserBootstrapService);
    expect(service).toBeTruthy();
  });

  it('bootstrapNow should resolve for empty uid', async () => {
    const service = TestBed.inject(UserBootstrapService);
    await expectAsync(service.bootstrapNow('')).toBeResolved();
  });
});
