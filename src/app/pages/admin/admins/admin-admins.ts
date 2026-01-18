/* istanbul ignore file */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, user } from '@angular/fire/auth';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { AdminAdminsService, AdminRow } from '../services/admin-admins.service';
import { AddAdminDialogComponent } from '../dialogs/add-admin-dialog';

@Component({
  standalone: true,
  selector: 'app-admin-admins',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './admin-admins.html',
  styleUrls: ['./admin-admins.css'],
})
export class AdminAdminsComponent {
  private adminsService = inject(AdminAdminsService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private auth = inject(Auth);

  private readonly OWNER_UID = 'ZAz0Bnde5zYIS8qCDT86aOvEDX52';

  rows$: Observable<(AdminRow & { isOwner: boolean })[]> = this.adminsService
    .admins$()
    .pipe(
      map((rows) =>
        [...rows]
          .map((r) => ({ ...r, isOwner: r.uid === this.OWNER_UID }))
          .sort((a, b) =>
            a.isOwner === b.isOwner ? a.uid.localeCompare(b.uid) : a.isOwner ? -1 : 1
          )
      )
    );

  private ok(msg: string) {
    this.snack.open(msg, 'OK', { duration: 2500 });
  }
  private fail(msg: string) {
    this.snack.open(msg, 'OK', { duration: 3500 });
  }

  private async actorUid(): Promise<string> {
    const u = await firstValueFrom(user(this.auth));
    if (!u) throw new Error('Not logged in');
    return u.uid;
  }

  async addAdmin() {
    const res = await firstValueFrom(this.dialog.open(AddAdminDialogComponent).afterClosed());
    if (!res) return;

    try {
      await this.adminsService.addAdmin({
        uid: res.uid,
        createdBy: await this.actorUid(),
        note: res.note,
      });
      this.ok('Admin hinzugefügt');
    } catch {
      this.fail('Konnte Admin nicht hinzufügen (Rules/Permissions?)');
    }
  }

  async removeAdmin(uid: string) {
    if (uid === this.OWNER_UID) {
      this.fail('Owner kann nicht entfernt werden');
      return;
    }

    try {
      await this.adminsService.removeAdmin(uid);
      this.ok('Admin entfernt');
    } catch {
      this.fail('Konnte Admin nicht entfernen (Rules/Permissions?)');
    }
  }
}
