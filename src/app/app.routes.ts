import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { DashboardComponent } from './components/dashboard/dashboard';
import { authGuard } from './guards/auth-guard';

import { AppLayoutComponent } from './layouts/app-layout';
import { PublicLayoutComponent } from './layouts/public-layout';
import { adminGuard, adminMatchGuard } from './guards/admin.guard';

// Helper für Platzhalterseiten
const comingSoon = (title: string) => () =>
  import('@angular/core').then(({ Component }) => {
    @Component({
      standalone: true,
      template: `
        <div style="padding:16px">
          <h2 style="margin-top:0">{{ title }}</h2>
          <p>Diese Seite ist noch in Arbeit.</p>
        </div>
      `,
    })
    class ComingSoonComponent {
      title = title;
    }
    return ComingSoonComponent;
  });

export const routes: Routes = [
  // --- Öffentliches Layout: ohne Header ---
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent, data: { title: 'Login', hideHeader: true } },
      {
        path: 'register',
        component: RegisterComponent,
        data: { title: 'Registrieren', hideHeader: true },
      },
    ],
  },

  // --- App-Layout: mit Header ---
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [authGuard],
        data: { title: 'Dashboard' },
      },
      {
        path: 'chat',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/global-chat/global-chat').then((m) => m.GlobalChatPage),
        data: { title: 'Globaler Chat' },
      },
      {
        path: 'social',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/social/social.page').then((m) => m.SocialPage),
        data: { title: 'Freunde & Soziales' },
      },
      {
        path: 'events',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/events/events.component').then((m) => m.EventsComponent),
        data: { title: 'Events' },
      },
      {
        path: 'stats',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/statistics/statistics.component').then((m) => m.StatisticsComponent),
        data: { title: 'Statistik' },
      },
      {
        path: 'thc',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/thc/thc.component').then((m) => m.ThcComponent),
        data: { title: 'THC Rechner' },
      },
      {
        path: 'me',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./components/user-data/user-data').then((m) => m.UserDataComponent),
        data: { title: 'Meine Daten' },
      },

      // --- Admin-Bereich: nur mit Auth + Admin-UID ---
      {
        path: 'admin',
        canMatch: [adminMatchGuard], // verhindert schon das Matching
        canActivate: [authGuard, adminGuard], // doppelt sicher
        loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage),
        loadChildren: () =>import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES),
        data: { title: 'Admin Bereich' },
      },

      // Öffentlich, aber mit Header:
      {
        path: 'privacy',
        loadComponent: () =>
          import('./pages/privacy/privacy.component').then((m) => m.PrivacyComponent),
        data: { title: 'Datenschutz' },
      },
      {
        path: 'terms',
        loadComponent: () => import('./pages/terms/terms.component').then((m) => m.TermsComponent),
        data: { title: 'AGB' },
      },
    ],
  },

  // Fallbacks (404)
  { path: '**', redirectTo: 'login' },
];
