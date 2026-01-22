import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(GeocodingService);
    expect(service).toBeTruthy();
  });
});
