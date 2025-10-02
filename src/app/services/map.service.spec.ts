import { TestBed } from '@angular/core/testing';

import { MapServices } from './map.service';

describe('MapServices', () => {
  let service: MapServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
