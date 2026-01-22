import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalChatPage } from './global-chat';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('GlobalChat', () => {
  let component: GlobalChatPage;
  let fixture: ComponentFixture<GlobalChatPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalChatPage],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalChatPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
