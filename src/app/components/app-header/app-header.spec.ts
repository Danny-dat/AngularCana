import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AppHeaderComponent } from './app-header';

// Services
import { NotificationService } from '../../services/notification.service';
import { NotificationSoundService } from '../../services/notification-sound.service';
import { ThemeService } from '../../services/theme.service';
import { UserDataService } from '../../services/user-data.service';

import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

// ---- Dummy-Komponente für Routing-Tests ----
@Component({ standalone: true, template: '' })
class DummyCmp {}

// ✅ Test-Routen (wichtig: login/social existieren, damit Navigation nicht crasht)
const routes: Routes = [
  { path: 'users', component: DummyCmp, data: { title: 'Benutzer' } },
  { path: 'login', component: DummyCmp, data: { title: 'Login' } },
  { path: 'social', component: DummyCmp, data: { title: 'Social' } },
];

// ---- Mocks ----
class MockNotificationService {
  unreadCount$ = new BehaviorSubject<number>(0);
  notifications$ = new BehaviorSubject<any[]>([]);
  listen = jasmine.createSpy('listen').and.callFake((_uid: string) => () => {});
  markAsRead = jasmine.createSpy('markAsRead').and.returnValue(Promise.resolve());
  delete = jasmine.createSpy('delete').and.returnValue(Promise.resolve());
}

class MockNotificationSoundService {
  play = jasmine.createSpy('play').and.returnValue(Promise.resolve());
}

class MockThemeService {
  private cur: 'light' | 'dark' = 'light';
  getTheme() { return this.cur; }
  setTheme(t: 'light' | 'dark') { this.cur = t; }
}

class MockUserDataService {
  saveUserData = jasmine.createSpy('saveUserData').and.returnValue(Promise.resolve());
}

describe('AppHeaderComponent (provideRouter, ohne ESM-Spies)', () => {
  let fixture: ComponentFixture<AppHeaderComponent>;
  let component: AppHeaderComponent;
  let router: Router;
  let noti: MockNotificationService;
  let sound: MockNotificationSoundService;

  beforeEach(async () => {
    // Keys, die die Komponente nutzt, sauber halten
    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username');
      localStorage.removeItem('notify:sound');
      localStorage.removeItem('ui:theme');
      localStorage.removeItem('pref-theme');
    } catch {}

    // ✅ Auth-Mock: user(this.auth) braucht onIdTokenChanged UND storage-Handler braucht currentUser
    const mockUser = { uid: 'u1', displayName: null, email: null } as any;

    const authMock: any = {
      currentUser: mockUser,
      _delegate: {
        onIdTokenChanged: (cb: any) => {
          cb(mockUser);      // -> "eingeloggt"
          return () => {};   // unsubscribe
        },
        signOut: () => Promise.resolve(), // für logout() (optional, aber sauber)
      },
    };

    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent, DummyCmp],
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: NotificationSoundService, useClass: MockNotificationSoundService },
        { provide: ThemeService, useClass: MockThemeService },
        { provide: UserDataService, useClass: MockUserDataService },
        { provide: Auth, useValue: authMock },
        // Firestore wird hier nicht gebraucht, aber App kann es injizieren
        { provide: Firestore, useValue: {} as any },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AppHeaderComponent);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);
    noti = TestBed.inject(NotificationService) as any as MockNotificationService;
    sound = TestBed.inject(NotificationSoundService) as any as MockNotificationSoundService;

    fixture.detectChanges();
  });

  afterEach(() => {
    try { fixture.destroy(); } catch {}
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows default "User" and updates from localStorage', async () => {
    expect(component.userDisplayName).toBe('User');

    spyOn(localStorage, 'getItem').and.callFake((key: string) =>
      key === 'displayName' ? 'LocalName' : null,
    );

    // Wichtig: storage-Handler liest localStorage.getItem() (nicht ev.newValue)
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

    const bellBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.bell-wrap .icon-btn');

    bellBtn.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.showNotifications).toBeTrue();

    document.body.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.showNotifications).toBeFalse();
  });

  it('calls markAsRead when a notification item is clicked', async () => {
    // optional: typ setzen, falls dein Template openNotification() nutzt
    noti.notifications$.next([
      { id: 'n1', message: 'Hello', read: false, timestamp: new Date(), type: 'friend_request' },
    ]);

    await Promise.resolve();
    fixture.detectChanges();

    const bellBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.bell-wrap .icon-btn');

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
    const navigateSpy = spyOn((component as any).router, 'navigateByUrl')
      .and.returnValue(Promise.resolve(true));

    await component.logout();
    fixture.detectChanges();

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
