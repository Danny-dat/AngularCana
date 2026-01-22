import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSidenav } from './app-sidenav';

describe('AppSidenav', () => {
  let component: AppSidenav;
  let fixture: ComponentFixture<AppSidenav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSidenav]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppSidenav);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
