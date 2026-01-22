import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LoginComponent } from './login';
import { AuthService } from '../../services/auth.service';
import { UserBootstrapService } from '../../services/user-bootstrap.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let router: Router;

  let authMock: jasmine.SpyObj<AuthService>;
  let bootstrapMock: jasmine.SpyObj<UserBootstrapService>;

  beforeEach(async () => {
    authMock = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'resetPassword']);
    bootstrapMock = jasmine.createSpyObj<UserBootstrapService>('UserBootstrapService', ['bootstrapNow']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: UserBootstrapService, useValue: bootstrapMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('clears old name fields on init (and does not crash if localStorage throws)', () => {
    spyOn(localStorage, 'removeItem').and.callFake(() => {
      throw new Error('localStorage blocked');
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(localStorage.removeItem).toHaveBeenCalled();
  });

  it('mapAuthError covers all known codes', () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    const map = (component as any).mapAuthError.bind(component) as (code?: string) => string;

    expect(map('auth/invalid-email')).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');
    expect(map('auth/missing-password')).toBe('Bitte ein Passwort eingeben.');
    expect(map('auth/wrong-password')).toBe('Falsches Passwort.');
    expect(map('auth/user-not-found')).toBe('Kein Benutzer mit dieser E-Mail gefunden.');
    expect(map('auth/too-many-requests')).toBe('Zu viele Versuche. Bitte später erneut versuchen.');
    expect(map('auth/network-request-failed')).toBe('Netzwerkfehler. Prüfe deine Internetverbindung.');
    expect(map('auth/invalid-credential')).toBe('Anmeldedaten ungültig.');
    expect(map('auth/something-else')).toBe('Login fehlgeschlagen. Bitte erneut versuchen.');
  });

  it('shows validation error if email or password missing', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = '   ';
    component.password = '';

    await component.doLogin();

    expect(authMock.login).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Bitte E-Mail und Passwort eingeben.');
    expect(component.isLoading).toBeFalse();
  });

  it('logs in successfully, bootstraps user data and navigates to dashboard', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const setItemSpy = spyOn(localStorage, 'setItem');
    const removeItemSpy = spyOn(localStorage, 'removeItem').and.callThrough();

    component.email = '  test@example.com  ';
    component.password = 'pw';

    authMock.login.and.resolveTo({
      user: { uid: 'uid-1', displayName: 'Display', email: 'test@example.com' },
    } as any);

    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doLogin();

    expect(authMock.login).toHaveBeenCalledWith('test@example.com', 'pw');
    expect(bootstrapMock.bootstrapNow).toHaveBeenCalledWith('uid-1');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
    expect(setItemSpy).toHaveBeenCalledWith('displayName', 'Display');
    // defensive cleanup
    expect(removeItemSpy).toHaveBeenCalledWith('username');
    expect(component.errorMessage).toBeNull();
    expect(component.isLoading).toBeFalse();
  });

  it('uses email when displayName is null', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = 'test@example.com';
    component.password = 'pw';

    authMock.login.and.resolveTo({
      user: { uid: 'u123', displayName: null, email: 'mail@example.com' },
    } as any);

    const setItemSpy = spyOn(localStorage, 'setItem');
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doLogin();

    expect(setItemSpy).toHaveBeenCalledWith('displayName', 'mail@example.com');
  });

  it("falls back to 'User' when no displayName and no email", async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = 'test@example.com';
    component.password = 'pw';

    authMock.login.and.resolveTo({
      user: { uid: 'u123', displayName: null, email: null },
    } as any);

    const setItemSpy = spyOn(localStorage, 'setItem');
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doLogin();

    expect(setItemSpy).toHaveBeenCalledWith('displayName', 'User');
  });

  it('returns early when AuthService returns null (blocked flow) and does not navigate', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = 'test@example.com';
    component.password = 'pw';

    authMock.login.and.resolveTo(null as any);

    await component.doLogin();

    expect(authMock.login).toHaveBeenCalled();
    expect(bootstrapMock.bootstrapNow).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('maps known auth errors and clears stale username on failure', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const removeItemSpy = spyOn(localStorage, 'removeItem').and.callThrough();

    component.email = 'bad@example.com';
    component.password = 'pw';

    authMock.login.and.rejectWith({ code: 'auth/invalid-email' });

    await component.doLogin();

    expect(component.errorMessage).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');
    expect(removeItemSpy).toHaveBeenCalledWith('username');
    expect(component.isLoading).toBeFalse();
  });

  it('reads nested error code fallback and uses default mapping for unknown codes', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = 'test@example.com';
    component.password = 'pw';

    authMock.login.and.rejectWith({
      error: { error: { message: 'auth/some-unknown-code' } },
    });

    await component.doLogin();

    expect(component.errorMessage).toBe('Login fehlgeschlagen. Bitte erneut versuchen.');
    expect(component.isLoading).toBeFalse();
  });

  it('reset password: shows validation error when email missing', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = '   ';
    await component.doResetPassword();

    expect(authMock.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Bitte zuerst deine E-Mail eingeben.');
  });

  it('reset password: sets neutral info message on success', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = '  test@example.com ';
    authMock.resetPassword.and.resolveTo();

    await component.doResetPassword();

    expect(authMock.resetPassword).toHaveBeenCalledWith('test@example.com');
    expect(component.infoMessage).toContain('Reset-Mail');
    expect(component.errorMessage).toBeNull();
  });

  it('reset password: maps common errors and has a safe default', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.email = 'test@example.com';

    authMock.resetPassword.and.rejectWith({ code: 'auth/invalid-email' });
    await component.doResetPassword();
    expect(component.errorMessage).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');

    authMock.resetPassword.and.rejectWith({ code: 'auth/too-many-requests' });
    await component.doResetPassword();
    expect(component.errorMessage).toBe('Zu viele Versuche. Bitte später erneut versuchen.');

    authMock.resetPassword.and.rejectWith({ code: 'auth/network-request-failed' });
    await component.doResetPassword();
    expect(component.errorMessage).toBe('Netzwerkfehler. Prüfe deine Internetverbindung.');

    authMock.resetPassword.and.rejectWith({ code: 'auth/something-else' });
    await component.doResetPassword();
    expect(component.errorMessage).toBe('Konnte Reset-Mail nicht senden. Bitte erneut versuchen.');
  });

  it('calls markForCheck on important UI updates', async () => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const cdr = (component as any)['cdr'] as ChangeDetectorRef;
    const markSpy = spyOn(cdr, 'markForCheck').and.callThrough();

    // missing input triggers early return + markForCheck calls
    component.email = '';
    component.password = '';

    await component.doLogin();

    expect(markSpy).toHaveBeenCalled();
  });
});
