import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Für [(ngModel)]
import { Router, RouterModule } from '@angular/router'; // Für routerLink
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',  // <-- Korrigierter Pfad
  styleUrls: ['./login.css']   // <-- Korrigierter Pfad
})
export class LoginComponent {
  // Die Logik hier bleibt unverändert
  email = '';
  password = '';
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private router: Router) { }

  async doLogin(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/dashboard']); // Weiterleitung nach Erfolg
    } catch (error: any) {
      this.errorMessage = 'Login fehlgeschlagen. Bitte prüfe deine Eingaben.';
    } finally {
      this.isLoading = false;
    }
  }
}