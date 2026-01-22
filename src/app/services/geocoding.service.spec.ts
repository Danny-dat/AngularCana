import { TestBed } from '@angular/core/testing';

import { GeocodingService } from './geocoding.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('GeocodingService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });
  });
  
  it('should be created', () => {
    const service = TestBed.inject(GeocodingService);
    expect(service).toBeTruthy();
  });
});
