import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { LockDialogComponent } from './lock-dialog';

describe('LockDialogComponent', () => {
  let fixture: ComponentFixture<LockDialogComponent>;
  let component: LockDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LockDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }],
    }).compileComponents();

    fixture = TestBed.createComponent(LockDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
