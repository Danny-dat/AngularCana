import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppHeaderComponent } from './app-header';

// Services, die die Komponente injiziert:
import { NotificationService } from '../../services/notification.service';
import { NotificationSoundService } from '../../services/notification-sound.service';

// ---- Dummy-Komponente für Routing-Tests ----
@Component({ standalone: true, template: '' })
class DummyCmp {}

// Test-Routen: eine Route mit data.title, um den Seitentitel zu prüfen
const routes: Routes = [
  { path: 'users', component: DummyCmp, data: { title: 'Benutzer' } },
];

// ---- Mocks ----
class MockNotificationService {
  unreadCount$ = new BehaviorSubject<number>(0);
  notifications$ = new BehaviorSubject<any[]>([]);
  listen = jasmine.createSpy('listen').and.callFake((_uid: string) => () => {});
  markAsRead = jasmine.createSpy('markAsRead').and.returnValue(Promise.resolve());
}
class MockNotificationSoundService {
  play = jasmine.createSpy('play').and.returnValue(Promise.resolve());
}

describe('AppHeaderComponent (provideRouter, ohne ESM-Spies)', () => {
  let fixture: ComponentFixture<AppHeaderComponent>;
  let component: AppHeaderComponent;
  let router: Router;
  let noti: MockNotificationService;
  let sound: MockNotificationSoundService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent, DummyCmp],
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: NotificationSoundService, useClass: MockNotificationSoundService },
      ],
      // Unbekannte Elemente (z. B. <app-app-sidenav>) im Template ignorieren
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AppHeaderComponent);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);
    noti = TestBed.inject(NotificationService) as any as MockNotificationService;
    sound = TestBed.inject(NotificationSoundService) as any as MockNotificationSoundService;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows default "User" and updates from localStorage', async () => {
    // Standardwert (falls kein Name gesetzt)
    expect(component.userDisplayName).toBeTruthy();

    spyOn(localStorage, 'getItem').and.callFake((key: string) => (key === 'displayName' ? 'LocalName' : null as any));
    window.dispatchEvent(new StorageEvent('storage', { key: 'displayName' }));
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.userDisplayName).toBe('LocalName');
  });

  it('renders badge and plays sound when unreadCount increases', async () => {
    noti.unreadCount$.next(0);
    await Promise.resolve();
    fixture.detectChanges();

    noti.unreadCount$.next(3);
    await Promise.resolve();
    fixture.detectChanges();

    expect(sound.play).toHaveBeenCalled();

    const badge: HTMLElement | null = fixture.nativeElement.querySelector('.badge');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('show')).toBeTrue();
    expect(badge!.textContent?.trim()).toBe('3');
  });

  it('toggles notifications dropdown and closes on outside click', async () => {
    expect(component.showNotifications).toBeFalse();

    const bellBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.bell-wrap .icon-btn');
    bellBtn.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.showNotifications).toBeTrue();

    document.body.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.showNotifications).toBeFalse();
  });

  it('calls markRead when a notification item is clicked', async () => {
    noti.notifications$.next([{ id: 'n1', message: 'Hello', read: false, timestamp: new Date() }]);
    await Promise.resolve();
    fixture.detectChanges();

    const bellBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.bell-wrap .icon-btn');
    bellBtn.click();
    await Promise.resolve();
    fixture.detectChanges();

    const item: HTMLElement = fixture.nativeElement.querySelector('.dropdown .item');
    expect(item).toBeTruthy();

    item.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(noti.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('navigates to /login on logout and clears localStorage', async () => {
    const removeSpy = spyOn(localStorage, 'removeItem').and.stub();
    const navigateSpy = spyOn((component as any).router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

    await component.logout();
    fixture.detectChanges();

    // Wir testen das beobachtbare Verhalten (Navigation + LocalStorage)
    expect(removeSpy).toHaveBeenCalledWith('displayName');
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('updates pageTitle from route data on navigation (/users → "Benutzer")', async () => {
    await router.navigateByUrl('/users');
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.pageTitle).toBe('Benutzer');
  });
});
