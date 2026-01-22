import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';

export type CreateUserDialogResult = {
  email: string;
  displayName: string;
  sendReset: boolean;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>Neuen User anlegen</h2>

    <div mat-dialog-content class="content">
      <mat-form-field appearance="outline" class="full">
        <mat-label>E-Mail</mat-label>
        <input matInput [formControl]="emailCtrl" placeholder="user@mail.de" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Display Name (optional)</mat-label>
        <input matInput [formControl]="nameCtrl" placeholder="z.B. Max Mustermann" />
      </mat-form-field>

      <mat-checkbox [formControl]="resetCtrl">
        Passwort-Reset-Mail senden (empfohlen)
      </mat-checkbox>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="emailCtrl.invalid" (click)="submit()">
        Anlegen
      </button>
    </div>
  `,
  styles: [
    `
      .content {
        display: grid;
        gap: 12px;
      }
      .full {
        width: 100%;
      }
    `,
  ],
})
export class CreateUserDialogComponent {
  ref = inject(MatDialogRef<CreateUserDialogComponent, CreateUserDialogResult>);

  emailCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  nameCtrl = new FormControl('', { nonNullable: true });
  resetCtrl = new FormControl(true, { nonNullable: true });

  submit() {
    this.ref.close({
      email: this.emailCtrl.value.trim(),
      displayName: this.nameCtrl.value.trim(),
      sendReset: this.resetCtrl.value,
    });
  }
}
