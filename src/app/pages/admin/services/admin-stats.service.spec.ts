import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminStatsService } from './admin-stats.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminStatsService', () => {
      let component: AdminStatsService;
  let fixture: ComponentFixture<AdminStatsService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStatsService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStatsService);
    component = fixture.componentInstance;
  });
  it('should be created', () => {
    const service = TestBed.inject(AdminStatsService);
    expect(service).toBeTruthy();
  });
});
