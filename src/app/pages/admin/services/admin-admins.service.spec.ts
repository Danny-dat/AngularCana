import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAdminsService } from './admin-admins.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminAdminsService', () => {
  let component: AdminAdminsService;
  let fixture: ComponentFixture<AdminAdminsService>;
  
    beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAdminsService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAdminsService);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    const service = TestBed.inject(AdminAdminsService);
    expect(service).toBeTruthy();
  });
});
