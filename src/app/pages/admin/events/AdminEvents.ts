/* istanbul ignore file */
import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { combineLatest, Observable, firstValueFrom, timer } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';

import { Timestamp } from '@angular/fire/firestore';

import { EventsService, EventItem } from '../../../services/events.service';
import {
  EventSuggestionsService,
  EventSuggestionRow,
  SuggestionStatus,
} from '../../../services/event-suggestions.service';
import { GeocodingService, GeocodeResult } from '../../../services/geocoding.service';

type EventFormValue = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  status?: 'active' | 'inactive';
  startAt?: Date | null;
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
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSelectModule,
  ],
  templateUrl: './AdminEvents.html',
  styleUrl: './AdminEvents.css',
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
  displayedEvents: string[] = ['name', 'startAt', 'address', 'coords', 'votes', 'actions'];
  displayedSuggestions: string[] = ['createdAt', 'startAt', 'name', 'createdBy', 'status', 'actions'];

  // Data
  private events$ = this.eventsSvc.listen();

  /** Triggert die automatische Umsortierung (Aktiv/Nicht aktiv) ohne Firestore-Writes */
  private now$ = timer(0, 60_000).pipe(map(() => Date.now()));

  // Suggestions: split streams so tabs stay snappy and lists don't grow without bounds
  private sOpen$ = this.suggestSvc.listenByStatus('open', 200);
  private sAccepted$ = this.suggestSvc.listenByStatus('accepted', 200);
  private sResolved$ = this.suggestSvc.listenByStatus('resolved', 200);
  private sRejected$ = this.suggestSvc.listenByStatus('rejected', 200);

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

  /** Admin: Events in Tabs (Aktiv / Nicht aktiv) */
  eventsActive$: Observable<EventItem[]> = combineLatest([
    this.eventsFiltered$,
    this.now$,
  ]).pipe(
    map(([rows, nowMs]) =>
      (rows || [])
        .filter((e) => this.isEventActiveAdmin(e, nowMs))
        .slice()
        // aktiv: bald zuerst (Events ohne Datum nach hinten)
        .sort((a, b) => this.startKeyMs(a) - this.startKeyMs(b))
    )
  );

  eventsInactive$: Observable<EventItem[]> = combineLatest([
    this.eventsFiltered$,
    this.now$,
  ]).pipe(
    map(([rows, nowMs]) =>
      (rows || [])
        .filter((e) => !this.isEventActiveAdmin(e, nowMs))
        .slice()
        // inaktiv: zuletzt zuerst
        .sort((a, b) => this.startKeyMs(b) - this.startKeyMs(a))
    )
  );

  private filterSuggestions(rows: EventSuggestionRow[], q: string): EventSuggestionRow[] {
    const query = (q ?? '').trim().toLowerCase();
    const base = (rows || []).slice();
    if (!query) return base;
    return base.filter(
      (s) =>
        (s.name ?? '').toLowerCase().includes(query) ||
        (s.address ?? '').toLowerCase().includes(query) ||
        (s.createdByName ?? '').toLowerCase().includes(query) ||
        (s.createdBy ?? '').toLowerCase().includes(query)
    );
  }

  suggestionsOpen$: Observable<EventSuggestionRow[]> = combineLatest([
    this.sOpen$,
    this.searchSuggestCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(map(([rows, q]) => this.filterSuggestions(rows, q)));

  suggestionsAccepted$: Observable<EventSuggestionRow[]> = combineLatest([
    this.sAccepted$,
    this.searchSuggestCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(map(([rows, q]) => this.filterSuggestions(rows, q)));

  suggestionsResolved$: Observable<EventSuggestionRow[]> = combineLatest([
    this.sResolved$,
    this.searchSuggestCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(map(([rows, q]) => this.filterSuggestions(rows, q)));

  suggestionsRejected$: Observable<EventSuggestionRow[]> = combineLatest([
    this.sRejected$,
    this.searchSuggestCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(map(([rows, q]) => this.filterSuggestions(rows, q)));

  asDate(x: any): Date {
    if (!x) return new Date(0);
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    return new Date(String(x));
  }

  private startKeyMs(e: any): number {
    const d = this.asMaybeDate(e?.startAt);
    return d ? d.getTime() : Number.POSITIVE_INFINITY;
  }

  private asMaybeDate(x: any): Date | null {
    if (!x) return null;
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    const d = new Date(String(x));
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Admin-Logik:
   * - manuell deaktiviert (status === 'inactive') bleibt immer nicht aktiv
   * - sonst automatisch: wenn startAt in der Vergangenheit => nicht aktiv
   * - ohne startAt => aktiv
   */
  isEventActiveAdmin(e: EventItem, nowMs: number): boolean {
    const status = String((e as any)?.status ?? 'active');
    if (status === 'inactive') return false;

    const d = this.asMaybeDate((e as any)?.startAt);
    if (!d) return true;

    return d.getTime() > nowMs;
  }

  async setEventActive(e: EventItem, active: boolean) {
    try {
      await this.eventsSvc.updateEvent(e.id, { status: active ? 'active' : 'inactive' } as any);
      this.snack.open(active ? 'Event ist wieder aktiv' : 'Event wurde deaktiviert', 'OK', { duration: 2200 });
    } catch (err) {
      console.error(err);
      this.snack.open('Status-Update fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
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
            status: (e as any).status ?? 'active',
            startAt: (e as any).startAt ?? null,
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
        status: res.status ?? (e as any).status ?? 'active',
        startAt: res.startAt ?? null,
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

  async onEditSuggestion(s: EventSuggestionRow) {
    const patch = await firstValueFrom(
      this.dialog
        .open(SuggestionEditDialogComponent, {
          data: { suggestion: s },
          maxWidth: '720px',
          width: '100%',
        })
        .afterClosed()
    );
    if (!patch) return;

    try {
      await this.suggestSvc.updateSuggestion(s.id, patch);
      this.snack.open('Vorschlag gespeichert', 'OK', { duration: 2200 });
    } catch (e) {
      console.error(e);
      this.snack.open('Speichern fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
    }
  }

  async onDeleteSuggestion(s: EventSuggestionRow) {
    const ok = confirm(`Vorschlag wirklich löschen?\n\n${s.name}`);
    if (!ok) return;
    try {
      await this.suggestSvc.deleteSuggestion(s.id);
      this.snack.open('Vorschlag gelöscht', 'OK', { duration: 2200 });
    } catch (e) {
      console.error(e);
      this.snack.open('Löschen fehlgeschlagen (Rules?)', 'OK', { duration: 4000 });
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
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data?.mode === 'edit' ? 'Event bearbeiten' : 'Neues Event' }}
    </h2>

    <div mat-dialog-content style="display:grid; gap:12px;">
      <div style="display:grid; grid-template-columns:1fr 180px; gap:12px; align-items:start;">
        <mat-form-field appearance="outline">
          <mat-label>Name *</mat-label>
          <input matInput [formControl]="form.controls.name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [formControl]="form.controls.status">
            <mat-option value="active">aktiv</mat-option>
            <mat-option value="inactive">nicht aktiv</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <mat-form-field appearance="outline">
          <mat-label>Datum</mat-label>
          <input matInput [matDatepicker]="picker" [formControl]="form.controls.date" />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Uhrzeit</mat-label>
          <input matInput type="time" [formControl]="form.controls.time" />
        </mat-form-field>
      </div>

      <div style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start;">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Adresse *</mat-label>
          <input
            matInput
            placeholder="Musterstraße 1, 12345 Musterstadt"
            [formControl]="form.controls.address"
          />
          <mat-hint>Du kannst die Adresse komplett eintippen oder unten aus Straße/PLZ/Stadt zusammensetzen.</mat-hint>
        </mat-form-field>

        <button
          mat-stroked-button
          type="button"
          (click)="checkAddress()"
          [disabled]="geoBusy || !canCheckAddress()"
        >
          <mat-icon>search</mat-icon>
          Adresse prüfen
        </button>
      </div>

      @if (data?.mode !== 'edit') {
        <div style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
          <button mat-button type="button" (click)="splitAddress = !splitAddress">
            <mat-icon>{{ splitAddress ? 'expand_less' : 'expand_more' }}</mat-icon>
            Straße/PLZ/Stadt {{ splitAddress ? 'ausblenden' : 'anzeigen' }}
          </button>

          <button mat-button type="button" (click)="applyPartsToAddress()" [disabled]="!hasParts()">
            <mat-icon>north_east</mat-icon>
            In Adresse übernehmen
          </button>
        </div>

        @if (splitAddress) {
          <div style="display:grid; grid-template-columns:1fr 120px 1fr; gap:12px; align-items:start;">
            <mat-form-field appearance="outline">
              <mat-label>Straße</mat-label>
              <input matInput placeholder="Musterstraße 1" [formControl]="form.controls.street" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>PLZ</mat-label>
              <input matInput inputmode="numeric" [formControl]="form.controls.zip" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stadt</mat-label>
              <input matInput placeholder="Musterstadt" [formControl]="form.controls.city" />
            </mat-form-field>
          </div>
        }
      }

      @if (geoError) {
        <div style="color:#c62828; font-size:12px;">{{ geoError }}</div>
      }

      @if (geoResults.length > 0) {
        <div style="display:grid; gap:8px;">
          <div style="font-size:12px; opacity:0.75;">Meintest du…?</div>
          <div style="display:grid; gap:8px;">
            <button
              mat-button
              type="button"
              *ngFor="let r of geoResults; let i = index"
              (click)="pickGeo(i)"
              style="text-align:left; justify-content:flex-start; white-space:normal;"
            >
              {{ r.label }}
            </button>
          </div>
        </div>
      }

      <div style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
        <div style="font-size:12px; opacity:0.75;">
          @if (form.controls.lat.value != null && form.controls.lng.value != null) {
            Koordinaten: {{ form.controls.lat.value }}, {{ form.controls.lng.value }}
          } @else {
            Koordinaten: – (Adresse prüfen)
          }
        </div>

        <button mat-button type="button" (click)="showCoords = !showCoords">
          <mat-icon>{{ showCoords ? 'visibility_off' : 'edit' }}</mat-icon>
          Koordinaten {{ showCoords ? 'verbergen' : 'bearbeiten' }}
        </button>
      </div>

      @if (showCoords) {
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
      }
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="isSaveDisabled()" (click)="submit()">
        Speichern
      </button>
    </div>
  `,
})
export class EventEditDialogComponent {
  static combineDateTime(date: Date, time: string): Date {
    const [h, m] = (time || '').split(':').map((n) => Number(n));
    const d = new Date(date);
    d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    return d;
  }

  ref = inject(MatDialogRef<EventEditDialogComponent, EventFormValue>);
  private geo = inject(GeocodingService);

  geoBusy = false;
  geoResults: GeocodeResult[] = [];
  geoError = '';

  // UI toggles (Create Dialog)
  splitAddress = false;
  showCoords = false;

  form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl<string>('', { nonNullable: true }),
    street: new FormControl<string>('', { nonNullable: true }),
    zip: new FormControl<string>('', { nonNullable: true }),
    city: new FormControl<string>('', { nonNullable: true }),
    lat: new FormControl<number | null>(null, { validators: [Validators.required] }),
    lng: new FormControl<number | null>(null, { validators: [Validators.required] }),
    status: new FormControl<'active' | 'inactive'>('active', { nonNullable: true }),
    date: new FormControl<Date | null>(null),
    time: new FormControl<string>('19:00', { nonNullable: true }),
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    if (data?.event) {
      const start = this.asMaybeDate(data.event.startAt);
      const time = start ? this.toTime(start) : '19:00';
      this.form.patchValue({
        name: data.event.name ?? '',
        address: data.event.address ?? '',
        lat: data.event.lat ?? null,
        lng: data.event.lng ?? null,
        status: data.event.status === 'inactive' ? 'inactive' : 'active',
        date: start,
        time,
      });
    }
  }

  private asMaybeDate(x: any): Date | null {
    if (!x) return null;
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    const d = new Date(String(x));
    return isNaN(d.getTime()) ? null : d;
  }

  private toTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  hasParts(): boolean {
    const street = (this.form.controls.street.value ?? '').trim();
    const zip = (this.form.controls.zip.value ?? '').trim();
    const city = (this.form.controls.city.value ?? '').trim();
    return !!street || !!zip || !!city;
  }

  applyPartsToAddress() {
    const q = this.buildPartsQuery();
    if (!q) return;
    this.form.controls.address.setValue(q);
  }

  private buildPartsQuery(): string {
    const street = (this.form.controls.street.value ?? '').trim();
    const zip = (this.form.controls.zip.value ?? '').trim();
    const city = (this.form.controls.city.value ?? '').trim();
    return [street, zip, city].filter(Boolean).join(', ');
  }

  private buildGeoQuery(): string {
    const addr = (this.form.controls.address.value ?? '').trim();
    if (addr) return addr;
    return this.buildPartsQuery();
  }

  canCheckAddress(): boolean {
    const q = this.buildGeoQuery();
    return !!q && q.trim().length >= 6;
  }

  isSaveDisabled(): boolean {
    const name = (this.form.controls.name.value ?? '').trim();
    if (!name) return true;

    // In Create: Datum ist Pflicht
    if (this.data?.mode !== 'edit' && !this.form.controls.date.value) return true;

    // Adresse: entweder Adresse-Feld oder Parts
    const q = this.buildGeoQuery();
    if (!q || q.trim().length < 3) return true;

    return false;
  }

  async checkAddress() {
    // Wenn Adresse leer ist aber Parts gesetzt sind: in Adresse übernehmen (damit Admin sieht, was gesucht wird)
    const currentAddr = (this.form.controls.address.value ?? '').trim();
    if (!currentAddr) {
      const parts = this.buildPartsQuery();
      if (parts) this.form.controls.address.setValue(parts);
    }

    const q = this.buildGeoQuery();
    if (!q || q.length < 6) {
      this.geoError = 'Bitte gib eine vollständige Adresse an (mind. Straße + Stadt).';
      return;
    }

    this.geoBusy = true;
    this.geoResults = [];
    this.geoError = '';

    try {
      const res = await firstValueFrom(this.geo.geocode(q, 5));
      this.geoResults = res ?? [];

      if (!this.geoResults.length) {
        this.geoError = 'Adresse nicht gefunden. Bitte präziser eingeben (z.B. mit PLZ).';
        return;
      }

      // 1 Treffer: automatisch übernehmen
      if (this.geoResults.length === 1) {
        this.pickGeo(0);
        return;
      }
    } catch (e) {
      console.error('geocode failed', e);
      this.geoError = 'Adresse konnte nicht geprüft werden.';
      this.geoResults = [];
    } finally {
      this.geoBusy = false;
    }
  }

  pickGeo(i: number) {
    const r = this.geoResults[i];
    if (!r) return;
    this.form.patchValue({
      address: r.label,
      lat: r.lat,
      lng: r.lng,
    });
    this.geoResults = [];
    this.geoError = '';
  }

  async submit() {
    const v = this.form.getRawValue();

    const name = (v.name ?? '').trim();
    if (!name) {
      this.geoError = 'Bitte gib einen Namen an.';
      return;
    }

    if (this.data?.mode !== 'edit' && !v.date) {
      this.geoError = 'Bitte wähle ein Datum.';
      return;
    }

    // Adresse: wenn leer, aus Parts zusammensetzen
    const partsAddr = this.buildPartsQuery();
    const address = ((v.address ?? '').trim() || partsAddr).trim();
    if (!address) {
      this.geoError = 'Bitte gib eine Adresse an.';
      return;
    }
    if (!(v.address ?? '').trim() && partsAddr) {
      this.form.controls.address.setValue(partsAddr);
    }

    // StartAt
    const startAt = v.date ? EventEditDialogComponent.combineDateTime(v.date, v.time) : null;

    // Koordinaten: wenn fehlen -> Adresse prüfen und ggf. Auswahl verlangen
    let lat = Number(this.form.controls.lat.value);
    let lng = Number(this.form.controls.lng.value);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      await this.checkAddress();

      lat = Number(this.form.controls.lat.value);
      lng = Number(this.form.controls.lng.value);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        // Bei mehreren Treffern bleibt die Liste offen -> User muss wählen
        if (this.geoResults.length > 1) {
          this.geoError = 'Bitte wähle den passenden Adress-Treffer aus.';
        } else if (!this.geoError) {
          this.geoError = 'Bitte Adresse prüfen.';
        }
        return;
      }
    }

    this.ref.close({
      name,
      address,
      lat,
      lng,
      status: v.status,
      startAt,
    });
  }
}

// ─────────────────────────────────────────────
// Dialog: Admin edit Suggestion
// ─────────────────────────────────────────────

type SuggestionEditResult = {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  startAt: Date | null;
  note: string | null;
  status: SuggestionStatus;
};

@Component({
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Vorschlag bearbeiten</h2>

    <div mat-dialog-content style="display:grid; gap:12px;">
      <div style="display:grid; grid-template-columns:1fr 180px; gap:12px; align-items:start;">
        <mat-form-field appearance="outline">
          <mat-label>Name *</mat-label>
          <input matInput [formControl]="form.controls.name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [formControl]="form.controls.status">
            <mat-option value="open">open</mat-option>
            <mat-option value="accepted">accepted</mat-option>
            <mat-option value="resolved">resolved</mat-option>
            <mat-option value="rejected">rejected</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start;">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Adresse</mat-label>
          <input matInput [formControl]="form.controls.address" />
        </mat-form-field>

        <button mat-stroked-button type="button" (click)="checkAddress()" [disabled]="geoBusy || !form.controls.address.value">
          <mat-icon>search</mat-icon>
          Adresse prüfen
        </button>
      </div>

      @if (geoResults.length > 0) {
        <div style="display:grid; gap:8px;">
          <div style="font-size:12px; opacity:0.75;">Meintest du…?</div>
          <div style="display:grid; gap:8px;">
            <button
              mat-button
              type="button"
              *ngFor="let r of geoResults; let i = index"
              (click)="pickGeo(i)"
              style="text-align:left; justify-content:flex-start; white-space:normal;"
            >
              {{ r.label }}
            </button>
          </div>
        </div>
      }

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <mat-form-field appearance="outline">
          <mat-label>Datum</mat-label>
          <input matInput [matDatepicker]="picker" [formControl]="form.controls.date" />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Uhrzeit</mat-label>
          <input matInput type="time" [formControl]="form.controls.time" />
        </mat-form-field>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <mat-form-field appearance="outline">
          <mat-label>Lat</mat-label>
          <input matInput type="number" inputmode="decimal" [formControl]="form.controls.lat" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Lng</mat-label>
          <input matInput type="number" inputmode="decimal" [formControl]="form.controls.lng" />
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Notiz</mat-label>
        <textarea matInput rows="3" [formControl]="form.controls.note"></textarea>
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Speichern</button>
    </div>
  `,
})
export class SuggestionEditDialogComponent {
  ref = inject(MatDialogRef<SuggestionEditDialogComponent, SuggestionEditResult>);
  private geo = inject(GeocodingService);

  geoBusy = false;
  geoResults: GeocodeResult[] = [];

  form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl<string>('', { nonNullable: true }),
    status: new FormControl<SuggestionStatus>('open', { nonNullable: true }),
    date: new FormControl<Date | null>(null),
    time: new FormControl<string>('19:00', { nonNullable: true }),
    lat: new FormControl<number | null>(null),
    lng: new FormControl<number | null>(null),
    note: new FormControl<string>('', { nonNullable: true }),
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    const s: EventSuggestionRow | undefined = data?.suggestion;
    if (s) {
      const start = this.asMaybeDate(s.startAt);
      this.form.patchValue({
        name: s.name ?? '',
        address: (s.address ?? '').toString(),
        status: (s.status as any) ?? 'open',
        date: start,
        time: start ? this.toTime(start) : '19:00',
        lat: Number.isFinite(Number(s.lat)) ? Number(s.lat) : null,
        lng: Number.isFinite(Number(s.lng)) ? Number(s.lng) : null,
        note: (s.note ?? '').toString(),
      });
    }
  }

  private asMaybeDate(x: any): Date | null {
    if (!x) return null;
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    const d = new Date(String(x));
    return isNaN(d.getTime()) ? null : d;
  }

  private toTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  async checkAddress() {
    const q = (this.form.controls.address.value ?? '').trim();
    if (!q) return;
    this.geoBusy = true;
    this.geoResults = [];
    try {
      const res = await firstValueFrom(this.geo.geocode(q, 5));
      this.geoResults = res ?? [];
    } catch (e) {
      console.error('geocode failed', e);
      this.geoResults = [];
    } finally {
      this.geoBusy = false;
    }
  }

  pickGeo(i: number) {
    const r = this.geoResults[i];
    if (!r) return;
    this.form.patchValue({
      address: r.label,
      lat: r.lat,
      lng: r.lng,
    });
    this.geoResults = [];
  }

  submit() {
    const v = this.form.getRawValue();
    const name = (v.name ?? '').trim();
    const address = (v.address ?? '').trim() || null;
    const note = (v.note ?? '').trim() || null;
    const lat = Number(v.lat);
    const lng = Number(v.lng);
    const startAt = v.date ? EventEditDialogComponent.combineDateTime(v.date, v.time) : null;

    this.ref.close({
      name,
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      startAt,
      note,
      status: v.status,
    });
  }
}
