import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Thc } from './thc.component';

describe('Thc', () => {
  let component: Thc;
  let fixture: ComponentFixture<Thc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Thc]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Thc);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
