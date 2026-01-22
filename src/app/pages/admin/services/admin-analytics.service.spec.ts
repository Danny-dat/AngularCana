import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAnalyticsService } from './admin-analytics.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminAnalyticsService', () => {
    let component: AdminAnalyticsService;
  let fixture: ComponentFixture<AdminAnalyticsService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAnalyticsService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAnalyticsService);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    const service = TestBed.inject(AdminAnalyticsService);
    expect(service).toBeTruthy();
  });
});
