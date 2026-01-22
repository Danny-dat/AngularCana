import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUserProfileStatsService } from './admin-user-profile-stats.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminUserProfileStatsService', () => {
      let component: AdminUserProfileStatsService;
  let fixture: ComponentFixture<AdminUserProfileStatsService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserProfileStatsService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUserProfileStatsService);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    const service = TestBed.inject(AdminUserProfileStatsService);
    expect(service).toBeTruthy();
  });
});
