import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  imports: [
    RouterLink,
    MatCardModule, MatIconModule, MatButtonModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class AdminDashboardComponent {
  kpis = [
    { label: 'Users', value: '1,248', icon: 'group', link: '/admin/users' },
    { label: 'Reports', value: '12', icon: 'description', link: '/admin/reports' },
    { label: 'Events (live)', value: '3', icon: 'event', link: '/admin/events' },
    { label: 'Active Promos', value: '5', icon: 'local_offer', link: '/admin/promo' },
    { label: 'Conversion', value: '4.7%', icon: 'insights', link: '/admin/statistics' },
  ];
  quick = [
    { text: 'Neuen User anlegen', icon: 'person_add', link: '/admin/users' },
    { text: 'Report prüfen', icon: 'rule', link: '/admin/reports' },
    { text: 'Event erstellen', icon: 'add_circle', link: '/admin/events' },
    { text: 'Promo starten', icon: 'campaign', link: '/admin/promo' },
  ];
}
