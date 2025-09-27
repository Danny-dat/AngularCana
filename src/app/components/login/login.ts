import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service'; // <-- Korrekter Import

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  email = ''; password = ''; isLoading = false; errorMessage: string | null = null;
  constructor(private authService: AuthService, private router: Router) { }
 
  async doLogin(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (error) { this.errorMessage = 'Login fehlgeschlagen.'; }
    finally { this.isLoading = false; }
  }
}