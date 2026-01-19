import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalChatPage } from './global-chat';

describe('GlobalChat', () => {
  let component: GlobalChatPage;
  let fixture: ComponentFixture<GlobalChatPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalChatPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalChatPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
