import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSidenav } from './app-sidenav';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('AppSidenav', () => {
  let component: AppSidenav;
  let fixture: ComponentFixture<AppSidenav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSidenav],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppSidenav);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
