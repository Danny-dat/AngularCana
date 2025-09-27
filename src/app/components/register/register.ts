import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterData } from '../../services/auth.service'; // <-- Korrekter Import

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  form: RegisterData = { email: '', password: '', displayName: '', phoneNumber: '' };
  isLoading = false; errorMessage: string | null = null;
  constructor(private authService: AuthService, private router: Router) { }
  async doRegister(): Promise<void> {
    this.isLoading = true; this.errorMessage = null;
    try {
      await this.authService.register(this.form);
      this.router.navigate(['/dashboard']);
    } catch (error) { this.errorMessage = 'Registrierung fehlgeschlagen.'; }
    finally { this.isLoading = false; }
  }
}