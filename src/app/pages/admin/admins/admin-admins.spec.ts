import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAdminsComponent } from './admin-admins';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminAdmins', () => {
  let component: AdminAdminsComponent;
  let fixture: ComponentFixture<AdminAdminsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAdminsComponent],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAdminsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
