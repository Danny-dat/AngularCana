import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'] // Hier kannst du spezifische Styles für die Komponente hinzufügen
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private router: Router) { }

  async doLogin(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Bitte E-Mail und Passwort eingeben.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;

    try {
      await this.authService.login(this.email, this.password);
      // Nach erfolgreichem Login zum Dashboard navigieren
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage = 'Login fehlgeschlagen. Bitte prüfe deine Eingaben.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}