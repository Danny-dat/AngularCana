// src/app/app.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- Wichtig für *ngIf, async pipe etc.
import { Router, RouterModule } from '@angular/router'; // <-- Wichtig für routerLink und <router-outlet>
import { AuthService } from './services/auth.service';
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,   // <-- Importiert die Werkzeuge wie *ngIf
    RouterModule    // Importiert die Werkzeuge für die Navigation
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  // HIER deklarieren wir die fehlenden Eigenschaften
  showMenu = false;
  user$: Observable<User | null>;

  constructor(private authService: AuthService, private router: Router) {
    // Hier holen wir uns den Login-Status vom Service
    this.user$ = this.authService.authState$;
  }

  // HIER deklarieren wir die fehlende Logout-Funktion
  async doLogout(): Promise<void> {
    await this.authService.logout();
    this.showMenu = false;
    this.router.navigate(['/login']);
  }
}