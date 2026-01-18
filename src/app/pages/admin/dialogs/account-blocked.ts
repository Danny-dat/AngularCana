/* istanbul ignore file */
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  imports: [RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div style="display:grid; place-items:center; padding:24px;">
      <mat-card style="max-width:560px; width:100%; padding:18px;">
        <h2 style="display:flex; gap:8px; align-items:center; margin:0 0 12px 0;">
          <mat-icon>block</mat-icon>
          Zugriff gesperrt
        </h2>

        <p style="margin:0 0 14px 0;">
          Dein Account ist aktuell <b>gesperrt</b>, <b>gebannt</b> oder <b>deaktiviert</b>.
        </p>

        <p style="margin:0 0 18px 0; opacity:.8;">
          Wenn du denkst, das ist ein Fehler, kontaktiere bitte den Support / Admin.
        </p>

        <div style="display:flex; gap:10px;">
          <button mat-stroked-button routerLink="/login">
            <mat-icon>login</mat-icon>
            Zum Login
          </button>

          <button mat-flat-button color="primary" routerLink="/">
            Startseite
          </button>
        </div>
      </mat-card>
    </div>
  `
})
export class AccountBlockedComponent {}
