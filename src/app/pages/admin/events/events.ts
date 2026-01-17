import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { combineLatest, Observable, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Timestamp } from 'firebase/firestore';

import { EventsService, EventItem } from '../../../services/events.service';
import {
  EventSuggestionsService,
  EventSuggestionRow,
  SuggestionStatus,
} from '../../../services/event-suggestions.service';

type EventFormValue = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

@Component({
  standalone: true,
  selector: 'app-AdminEvents',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './events.html',
  styleUrl: './events.css',
})
export class AdminEvents {
  private eventsSvc = inject(EventsService);
  private suggestSvc = inject(EventSuggestionsService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  // Search
  searchEventsCtrl = new FormControl<string>('', { nonNullable: true });
  searchSuggestCtrl = new FormControl<string>('', { nonNullable: true });

  // Tables
  displayedEvents: string[] = ['name', 'address', 'coords', 'votes', 'actions'];
  displayedSuggestions: string[] = ['createdAt', 'startAt', 'name', 'createdBy', 'status', 'actions'];

  // Data
  private events$ = this.eventsSvc.listen();
  private suggestions$ = this.suggestSvc.listenAll();

  eventsFiltered$: Observable<EventItem[]> = combineLatest([
    this.events$,
    this.searchEventsCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([rows, q]) => {
      const query = (q ?? '').trim().toLowerCase();
      if (!query) return rows;
      return rows.filter(
        (e) =>
          (e.name ?? '').toLowerCase().includes(query) ||
          (e.address ?? '').toLowerCase().includes(query) ||
          `${e.lat},${e.lng}`.includes(query)
      );
    })
  );

  suggestionsFiltered$: Observable<EventSuggestionRow[]> = combineLatest([
    this.suggestions$,
    this.searchSuggestCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([rows, q]) => {
      const query = (q ?? '').trim().toLowerCase();
      const base = (rows || []).slice();
      const res = query
        ? base.filter(
            (s) =>
              (s.name ?? '').toLowerCase().includes(query) ||
              (s.address ?? '').toLowerCase().includes(query) ||
              (s.createdByName ?? '').toLowerCase().includes(query) ||
              (s.createdBy ?? '').toLowerCase().includes(query)
          )
        : base;
      return res;
    })
  );

  asDate(x: any): Date {
    if (!x) return new Date(0);
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    return new Date(String(x));
  }

  // ─────────────────────────────────────────────
  // Events CRUD
  // ─────────────────────────────────────────────

  async onCreateEvent() {
    const res = await firstValueFrom(
      this.dialog.open(EventEditDialogComponent, {
        data: { mode: 'create' as const },
      }).afterClosed()
    );
    if (!res) return;

    try {
      await this.eventsSvc.createEvent(res);
      this.snack.open('Event erstellt', 'OK', { duration: 2500 });
    } catch (e) {
      console.error(e);
      this.snack.open('Event erstellen fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async onEditEvent(e: EventItem) {
    const res = await firstValueFrom(
      this.dialog.open(EventEditDialogComponent, {
        data: {
          mode: 'edit' as const,
          event: {
            id: e.id,
            name: e.name,
            address: e.address ?? '',
            lat: e.lat,
            lng: e.lng,
          },
        },
      }).afterClosed()
    );
    if (!res) return;

    try {
      await this.eventsSvc.updateEvent(e.id, {
        name: res.name,
        address: res.address,
        lat: res.lat,
        lng: res.lng,
      } as any);
      this.snack.open('Event aktualisiert', 'OK', { duration: 2500 });
    } catch (err) {
      console.error(err);
      this.snack.open('Update fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async onDeleteEvent(e: EventItem) {
    const ok = confirm(`Event wirklich löschen?\n\n${e.name}`);
    if (!ok) return;
    try {
      await this.eventsSvc.deleteEvent(e.id);
      this.snack.open('Event gelöscht', 'OK', { duration: 2500 });
    } catch (err) {
      console.error(err);
      this.snack.open('Löschen fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  // ─────────────────────────────────────────────
  // Suggestions
  // ─────────────────────────────────────────────

  openChatWith(uid: string) {
    if (!uid) return;
    this.router.navigate(['/social'], { queryParams: { openChatWith: uid } });
  }

  async setSuggestionStatus(s: EventSuggestionRow, status: SuggestionStatus) {
    try {
      await this.suggestSvc.setStatus(s.id, status);
      this.snack.open(`Vorschlag: ${status}`, 'OK', { duration: 2200 });
    } catch (e) {
      console.error(e);
      this.snack.open('Status-Update fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async acceptSuggestionAsEvent(s: EventSuggestionRow) {
    const ok = confirm(
      `Vorschlag als Event übernehmen?\n\n${s.name}\n${s.address ?? ''}`
    );
    if (!ok) return;

    try {
      const id = await this.eventsSvc.createEvent({
        name: s.name,
        address: s.address ?? null,
        lat: Number(s.lat),
        lng: Number(s.lng),
        startAt: s.startAt ?? null,
        sourceSuggestionId: s.id,
      });
      await this.suggestSvc.setStatus(s.id, 'accepted', { eventId: id } as any);
      this.snack.open('Als Event übernommen', 'OK', { duration: 2500 });
    } catch (e) {
      console.error(e);
      this.snack.open(
        'Übernehmen fehlgeschlagen (Koordinaten fehlen / Rules?)',
        'OK',
        { duration: 4500 }
      );
    }
  }
}

// ─────────────────────────────────────────────
// Dialog: Create/Edit Event
// ─────────────────────────────────────────────

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data?.mode === 'edit' ? 'Event bearbeiten' : 'Neues Event' }}
    </h2>

    <div mat-dialog-content style="display:grid; gap:12px;">
      <mat-form-field appearance="outline">
        <mat-label>Name *</mat-label>
        <input matInput [formControl]="form.controls.name" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Adresse</mat-label>
        <input matInput [formControl]="form.controls.address" />
      </mat-form-field>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <mat-form-field appearance="outline">
          <mat-label>Lat *</mat-label>
          <input matInput type="number" inputmode="decimal" [formControl]="form.controls.lat" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Lng *</mat-label>
          <input matInput type="number" inputmode="decimal" [formControl]="form.controls.lng" />
        </mat-form-field>
      </div>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        Speichern
      </button>
    </div>
  `,
})
export class EventEditDialogComponent {
  ref = inject(MatDialogRef<EventEditDialogComponent, EventFormValue>);

  form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl<string>('', { nonNullable: true }),
    lat: new FormControl<number | null>(null, { validators: [Validators.required] }),
    lng: new FormControl<number | null>(null, { validators: [Validators.required] }),
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    if (data?.event) {
      this.form.patchValue({
        name: data.event.name ?? '',
        address: data.event.address ?? '',
        lat: data.event.lat ?? null,
        lng: data.event.lng ?? null,
      });
    }
  }

  submit() {
    const v = this.form.getRawValue();
    this.ref.close({
      name: (v.name ?? '').trim(),
      address: (v.address ?? '').trim(),
      lat: Number(v.lat),
      lng: Number(v.lng),
    });
  }
}
