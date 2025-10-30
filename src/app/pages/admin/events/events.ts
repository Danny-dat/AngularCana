import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  EventItem,
  EventMutationPayload,
  EventsService,
} from '../../../services/events.service';

function coordinatesPairValidator(group: AbstractControl): ValidationErrors | null {
  const lat = group.get('lat')?.value;
  const lng = group.get('lng')?.value;
  const hasLat = lat !== null && lat !== undefined && lat !== '';
  const hasLng = lng !== null && lng !== undefined && lng !== '';

  if (hasLat !== hasLng) {
    return { coordinatesPair: true };
  }

  return null;
}

@Component({
  selector: 'app-events',
   standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './events.html',
    styleUrls: ['./events.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEvents {
  private readonly fb = inject(FormBuilder);
  private readonly eventsService = inject(EventsService);

  @ViewChild('bannerInput', { static: false })
  bannerInput?: ElementRef<HTMLInputElement>;

  readonly events$ = this.eventsService.listen();

  readonly eventForm = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      start: ['', [Validators.required]],
      address: ['', [Validators.maxLength(300)]],
      lat: ['', [Validators.pattern(/^-?\d+(?:\.\d+)?$/)]],
      lng: ['', [Validators.pattern(/^-?\d+(?:\.\d+)?$/)]],
    },
    { validators: coordinatesPairValidator }
  );

  isSaving = false;
  saveError: string | null = null;
  deleteError: string | null = null;
  editingEvent: EventItem | null = null;
  bannerFile: File | null = null;
  bannerPreview: string | null = null;
  removeExistingBanner = false;
  pendingDeleteIds = new Set<string>();

  trackById = (_: number, item: EventItem) => item.id;

  get canRemoveBanner(): boolean {
    return (
      !!this.bannerFile ||
      (!!this.editingEvent?.bannerUrl && !this.removeExistingBanner)
    );
  }

  async submit(): Promise<void> {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.saveError = null;

    const { name, start, address, lat, lng } = this.eventForm.getRawValue();
    const trimmedName = name?.trim() ?? '';
    const trimmedAddress = address?.trim() ?? '';
    const parsedLat = this.parseCoordinate(lat);
    const parsedLng = this.parseCoordinate(lng);

const mutation: EventMutationPayload = {
  name: trimmedName,
  startTimestamp: this.datetimeLocalToTimestamp(start),
  address: trimmedAddress || undefined,
  lat: parsedLat ?? undefined,
  lng: parsedLng ?? undefined,
};


    try {
      if (this.editingEvent) {
        await this.eventsService.updateEvent(this.editingEvent.id, mutation, {
          bannerFile: this.bannerFile,
          current: this.editingEvent,
          removeBanner: this.removeExistingBanner && !this.bannerFile,
        });
      } else {
        await this.eventsService.createEvent(mutation, this.bannerFile);
      }

      this.resetForm();
    } catch (err) {
      this.saveError = this.toErrorMessage(err);
    } finally {
      this.isSaving = false;
    }
  }

  edit(event: EventItem): void {
    this.editingEvent = event;
    this.removeExistingBanner = false;
    this.bannerFile = null;
    this.bannerPreview = event.bannerUrl ?? null;
    this.eventForm.reset({
      name: event.name ?? '',
      start: this.timestampToLocalInput(event.startTimestamp ?? null),
      address: event.address ?? '',
      lat: Number.isFinite(event.lat) ? String(event.lat) : '',
      lng: Number.isFinite(event.lng) ? String(event.lng) : '',
    });
    this.eventForm.markAsPristine();
    this.eventForm.markAsUntouched();
    if (this.bannerInput?.nativeElement) {
      this.bannerInput.nativeElement.value = '';
    }
  }

  async delete(event: EventItem): Promise<void> {
    if (!confirm(`Event "${event.name}" wirklich löschen?`)) {
      return;
    }

    this.pendingDeleteIds.add(event.id);
    this.deleteError = null;

    try {
      await this.eventsService.deleteEvent(event);
      if (this.editingEvent?.id === event.id) {
        this.resetForm();
      }
    } catch (err) {
      this.deleteError = this.toErrorMessage(err);
    } finally {
      this.pendingDeleteIds.delete(event.id);
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  openFileDialog(): void {
    this.bannerInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input?.files?.length) {
      this.bannerFile = null;
      if (!this.editingEvent || this.removeExistingBanner) {
        this.bannerPreview = null;
      }
      return;
    }

    const file = input.files[0];
    this.bannerFile = file;
    this.removeExistingBanner = false;

    const reader = new FileReader();
    reader.onload = () => {
      this.bannerPreview = typeof reader.result === 'string' ? reader.result : null;
    };
    reader.readAsDataURL(file);
  }

  clearBannerSelection(): void {
    this.bannerFile = null;
    if (this.bannerInput?.nativeElement) {
      this.bannerInput.nativeElement.value = '';
    }

    if (this.editingEvent?.bannerUrl) {
      this.bannerPreview = null;
      this.removeExistingBanner = true;
    } else {
      this.bannerPreview = null;
      this.removeExistingBanner = false;
    }
  }

  hasError(controlName: string, error: string): boolean {
    const control = this.eventForm.get(controlName);
    return !!control && control.touched && control.hasError(error);
  }

  private datetimeLocalToTimestamp(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }

  private timestampToLocalInput(value: number | null | undefined): string {
    if (value == null) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private resetForm(): void {
    this.eventForm.reset({ name: '', start: '', address: '', lat: '', lng: '' });
    this.eventForm.markAsPristine();
    this.eventForm.markAsUntouched();
    this.editingEvent = null;
    this.saveError = null;
    this.bannerFile = null;
    this.removeExistingBanner = false;
    this.bannerPreview = null;
    if (this.bannerInput?.nativeElement) {
      this.bannerInput.nativeElement.value = '';
    }
  }

  private toErrorMessage(err: unknown): string {
    if (!err) {
      return 'Unbekannter Fehler';
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return String(err);
  }

  private parseCoordinate(value: string | null | undefined): number | null {
    if (value == null || value === '') {
      return null;
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}