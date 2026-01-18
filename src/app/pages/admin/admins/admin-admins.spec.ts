import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAdmins } from './admin-admins';

describe('AdminAdmins', () => {
  let component: AdminAdmins;
  let fixture: ComponentFixture<AdminAdmins>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAdmins]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAdmins);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
