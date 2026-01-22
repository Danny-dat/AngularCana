import { TestBed } from '@angular/core/testing';

import { ChatService } from './chat.services';
import { EventSuggestionsService } from './event-suggestions.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

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
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(EventSuggestionsService);
    expect(service).toBeTruthy();
  });
});
