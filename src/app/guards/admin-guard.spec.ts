import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { adminGuard } from './admin-guard';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('adminGuard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();
  });

  it('should redirect to /login when no user is signed in', async () => {
    const obs: any = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
    const res = await firstValueFrom(obs.pipe(take(1)));
    expect(res).toBeTruthy();
    expect(res instanceof UrlTree).toBeTrue();
  });
});
