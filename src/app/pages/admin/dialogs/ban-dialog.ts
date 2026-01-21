/* istanbul ignore file */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

export type BanDialogResult = { reason: string; until: Date | null };

@Component({
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>User bannen</h2>

    <div mat-dialog-content class="content">
      <!-- Grund: Label außerhalb -> wird nie abgeschnitten -->
      <div class="field">
        <div class="field-label">Grund</div>
        <mat-form-field appearance="outline" class="full">
          <input matInput [formControl]="reasonCtrl" aria-label="Grund" />
        </mat-form-field>
      </div>

      <!-- Bis: Datepicker -->
      <mat-form-field
        appearance="outline"
        class="full"
        floatLabel="always"
        subscriptSizing="dynamic"
      >
        <mat-label>Bis (optional)</mat-label>

        <input
          matInput
          [matDatepicker]="picker"
          [formControl]="untilCtrl"
          autocomplete="off"
        />

        <!-- eigener Button: zuverlässig klickbar -->
        <button
          mat-icon-button
          matSuffix
          type="button"
          aria-label="Datum wählen"
          (click)="$event.stopPropagation(); picker.open()"
        >
          <mat-icon>calendar_month</mat-icon>
        </button>

        <mat-hint>Leer lassen = permanent</mat-hint>

        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button
        mat-flat-button
        color="warn"
        [disabled]="reasonCtrl.invalid"
        (click)="submit()"
      >
        Bann setzen
      </button>
    </div>
  `,
  styles: [`
    :host{
      display:block;
      width: 360px;
      max-width: 92vw;
    }

    .content{
      display:grid;
      gap:14px;
      padding-top: 8px;
    }

    .full{ width:100%; }

    .field { display: grid; gap: 6px; }
    .field-label {
      font-size: 12px;
      opacity: .75;
      margin-left: 4px;
    }
  `],
})
export class BanDialogComponent {
  ref = inject(MatDialogRef<BanDialogComponent, BanDialogResult>);

  reasonCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  untilCtrl = new FormControl<Date | null>(null);

  submit() {
    this.ref.close({
      reason: this.reasonCtrl.value.trim(),
      until: this.untilCtrl.value ?? null,
    });
  }
}
