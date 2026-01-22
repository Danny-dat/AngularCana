import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminModerationService } from './admin-moderation.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminModerationService', () => {
  let service: AdminModerationService;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });

    service = TestBed.inject(AdminModerationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
