import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminModerationService } from './admin-moderation.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminModerationService', () => {
  let component: AdminModerationService;
  let fixture: ComponentFixture<AdminModerationService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminModerationService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminModerationService);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    const service = TestBed.inject(AdminModerationService);
    expect(service).toBeTruthy();
  });
});
