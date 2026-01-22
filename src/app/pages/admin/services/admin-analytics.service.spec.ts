import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAnalyticsService } from './admin-analytics.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AdminAnalyticsService', () => {
let service: AdminAnalyticsService;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    })
    
    service = TestBed.inject(AdminAnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
