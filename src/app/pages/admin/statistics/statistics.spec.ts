import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminStatistic } from './statistics';

describe('Statistics', () => {
  let component: AdminStatistic;
  let fixture: ComponentFixture<AdminStatistic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStatistic]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminStatistic);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
