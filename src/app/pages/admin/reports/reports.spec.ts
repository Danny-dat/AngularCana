import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminReports } from './reports';

describe('Reports', () => {
  let component: AdminReports;
  let fixture: ComponentFixture<AdminReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReports]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminReports);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
