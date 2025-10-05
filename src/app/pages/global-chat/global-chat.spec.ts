import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalChat } from './global-chat';

describe('GlobalChat', () => {
  let component: GlobalChat;
  let fixture: ComponentFixture<GlobalChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
