import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdSlotComponent } from './ad-slot.component';

describe('AdSlotComponent', () => {
  let component: AdSlotComponent;
  let fixture: ComponentFixture<AdSlotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdSlotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdSlotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
