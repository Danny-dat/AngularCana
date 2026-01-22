import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUserProvisioningService } from './admin-user-provisioning.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminUserProvisioningService', () => {
      let component: AdminUserProvisioningService;
  let fixture: ComponentFixture<AdminUserProvisioningService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserProvisioningService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUserProvisioningService);
    component = fixture.componentInstance;
  });
  it('should be created', () => {
    const service = TestBed.inject(AdminUserProvisioningService);
    expect(service).toBeTruthy();
  });
});
