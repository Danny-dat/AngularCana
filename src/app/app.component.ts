import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- Wichtig für *ngIf, async pipe etc.
import { Router, RouterModule } from '@angular/router'; // <-- Wichtig für routerLink und <router-outlet>
import { AuthService } from './services/auth.service';
import { Observable, of } from 'rxjs';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  standalone: true, // <-- Markiert die Komponente als "standalone"
  imports: [
    CommonModule, // Stellt *ngIf, *ngFor, async pipe etc. bereit
    RouterModule  // Stellt routerLink und <router-outlet> bereit
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showMenu = false;
  user$: Observable<User | null>;

  constructor(private authService: AuthService, private router: Router) {
    this.user$ = this.authService.authState$;
  }

  async doLogout() {
    await this.authService.logout();
    this.showMenu = false;
    this.router.navigate(['/login']);
  }
}