import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserDataComponent } from './user-data';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('UserData', () => {
  let component: UserDataComponent;
  let fixture: ComponentFixture<UserDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDataComponent],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserDataComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
