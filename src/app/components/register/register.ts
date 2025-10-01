import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RegisterData, AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service'; // 👈 neu

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class RegisterComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private theme = inject(ThemeService);                  

  form: RegisterData = { email: '', password: '', displayName: '', phoneNumber: '' };
  isLoading = false;
  errorMessage: string | null = null;

  selectedTheme: 'light' | 'dark' | null = null;
  selectTheme(t: 'light' | 'dark') { this.selectedTheme = t; }

  async doRegister(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      // Auswahl persistieren – AuthService.register liest das und speichert in Firestore
      if (this.selectedTheme) {
        try { localStorage.setItem('pref-theme', this.selectedTheme); } catch {}
      }

      await this.authService.register(this.form);

      // sofort visuell setzen, damit das Dashboard direkt dunkel ist
      let t: 'light' | 'dark' = 'light';
      try {
        if (this.selectedTheme) {
          t = this.selectedTheme;
        } else {
          const local = (localStorage.getItem('pref-theme') || '').toLowerCase();
          if (local === 'dark' || local === 'light') t = local as any;
          else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
        }
      } catch {}
      this.theme.setTheme(t);

      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage = 'Registrierung fehlgeschlagen.';
    } finally {
      this.isLoading = false;
    }
  }
}
