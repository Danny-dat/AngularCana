import { ComponentFixture, TestBed } from '@angular/core/testing';


import { AdminEvents } from './events';


describe('AdminEvents', () => {
  let component: AdminEvents;
  let fixture: ComponentFixture<AdminEvents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    
      imports: [AdminEvents]
    })
    .compileComponents();

  
    fixture = TestBed.createComponent(AdminEvents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
