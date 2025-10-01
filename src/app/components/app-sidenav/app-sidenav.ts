import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';
import { Auth, user } from '@angular/fire/auth';
import { map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';

type Section = 1 | 2 | 3 | 4;
type MenuItem = {
  label: string;
  icon: string;
  link?: string;
  adminOnly?: boolean;
  section: Section;
  action?: 'logout';
};

const ADMIN_UIDS = new Set<string>(['ZAz0Bnde5zYIS8qCDT86aOvEDX52']);

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

  /** admin? – sofort mit false starten, damit UI direkt rendert */
  isAdmin$: Observable<boolean> = user(this.auth).pipe(
    map(u => !!u && ADMIN_UIDS.has(u.uid)),
    startWith(false)
  );

  /** Basisliste in Sektionen */
  private readonly baseItems: MenuItem[] = [
    { label: 'Dashboard',        icon: 'dashboard',            link: '/dashboard', section: 1 },
    { label: 'Globaler Chat',    icon: 'chat',                 link: '/chat',      section: 1 },
    { label: 'Freunde & Soziales', icon: 'group',              link: '/social',    section: 1 },
    { label: 'Events',           icon: 'event',                link: '/events',    section: 1 },

    { label: 'Statistik',        icon: 'bar_chart',            link: '/stats',     section: 2 },
    { label: 'THC Rechner',      icon: 'calculate',            link: '/thc',       section: 2 },
    { label: 'Meine Daten',      icon: 'person',               link: '/me',        section: 2 },
    { label: 'Admin Bereich',    icon: 'admin_panel_settings', link: '/admin',     section: 2, adminOnly: true },

    { label: 'Datenschutz',      icon: 'policy',               link: '/privacy',   section: 3 },
    { label: 'AGB',              icon: 'gavel',                link: '/terms',     section: 3 },

    { label: 'Abmelden',         icon: 'logout',               action: 'logout',   section: 4 },
  ];

  /** sichtbare Items + Divider automatisch setzen */
  visibleItems$: Observable<(MenuItem & { dividerAfter: boolean })[]> = this.isAdmin$.pipe(
    map(isAdmin => {
      const filtered = this.baseItems.filter(it => !it.adminOnly || isAdmin);
      return filtered.map((it, i) => {
        const next = filtered[i + 1];
        const dividerAfter = !!next && next.section !== it.section;
        return { ...it, dividerAfter };
      });
    })
  );

  close() { this.closed.emit(); }
  onItemClick(it: MenuItem, ev: MouseEvent) {
    if (it.action === 'logout') {
      ev.preventDefault();
      this.logout.emit();
    }
    this.close();
  }
}
