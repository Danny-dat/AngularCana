import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThcComponent } from './thc.component';

describe('Thc', () => {
  let component: ThcComponent;
  let fixture: ComponentFixture<ThcComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThcComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThcComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
