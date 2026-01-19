import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { RegisterComponent } from './register';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { UserBootstrapService } from '../../services/user-bootstrap.service';
import { normalizeUnifiedUserName } from '../../utils/user-name';

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      } as any),
  });
}

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let router: Router;

  let authMock: jasmine.SpyObj<AuthService>;
  let themeMock: jasmine.SpyObj<ThemeService>;
  let bootstrapMock: jasmine.SpyObj<UserBootstrapService>;

  beforeEach(async () => {
    authMock = jasmine.createSpyObj<AuthService>('AuthService', ['register']);
    themeMock = jasmine.createSpyObj<ThemeService>('ThemeService', ['setTheme']);
    bootstrapMock = jasmine.createSpyObj<UserBootstrapService>('UserBootstrapService', ['bootstrapNow']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, RouterTestingModule.withRoutes([])],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ThemeService, useValue: themeMock },
        { provide: UserBootstrapService, useValue: bootstrapMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('selectTheme stores selectedTheme', () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;

    component.selectTheme('dark');
    expect(component.selectedTheme).toBe('dark');

    component.selectTheme('light');
    expect(component.selectedTheme).toBe('light');
  });

  it('selectAvatar sets photoURL and isAvatarSelected works', () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;

    component.selectAvatar('assets/avatars/a.png');
    expect(component.form.photoURL).toBe('assets/avatars/a.png');
    expect(component.isAvatarSelected('assets/avatars/a.png')).toBeTrue();
    expect(component.isAvatarSelected('assets/avatars/b.png')).toBeFalse();

    // cover nullish coalescing branch
    component.form.photoURL = undefined as any;
    expect(component.isAvatarSelected('assets/avatars/a.png')).toBeFalse();
  });

  it('doRegister: uses explicitly selected theme and bootstraps + navigates on success', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const setItemSpy = spyOn(localStorage, 'setItem').and.callThrough();

    component.selectTheme('dark');
    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = '  @Ma X!  ';
    component.form.firstName = 'Max';
    component.form.lastName = 'Mustermann';
    component.form.instagram = 'max';

    authMock.register.and.resolveTo({ uid: 'uid-1' } as any);
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doRegister();

    expect(setItemSpy).toHaveBeenCalledWith('pref-theme', 'dark');

    expect(authMock.register).toHaveBeenCalled();
    const arg = authMock.register.calls.mostRecent().args[0] as any;
    expect(arg.theme).toBe('dark');
    expect(arg.displayName).toBe(normalizeUnifiedUserName('  @Ma X!  '));
    // representative fields for "Meine Daten" (ensure they are present in the payload)
    expect(arg.firstName).toBe('Max');
    expect(arg.lastName).toBe('Mustermann');
    expect(arg.instagram).toBe('max');

    expect(themeMock.setTheme).toHaveBeenCalledWith('dark');
    expect(bootstrapMock.bootstrapNow).toHaveBeenCalledWith('uid-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.errorMessage).toBeNull();
    expect(component.isLoading).toBeFalse();
  });

  it('doRegister: falls back to localStorage theme when no selection is made', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    setMatchMedia(false);
    spyOn(localStorage, 'getItem').and.returnValue('light');

    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = 'User';

    authMock.register.and.resolveTo({ uid: 'uid-2' } as any);
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doRegister();

    const arg = authMock.register.calls.mostRecent().args[0] as any;
    expect(arg.theme).toBe('light');
    expect(themeMock.setTheme).toHaveBeenCalledWith('light');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('doRegister: uses system dark mode if localStorage has no valid theme', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    spyOn(localStorage, 'getItem').and.returnValue('');
    setMatchMedia(true);

    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = 'User';

    authMock.register.and.resolveTo({ uid: 'uid-3' } as any);
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doRegister();

    const arg = authMock.register.calls.mostRecent().args[0] as any;
    expect(arg.theme).toBe('dark');
    expect(themeMock.setTheme).toHaveBeenCalledWith('dark');
  });

  it('doRegister: defaults to light when no valid theme and system is not dark', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    spyOn(localStorage, 'getItem').and.returnValue('weird');
    setMatchMedia(false);

    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = 'User';

    authMock.register.and.resolveTo({ uid: 'uid-3b' } as any);
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doRegister();

    const arg = authMock.register.calls.mostRecent().args[0] as any;
    expect(arg.theme).toBe('light');
    expect(themeMock.setTheme).toHaveBeenCalledWith('light');
  });

  it('doRegister: safely defaults to light when theme detection throws', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    spyOn(localStorage, 'getItem').and.callFake(() => {
      throw new Error('blocked');
    });

    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = 'User';

    authMock.register.and.resolveTo({ uid: 'uid-4' } as any);
    bootstrapMock.bootstrapNow.and.resolveTo();

    await component.doRegister();

    const arg = authMock.register.calls.mostRecent().args[0] as any;
    expect(arg.theme).toBe('light');
    expect(themeMock.setTheme).toHaveBeenCalledWith('light');
  });

  it('doRegister: shows a user friendly error on failure', async () => {
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectTheme('light');
    component.form.email = 'test@example.com';
    component.form.password = 'pw';
    component.form.displayName = 'User';

    authMock.register.and.rejectWith(new Error('nope'));

    await component.doRegister();

    expect(component.errorMessage).toBe('Registrierung fehlgeschlagen.');
    expect(component.isLoading).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/dashboard');
  });
});
