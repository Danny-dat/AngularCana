import { TestBed } from '@angular/core/testing';

import { ThcCalculatorService } from './thc-calculator.service';

describe('ThcCalculatorService', () => {
  let service: ThcCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThcCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
