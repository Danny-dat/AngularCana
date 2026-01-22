import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.services';

import { Firestore, disableNetwork } from '@angular/fire/firestore';
import { FIREBASE_TEST_PROVIDERS } from '../../testing/firebase-test-providers';

describe('ChatServices', () => {
  let service: ChatService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,
        ChatService,
      ],
    });

    // optional: blockt echte Netzwerkzugriffe komplett
    await disableNetwork(TestBed.inject(Firestore) as any);

    service = TestBed.inject(ChatService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
