import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

export type BanDialogResult = { reason: string; until: Date | null };

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>User bannen</h2>

    <div mat-dialog-content class="content">
      <mat-form-field appearance="outline" class="full">
        <mat-label>Grund</mat-label>
        <input matInput [formControl]="reasonCtrl" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Bis (optional – leer = permanent)</mat-label>
        <input matInput [matDatepicker]="picker" [formControl]="untilCtrl" />
        <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="warn" [disabled]="reasonCtrl.invalid" (click)="submit()">
        Bann setzen
      </button>
    </div>
  `,
  styles: [`
    .full{width:100%}
    .content{display:grid;gap:12px}
  `]
})
export class BanDialogComponent {
  ref = inject(MatDialogRef<BanDialogComponent, BanDialogResult>);

  reasonCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)]
  });

  untilCtrl = new FormControl<Date | null>(null);

  submit() {
    this.ref.close({
      reason: this.reasonCtrl.value.trim(),
      until: this.untilCtrl.value ?? null
    });
  }
}
