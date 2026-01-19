import { TestBed } from '@angular/core/testing';

import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsService', () => {
  it('should be created', () => {
    const service = TestBed.inject(AdminAnalyticsService);
    expect(service).toBeTruthy();
  });
});
