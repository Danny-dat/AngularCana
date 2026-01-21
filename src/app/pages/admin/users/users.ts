/* istanbul ignore file */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { combineLatest, Observable, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { FirebaseApp } from '@angular/fire/app';
import { Auth, user } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { AdminDirectoryService, AdminUserRow } from '../services/admin-directory.service';

type CreateUserDialogResult = {
  email: string;
  displayName: string;
  sendReset: boolean;
};

@Component({
  standalone: true,
  selector: 'app-admin-users',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.css'],
})
export class AdminUsers {
  private dir = inject(AdminDirectoryService);
  private app = inject(FirebaseApp);
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  displayedColumns: string[] = ['displayName', 'uid', 'role', 'status'];

  rows$: Observable<AdminUserRow[]> = combineLatest([
    this.dir.directory$,
    this.searchCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([rows, q]) => {
      const query = (q ?? '').trim().toLowerCase();
      if (!query) return rows;

      return rows.filter(
        (r) =>
          r.uid.toLowerCase().includes(query) ||
          r.displayName.toLowerCase().includes(query) ||
          (r.username ?? '').toLowerCase().includes(query)
      );
    })
  );

  constructor() {
    // Wenn man vom Dashboard kommt ("Neuen User anlegen"), direkt Dialog öffnen.
    void this.openCreateDialogIfRequested();
  }

  private async openCreateDialogIfRequested(): Promise<void> {
    const qp = await firstValueFrom(this.route.queryParamMap);
    if (qp.get('create') !== '1') return;

    // Param entfernen, damit der Dialog nicht bei jedem Refresh erneut aufpoppt
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    // Dialog öffnen
    await this.onCreateUser();
  }

  // =========================
  // Neuer User anlegen (Spark-safe)
  // =========================
  async onCreateUser() {
    const res = await firstValueFrom(this.dialog.open(CreateUserDialogComponent).afterClosed());
    if (!res) return;

    const email = res.email.trim().toLowerCase();
    const displayName = res.displayName.trim();

    try {
      const actorUid = await this.actorUid();

      const uid = await this.createAuthUserViaSecondaryApp({
        email,
        displayName,
      });

      // optional: Reset Mail, damit User sein Passwort setzt
      if (res.sendReset) {
        await sendPasswordResetEmail(this.auth, email);
      }

      // Audit Log (optional, passt zu deinen Rules)
      await addDoc(collection(this.firestore as any, 'audit_logs'), {
        timestamp: serverTimestamp(),
        action: 'CREATE_USER',
        targetUid: uid,
        actorUid,
        reason: '',
        meta: { email },
      });

      this.snack.open(`User erstellt: ${email}`, 'OK', { duration: 3500 });
    } catch {
      this.snack.open('User erstellen fehlgeschlagen (Email existiert / Rules?)', 'OK', {
        duration: 4500,
      });
    }
  }

  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }

  private async createAuthUserViaSecondaryApp(params: {
    email: string;
    displayName: string;
  }): Promise<string> {
    const secondary = initializeApp(this.app.options as any, `secondary-${Date.now()}`);
    const auth2 = getAuth(secondary);
    const fs2 = getFirestore(secondary);

    try {
      const password = this.randomPassword();
      const cred = await createUserWithEmailAndPassword(auth2, params.email, password);
      const uid = cred.user.uid;

      // UserDoc
      await setDoc(
        doc(fs2, 'users', uid),
        {
          email: params.email,

          // legacy / compatibility
          displayName: params.displayName,
          phoneNumber: null,

          // neues Profil-Objekt
          profile: {
            displayName: params.displayName,
            username: null,
            firstName: null,
            lastName: null,
            phoneNumber: null,
            photoURL: null,
            bio: null,
            website: null,
            location: { city: null, country: null },
            birthday: null,
            gender: 'unspecified',
            socials: { instagram: null, tiktok: null, youtube: null, discord: null, telegram: null },
            visibility: { showBio: true, showWebsite: true, showLocation: true, showSocials: true },
          },

          friends: [],
          settings: { consumptionThreshold: 3 },
          personalization: { theme: 'light' },

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Public Profile (optional)
      await setDoc(
        doc(fs2, 'profiles_public', uid),
        {
          displayName: params.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          username: null,
          photoURL: null,
          bio: null,
          website: null,
          locationText: null,
          socials: null,
        },
        { merge: true }
      );

      return uid;
    } finally {
      await signOut(auth2).catch(() => {});
      await deleteApp(secondary).catch(() => {});
    }
  }

  private randomPassword(): string {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const base = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    return `${base}!`;
  }
}

// =========================
// Dialog (inline, keine extra Datei nötig)
// =========================
@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>Neuen User anlegen</h2>

    <div mat-dialog-content style="display:grid; gap:12px;">
      <mat-form-field appearance="outline">
        <mat-label>E-Mail</mat-label>
        <input matInput [formControl]="emailCtrl" placeholder="user@mail.de" />
      </mat-form-field>

      <mat-form-field appearance="outline">
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
      email: this.emailCtrl.value,
      displayName: this.nameCtrl.value,
      sendReset: this.resetCtrl.value,
    });
  }
}
