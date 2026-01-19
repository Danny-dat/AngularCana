import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReasonDialogComponent } from './reason-dialog';

describe('ReasonDialogComponent', () => {
  let fixture: ComponentFixture<ReasonDialogComponent>;
  let component: ReasonDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReasonDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { title: 'Test', confirmText: 'OK', required: true },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReasonDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
