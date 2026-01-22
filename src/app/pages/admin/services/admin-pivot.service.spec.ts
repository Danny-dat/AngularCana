import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPivotService } from './admin-pivot.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminPivotService', () => {
  let component: AdminPivotService;
  let fixture: ComponentFixture<AdminPivotService>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPivotService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPivotService);
    component = fixture.componentInstance;
  });
  it('should be created', () => {
    const service = TestBed.inject(AdminPivotService);
    expect(service).toBeTruthy();
  });
});
