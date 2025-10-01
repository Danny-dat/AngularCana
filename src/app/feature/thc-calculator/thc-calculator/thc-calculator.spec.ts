import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThcCalculator } from './thc-calculator';

describe('ThcCalculator', () => {
  let component: ThcCalculator;
  let fixture: ComponentFixture<ThcCalculator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThcCalculator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThcCalculator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
