import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { AddAdminDialogComponent } from './add-admin-dialog';

describe('AddAdminDialogComponent', () => {
  let fixture: ComponentFixture<AddAdminDialogComponent>;
  let component: AddAdminDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAdminDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddAdminDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
