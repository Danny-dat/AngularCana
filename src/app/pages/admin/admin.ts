import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';

type NavItem = { label: string; icon: string; link: string; };

@Component({
  selector: 'app-adminPage',
  standalone: true,
  imports: [
    RouterOutlet,         // <router-outlet>
    RouterLink,           // [routerLink]
    RouterLinkActive,     // routerLinkActive

    // Material
    MatSidenavModule, MatToolbarModule, MatIconModule,
    MatListModule, MatButtonModule, MatDividerModule, MatBadgeModule
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminPage {
  collapsed = false;
  nav: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',   link: 'dashboard' },
    { label: 'Users',      icon: 'group',       link: 'users' },
    { label: 'Reports',    icon: 'description', link: 'reports' },
    { label: 'Events',     icon: 'event',       link: 'events' },
    { label: 'Promo',      icon: 'local_offer', link: 'promo' },
    { label: 'Statistics', icon: 'insights',    link: 'statistics' },
  ];
}
