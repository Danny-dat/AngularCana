import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicProfilePageComponent } from './public-profile.page';

describe('PublicProfilePageComponent', () => {
  let fixture: ComponentFixture<PublicProfilePageComponent>;
  let component: PublicProfilePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicProfilePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicProfilePageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
