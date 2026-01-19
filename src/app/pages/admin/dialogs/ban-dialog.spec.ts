import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { BanDialogComponent } from './ban-dialog';

describe('BanDialogComponent', () => {
  let fixture: ComponentFixture<BanDialogComponent>;
  let component: BanDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }],
    }).compileComponents();

    fixture = TestBed.createComponent(BanDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
