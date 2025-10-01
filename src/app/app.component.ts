import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { AppHeaderComponent } from "./components/app-header/app-header";
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, AppHeaderComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {
  showMenu = false;
  user$: Observable<User | null>;

  constructor(private authService: AuthService, private router: Router, private theme: ThemeService) {
    this.user$ = this.authService.authState$;
    this.theme.setTheme('light');
  }

  async doLogout() {
    await this.authService.logout();
    this.showMenu = false;
    this.router.navigate(['/login']);
  }
}