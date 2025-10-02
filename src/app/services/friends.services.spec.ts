import { TestBed } from '@angular/core/testing';

import { FriendsServices } from './friends.services';

describe('FriendsServices', () => {
  let service: FriendsServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FriendsServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
