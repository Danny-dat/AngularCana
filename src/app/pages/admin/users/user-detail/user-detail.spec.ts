import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { AdminUserDetailComponent } from './user-detail';
import {
  disableFirestoreNetworkForTests,
  FIREBASE_TEST_PROVIDERS,
} from '../../../../../testing/firebase-test-providers';

describe('AdminUserDetail', () => {
  let component: AdminUserDetailComponent;
  let fixture: ComponentFixture<AdminUserDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserDetailComponent],
      providers: [provideRouter([]), provideLocationMocks(), ...FIREBASE_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    await disableFirestoreNetworkForTests();

    fixture = TestBed.createComponent(AdminUserDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
