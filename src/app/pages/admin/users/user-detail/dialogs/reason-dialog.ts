import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type ReasonDialogData = {
  title: string;
  hint?: string;
  required?: boolean; // default true
  confirmText: string;
};

export type ReasonDialogResult = { reason: string };

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <div mat-dialog-content class="content">
      @if (data.hint) {
        <p class="hint">{{ data.hint }}</p>
      }

      <mat-form-field appearance="outline" class="full">
        <mat-label>Grund</mat-label>
        <input matInput [formControl]="reasonCtrl" />
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button
        mat-flat-button
        color="warn"
        [disabled]="(data.required ?? true) && reasonCtrl.invalid"
        (click)="submit()"
      >
        {{ data.confirmText }}
      </button>
    </div>
  `,
  styles: [`
    .full{width:100%}
    .content{display:grid;gap:12px}
    .hint{opacity:.75;margin:0}
  `]
})
export class ReasonDialogComponent {
  data = inject<ReasonDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<ReasonDialogComponent, ReasonDialogResult>);

  reasonCtrl = new FormControl('', {
    nonNullable: true,
    validators: (this.data.required ?? true) ? [Validators.required, Validators.minLength(3)] : []
  });

  submit() {
    this.ref.close({ reason: this.reasonCtrl.value.trim() });
  }
}
