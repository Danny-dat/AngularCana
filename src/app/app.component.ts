import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Observable, of } from 'rxjs';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'cannatrack-angular';
  showMenu = false;
  
  // Wir erstellen einen Stream, der den aktuellen Nutzer enthält
  user$: Observable<User | null> = of(null);

  constructor(private authService: AuthService, private router: Router) {
    // Wir abonnieren den authState$ aus unserem Service
    this.user$ = this.authService.authState$;
  }

  async doLogout() {
    try {
      await this.authService.logout();
      this.showMenu = false;
      // Nach dem Logout zur Login-Seite navigieren
      this.router.navigate(['/login']);
    } catch (e) {
      console.error("Logout failed", e);
    }
  }
}