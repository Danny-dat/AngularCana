import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, RegisterData } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  form: RegisterData = {
    email: '',
    password: '',
    displayName: '',
    phoneNumber: ''
  };
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private router: Router) { }

  async doRegister(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      await this.authService.register(this.form);
      // Nach erfolgreicher Registrierung zum Dashboard navigieren
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage = 'Registrierung fehlgeschlagen. Bitte versuche es erneut.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}