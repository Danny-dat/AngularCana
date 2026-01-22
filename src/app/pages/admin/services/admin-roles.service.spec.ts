import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRolesService } from './admin-roles.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminRolesService', () => {
      let component: AdminRolesService;
  let fixture: ComponentFixture<AdminRolesService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRolesService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRolesService);
    component = fixture.componentInstance;
  });
  it('should be created', () => {
    const service = TestBed.inject(AdminRolesService);
    expect(service).toBeTruthy();
  });
});
