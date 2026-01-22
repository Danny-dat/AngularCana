import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminStatsService } from './admin-stats.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminStatsService', () => {
  let service: AdminStatsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });

    service = TestBed.inject(AdminStatsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
