import { TestBed } from '@angular/core/testing';

import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  it('should be created', () => {
    const service = TestBed.inject(GeocodingService);
    expect(service).toBeTruthy();
  });
});
