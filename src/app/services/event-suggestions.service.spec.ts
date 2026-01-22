import { TestBed } from '@angular/core/testing';

import { ChatService } from './chat.services';
import { EventSuggestionsService } from './event-suggestions.service';

describe('EventSuggestionsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ChatService,
          useValue: {
            sendDirect: jasmine.createSpy('sendDirect').and.resolveTo(undefined),
          },
        },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(EventSuggestionsService);
    expect(service).toBeTruthy();
  });
});
