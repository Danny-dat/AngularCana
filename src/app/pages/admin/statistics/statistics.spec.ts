import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminStatistic } from './statistics';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('Statistics', () => {
  let component: AdminStatistic;
  let fixture: ComponentFixture<AdminStatistic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStatistic],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStatistic);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
