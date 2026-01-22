import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRolesService } from './admin-roles.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminRolesService', () => {
  let service: AdminRolesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });

    service = TestBed.inject(AdminRolesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
