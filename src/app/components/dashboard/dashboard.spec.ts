import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard';

import { MapService } from '../../services/map.service';
import { EventsService } from '../../services/events.service';
import { NotificationService } from '../../services/notification.service';
import { AdminStatsService } from '../../pages/admin/services/admin-stats.service';

import {
  FIREBASE_TEST_PROVIDERS,
  disableFirestoreNetworkForTests,
} from '../../../testing/firebase-test-providers';

// ───────── Mocks ─────────
class MockMapService {
  initializeMap = jasmine.createSpy('initializeMap').and.resolveTo();
  invalidateSizeSoon = jasmine.createSpy('invalidateSizeSoon');
  clearEvents = jasmine.createSpy('clearEvents');
  showLikedEvents = jasmine.createSpy('showLikedEvents');
  destroyMap = jasmine.createSpy('destroyMap');
}

class MockEventsService {
  listen = jasmine.createSpy('listen').and.returnValue(of([]));
}

class MockNotificationService {
  sendConsumptionToFriends = jasmine
    .createSpy('sendConsumptionToFriends')
    .and.returnValue(Promise.resolve());
}

class MockAdminStatsService {
  usersCount$ = of(0);
  adminsCount$ = of(0);
  bansCount$ = of(0);
  locksCount$ = of(0);

  onlineNowCount$ = of(0);
  active24hCount$ = of(0);
  active7dCount$ = of(0);

  consumptions7dCount$ = of(0);
  consumptions30dCount$ = of(0);

  reportsTotalCount$ = of(0);
  reportsResolvedCount$ = of(0);
  reportsOpenCount$ = of(0);

  eventsCount$ = of(0);
  eventSuggestionsOpenCount$ = of(0);

  promoSlotsCount$ = of(0);
  promoSlotsActiveCount$ = of(0);
}

describe('Dashboard', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),

        { provide: PLATFORM_ID, useValue: 'server' },

        { provide: MapService, useClass: MockMapService },
        { provide: EventsService, useClass: MockEventsService },
        { provide: NotificationService, useClass: MockNotificationService },

        { provide: AdminStatsService, useClass: MockAdminStatsService },

        ...FIREBASE_TEST_PROVIDERS,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    await disableFirestoreNetworkForTests();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
