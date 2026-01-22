import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';

import { AccountBlockedComponent } from './account-blocked';

describe('AccountBlockedComponent', () => {
  let fixture: ComponentFixture<AccountBlockedComponent>;
  let component: AccountBlockedComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountBlockedComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountBlockedComponent);
    component = fixture.componentInstance;
  });

  it('should create', fakeAsync(() => {
    // component starts async init() in constructor; flush to avoid pending microtasks
    flushMicrotasks();
    expect(component).toBeTruthy();
  }));
});
