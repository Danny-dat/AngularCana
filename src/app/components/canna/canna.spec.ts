import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Canna } from './canna';

describe('Canna', () => {
  let component: Canna;
  let fixture: ComponentFixture<Canna>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Canna]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Canna);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
