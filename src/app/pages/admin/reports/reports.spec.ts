import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';

import { AdminReports } from './reports';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../../testing/firebase-test-providers';

describe('Reports', () => {
  let component: AdminReports;
  let fixture: ComponentFixture<AdminReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReports],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        ...FIREBASE_TEST_PROVIDERS,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    await disableFirestoreNetworkForTests();

    fixture = TestBed.createComponent(AdminReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
