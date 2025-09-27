import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  private mapAuthError(code?: string): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'Bitte eine gültige E-Mail-Adresse eingeben.';
      case 'auth/missing-password':
        return 'Bitte ein Passwort eingeben.';
      case 'auth/wrong-password':
        return 'Falsches Passwort.';
      case 'auth/user-not-found':
        return 'Kein Benutzer mit dieser E-Mail gefunden.';
      case 'auth/too-many-requests':
        return 'Zu viele Versuche. Bitte später erneut versuchen.';
      case 'auth/network-request-failed':
        return 'Netzwerkfehler. Prüfe deine Internetverbindung.';
      case 'auth/invalid-credential':
        return 'Anmeldedaten ungültig.';
      default:
        return 'Login fehlgeschlagen. Bitte erneut versuchen.';
    }
  }

  async doLogin(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    const email = this.email.trim();
    const password = this.password; // nicht trimmen, falls Leerzeichen absichtlich

    if (!email || !password) {
      this.errorMessage = 'Bitte E-Mail und Passwort eingeben.';
      this.isLoading = false;
      return;
    }

    try {
      await this.authService.login(email, password);
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (err: any) {
      this.errorMessage = this.mapAuthError(err?.code) + (err?.message ? ` (${err.message})` : '');
    } finally {
      this.isLoading = false;
    }
  }
}
