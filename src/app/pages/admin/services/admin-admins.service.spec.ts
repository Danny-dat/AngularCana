import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminAdminsService } from './admin-admins.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminAdminsService', () => {
  let service: AdminAdminsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminAdminsService,
        { provide: Auth, useValue: {} as Auth },
        { provide: Firestore, useValue: {} as Firestore },
      ],
    });

    service = TestBed.inject(AdminAdminsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
