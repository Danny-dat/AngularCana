/* istanbul ignore file */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { PromoSlotEditorComponent } from './promo-slot-editor';

@Component({
  standalone: true,
  selector: 'app-AdminPromo',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    PromoSlotEditorComponent,
  ],
  templateUrl: './promo.html',
  styleUrl: './promo.css'
})
export class AdminPromo {

  readonly slots = [
    {
      id: 'dashboard-werbung1',
      title: 'Dashboard Banner',
      subtitle: 'Wird im Dashboard angezeigt (wide).',
    },
    {
      id: 'login-werbung1',
      title: 'Login Banner',
      subtitle: 'Wird auf der Login-Seite angezeigt.',
    },
    {
      id: 'thc-werbung1',
      title: 'THC Seite Banner',
      subtitle: 'Wird in der THC-Seite angezeigt (compact).',
    },
  ] as const;
}
