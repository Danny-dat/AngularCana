import { Component, ChangeDetectorRef } from '@angular/core';
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

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef  // <— wichtig für Zoneless/Edge-Cases
  ) {}

  private mapAuthError(code?: string): string {
    switch (code) {
      case 'auth/invalid-email': return 'Bitte eine gültige E-Mail-Adresse eingeben.';
      case 'auth/missing-password': return 'Bitte ein Passwort eingeben.';
      case 'auth/wrong-password': return 'Falsches Passwort.';
      case 'auth/user-not-found': return 'Kein Benutzer mit dieser E-Mail gefunden.';
      case 'auth/too-many-requests': return 'Zu viele Versuche. Bitte später erneut versuchen.';
      case 'auth/network-request-failed': return 'Netzwerkfehler. Prüfe deine Internetverbindung.';
      case 'auth/invalid-credential': return 'Anmeldedaten ungültig.';
      default: return 'Login fehlgeschlagen. Bitte erneut versuchen.';
    }
  }

  async doLogin(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const email = this.email.trim();
    const password = this.password; // Passwort nicht trimmen

    if (!email || !password) {
      this.errorMessage = 'Bitte E-Mail und Passwort eingeben.';
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      await this.authService.login(email, password);
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (err: any) {
      console.error('Login-Fehler:', err);
      // Fallback: Falls mal kein .code da ist, nehmen wir message/JSON
      const code = err?.code || err?.error?.error?.message;
      const msg = this.mapAuthError(code);
      this.errorMessage = err?.message ? `${msg} (${err.message})` : msg;
      this.cdr.markForCheck();
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }
}
