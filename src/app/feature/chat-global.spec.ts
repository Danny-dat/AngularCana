import { TestBed } from '@angular/core/testing';

import { ChatGlobal } from './chat-global';

describe('ChatGlobal', () => {
  let service: ChatGlobal;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatGlobal);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
