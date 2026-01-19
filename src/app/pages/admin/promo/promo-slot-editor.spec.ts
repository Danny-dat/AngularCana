import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoSlotEditorComponent } from './promo-slot-editor';

describe('PromoSlotEditorComponent', () => {
  let fixture: ComponentFixture<PromoSlotEditorComponent>;
  let component: PromoSlotEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoSlotEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PromoSlotEditorComponent);
    component = fixture.componentInstance;
    component.slotId = 'slot1';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
