import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';

import { AdminDirectoryService, AdminUserRow } from '../services/admin-directory.service';

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
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.css'],
})
export class AdminUsers {
  private dir = inject(AdminDirectoryService);

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
}
