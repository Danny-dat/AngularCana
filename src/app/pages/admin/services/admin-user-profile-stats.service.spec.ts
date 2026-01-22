import { TestBed } from '@angular/core/testing';

import { AdminUserProfileStatsService } from './admin-user-profile-stats.service';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, Firestore } from '@angular/fire/firestore';

import { initializeApp } from 'firebase/app';
import { disableNetwork } from 'firebase/firestore';

describe('AdminUserProfileStatsService', () => {
  let service: AdminUserProfileStatsService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() =>
          initializeApp({
            projectId: 'demo-unit-test',
            apiKey: 'fake',
            appId: '1:123:web:abc',
          })
        ),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),

        AdminUserProfileStatsService,
      ],
    });

    await disableNetwork(TestBed.inject(Firestore) as any);

    service = TestBed.inject(AdminUserProfileStatsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
