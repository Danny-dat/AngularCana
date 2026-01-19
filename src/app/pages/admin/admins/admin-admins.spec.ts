import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAdminsComponent } from './admin-admins';

describe('AdminAdmins', () => {
  let component: AdminAdminsComponent;
  let fixture: ComponentFixture<AdminAdminsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAdminsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAdminsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
