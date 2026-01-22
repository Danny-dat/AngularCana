/* istanbul ignore file */
import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'admins',
        loadComponent: () => import('./admins/admin-admins').then((m) => m.AdminAdminsComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/AdminDashboard').then((m) => m.AdminDashboardComponent),
      },
      { path: 'users', loadComponent: () => import('./users/users').then((m) => m.AdminUsers) },
      {
        path: 'users/:uid',
        loadComponent: () =>
          import('./users/user-detail/user-detail').then((m) => m.AdminUserDetailComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports').then((m) => m.AdminReports),
      },
      { path: 'events', loadComponent: () => import('./events/events').then((m) => m.AdminEvents) },
      { path: 'promo', loadComponent: () => import('./promo/promo').then((m) => m.AdminPromo) },
      {
        path: 'statistics',
        loadComponent: () => import('./statistics/statistics').then((m) => m.AdminStatistic),
      },
    ],
  },
];
