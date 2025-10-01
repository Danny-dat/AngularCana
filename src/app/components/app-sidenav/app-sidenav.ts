import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';
import { Auth, user } from '@angular/fire/auth';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

type MenuItem = {
  label: string;
  icon: string;
  link?: string;
  dividerAfter?: boolean;
  adminOnly?: boolean;   // neu
  action?: 'logout';
};

// HIER deine Admin-UID(s) eintragen
const ADMIN_UIDS = new Set<string>([
  'ZAz0Bnde5zYIS8qCDT86aOvEDX52',
  // 'DEINE-ADMIN-UUID-2',
]);

@Component({
  selector: 'app-app-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatDividerModule, MatRippleModule],
  templateUrl: './app-sidenav.html',
  styleUrls: ['./app-sidenav.css'],
})
export class AppSidenav {
  private auth = inject(Auth);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  // true wenn aktuelle UID in ADMIN_UIDS
  isAdmin$: Observable<boolean> = user(this.auth).pipe(map(u => !!u && ADMIN_UIDS.has(u.uid)));

  readonly items: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', link: '/dashboard' },
    { label: 'Globaler Chat', icon: 'chat', link: '/chat' },
    { label: 'Freunde & Soziales', icon: 'group', link: '/social' },
    { label: 'Events', icon: 'event', link: '/events', dividerAfter: true },

    { label: 'Statistik', icon: 'bar_chart', link: '/stats' },
    { label: 'THC Rechner', icon: 'calculate', link: '/thc' },
    { label: 'Meine Daten', icon: 'person', link: '/me' },

    // nur für Admins sichtbar
    { label: 'Admin Bereich', icon: 'admin_panel_settings', link: '/admin', dividerAfter: true, adminOnly: true },

    { label: 'Datenschutz', icon: 'policy', link: '/privacy' },
    { label: 'AGB', icon: 'gavel', link: '/terms', dividerAfter: true },

    { label: 'Abmelden', icon: 'logout', action: 'logout' },
  ];

  close() { this.closed.emit(); }

  onItemClick(it: MenuItem, ev: MouseEvent) {
    if (it.action === 'logout') {
      ev.preventDefault();
      this.logout.emit();
      this.close();
    } else {
      this.close();
    }
  }
}
