import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserBootstrapService } from '../../services/user-bootstrap.service';
import { AdSlotComponent } from '../promo-slot/ad-slot.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdSlotComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  isLoading = false;

  errorMessage: string | null = null;
  infoMessage: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly bootstrap: UserBootstrapService
  ) {}

  // Beim Anzeigen des Login-Views: alten Username sofort ausblenden
  ngOnInit(): void {
    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username');
    } catch {}
  }

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
    this.infoMessage = null;
    this.cdr.markForCheck();

    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.errorMessage = 'Bitte E-Mail und Passwort eingeben.';
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    // Vor dem Versuch sicherstellen, dass nichts “durchblitzt”
    try {
      localStorage.removeItem('username');
    } catch {}

    try {
      const cred = await this.authService.login(email, password);

      // Geblockt: AuthService hat bereits logout + redirect + snackbar gemacht
      if (!cred) {
        return;
      }

      // Frischen Namen für Header/Nav setzen (falls du ihn nutzt)
      try {
        const display = cred.user.displayName ?? cred.user.email ?? 'User';
        localStorage.setItem('displayName', display);
      } catch {}

      // Neu: User-Daten + Settings beim Login einmalig ziehen (Theme, Sound, etc.)
      await this.bootstrap.bootstrapNow(cred.user.uid);

      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (err: unknown) {
      console.error('Login-Fehler:', err);

      const anyErr = err as {
        code?: string;
        message?: string;
        error?: { error?: { message?: string } };
      };
      const code = anyErr?.code || anyErr?.error?.error?.message;
      const msg = this.mapAuthError(code);

      this.errorMessage = msg;

      // bei Fehler sicherstellen, dass kein alter Name bleibt
      try {
        localStorage.removeItem('username');
      } catch {}

      this.cdr.markForCheck();
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async doResetPassword(): Promise<void> {
    this.errorMessage = null;
    this.infoMessage = null;

    const email = this.email.trim();

    if (!email) {
      this.errorMessage = 'Bitte zuerst deine E-Mail eingeben.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      await this.authService.resetPassword(email);

      // Neutral, um nicht zu leaken ob es den User gibt
      this.infoMessage =
        'Wenn ein Konto mit dieser E-Mail existiert, wurde eine Reset-Mail gesendet.';
    } catch (err: unknown) {
      const anyErr = err as { code?: string };
      const code = anyErr?.code;

      if (code === 'auth/invalid-email') {
        this.errorMessage = 'Bitte eine gültige E-Mail-Adresse eingeben.';
      } else if (code === 'auth/too-many-requests') {
        this.errorMessage = 'Zu viele Versuche. Bitte später erneut versuchen.';
      } else if (code === 'auth/network-request-failed') {
        this.errorMessage = 'Netzwerkfehler. Prüfe deine Internetverbindung.';
      } else {
        this.errorMessage = 'Konnte Reset-Mail nicht senden. Bitte erneut versuchen.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }
}
