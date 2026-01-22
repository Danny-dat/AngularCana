import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicProfilePage } from './public-profile.page';

describe('PublicProfilePage', () => {
  let fixture: ComponentFixture<PublicProfilePage>;
  let component: PublicProfilePage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicProfilePage],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicProfilePage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
