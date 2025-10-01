import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.css'],
})
export class PrivacyComponent {
  lastUpdated = '01.10.2025'; // anpassen
  controller = {
    name: 'Highlights',
    address: 'Musterstraße 1, 12345 Musterstadt',
    email: 'privacy@highlights.example'
  };
}
