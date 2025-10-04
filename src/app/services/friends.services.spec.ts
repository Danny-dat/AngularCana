import { TestBed } from '@angular/core/testing';

import { FriendsService } from './friends.services';

describe('FriendsServices', () => {
  let service: FriendsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FriendsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
