import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPromo } from './promo';

describe('Promo', () => {
  let component: AdminPromo;
  let fixture: ComponentFixture<AdminPromo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPromo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPromo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
