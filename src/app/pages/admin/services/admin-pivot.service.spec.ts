import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPivotService } from './admin-pivot.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminPivotService', () => {
  let service: AdminPivotService;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    service = TestBed.inject(AdminPivotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
