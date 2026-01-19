import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { CreateUserDialogComponent } from './create-user-dialog';

describe('CreateUserDialogComponent', () => {
  let fixture: ComponentFixture<CreateUserDialogComponent>;
  let component: CreateUserDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateUserDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateUserDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
