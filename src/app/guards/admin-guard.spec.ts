import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { adminGuard } from './admin-guard';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('adminGuard', () => {
  beforeEach(() => {
    const authMock = {
      _delegate: {
        onIdTokenChanged: (cb: any) => {
          cb(null);
          return () => {};
        },
      },
    } as any as Auth;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} as any },
      ],
    });
  });

  it('should be created', () => {
    expect(adminGuard).toBeTruthy();
  });

  it('should redirect to /login when no user is signed in', async () => {
    const obs: any = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

    const res = await firstValueFrom(obs.pipe(take(1)));
    expect(res).toBeTruthy();
    expect(res instanceof UrlTree).toBeTrue();
  });
});
