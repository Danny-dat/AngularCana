import { ComponentFixture, TestBed } from '@angular/core/testing';

// Korrekter Import: Die Klasse heißt 'CannaComponent' und kommt aus './canna.component'
import { CannaComponent } from './canna';

describe('CannaComponent', () => {
  // Alle Instanzen von 'Canna' wurden zu 'CannaComponent' geändert
  let component: CannaComponent;
  let fixture: ComponentFixture<CannaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CannaComponent] // Hier ebenfalls den korrekten Namen verwenden
    })
    .compileComponents();

    fixture = TestBed.createComponent(CannaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});