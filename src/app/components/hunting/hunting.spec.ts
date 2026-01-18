import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HuntingComponent} from './hunting';

describe('Hunting', () => {
  let component: HuntingComponent;
  let fixture: ComponentFixture<HuntingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HuntingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HuntingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
