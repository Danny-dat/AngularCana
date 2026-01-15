import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

type AdminNavItem = {
  label: string;
  link: string;
  icon: string;
};

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    CommonModule,

    // Router
    RouterOutlet,
    RouterLink,
    RouterLinkActive,

    // Material
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage {
  // Sidebar state
  collapsed = this.loadCollapsed();

  // Sidebar navigation
  nav: AdminNavItem[] = [
    { label: 'Dashboard',  link: '/admin/dashboard',  icon: 'dashboard' },
    { label: 'Admins',     link: '/admin/admins',     icon: 'admin_panel_settings' },
    { label: 'Users',      link: '/admin/users',      icon: 'group' },
    { label: 'Reports',    link: '/admin/reports',    icon: 'description' },
    { label: 'Events',     link: '/admin/events',     icon: 'event' },
    { label: 'Promo',      link: '/admin/promo',      icon: 'local_offer' },
    { label: 'Statistics', link: '/admin/statistics', icon: 'insights' },
  ];

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.saveCollapsed(this.collapsed);
  }

  private loadCollapsed(): boolean {
    try {
      return localStorage.getItem('admin.sidebar.collapsed') === 'true';
    } catch {
      return false;
    }
  }

  private saveCollapsed(value: boolean): void {
    try {
      localStorage.setItem('admin.sidebar.collapsed', String(value));
    } catch {
      // ignore (z.B. private mode)
    }
  }
}
