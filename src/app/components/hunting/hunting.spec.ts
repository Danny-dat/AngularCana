import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Hunting} from './hunting';

describe('Hunting', () => {
  let component: Hunting;
  let fixture: ComponentFixture<Hunting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hunting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Hunting);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
