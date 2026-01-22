import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDirectoryService } from './admin-directory.service';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';


describe('AdminDirectoryService', () => {

  beforeEach(() => {
    let component: AdminDirectoryService;

    let fixture: ComponentFixture<AdminDirectoryService>;
    
    TestBed.configureTestingModule({
      imports: [AdminDirectoryService],
      providers: [
        { provide: Auth, useValue: {} as any },
        { provide: Firestore, useValue: {} as any },
      ],
    }).compileComponents();
        fixture = TestBed.createComponent(AdminDirectoryService);
        component = fixture.componentInstance;
      });

  
  it('should be created', () => {
    const service = TestBed.inject(AdminDirectoryService);
    expect(service).toBeTruthy();
  });
});
