/* istanbul ignore file */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type AddAdminDialogResult = { uid: string; note: string };

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
    <h2 mat-dialog-title>Admin hinzufügen</h2>

    <div mat-dialog-content class="content">
      <mat-form-field appearance="outline" class="full">
        <mat-label>UID</mat-label>
        <input matInput [formControl]="uidCtrl" placeholder="Firebase UID" />
        <mat-hint>Die UID findest du im User-Detail oder Firebase Auth.</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Notiz (optional)</mat-label>
        <input matInput [formControl]="noteCtrl" placeholder="z.B. softadmin" />
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="uidCtrl.invalid" (click)="submit()">
        Hinzufügen
      </button>
    </div>
  `,
  styles: [`
    .content { display: grid; gap: 12px; }
    .full { width: 100%; }
  `]
})
export class AddAdminDialogComponent {
  ref = inject(MatDialogRef<AddAdminDialogComponent, AddAdminDialogResult>);

  uidCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)]
  });

  noteCtrl = new FormControl('', { nonNullable: true });

  submit() {
    this.ref.close({
      uid: this.uidCtrl.value.trim(),
      note: this.noteCtrl.value.trim(),
    });
  }
}
