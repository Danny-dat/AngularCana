import { TestBed } from '@angular/core/testing';

import { Presence } from './presence';

describe('Presence', () => {
  let service: Presence;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Presence);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
