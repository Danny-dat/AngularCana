import { TestBed } from '@angular/core/testing';

import { NotificationService } from './notification.service';
import { FriendsService } from './friends.services';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../testing/firebase-test-providers';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        ...FIREBASE_TEST_PROVIDERS,

        {
          provide: FriendsService,
          useValue: {
            listFriends: jasmine.createSpy('listFriends').and.resolveTo([]),
          },
        },
      ],
    }).compileComponents?.();

    await disableFirestoreNetworkForTests();

    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
