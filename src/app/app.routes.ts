import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';

export const routes: Routes = [
    // Routen-Definitionen, genau wie zuvor
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },

    // Standard-Route, die auf /login umleitet
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Wildcard-Route für ungültige URLs (optional, aber empfohlen)
    { path: '**', redirectTo: 'login' }
];