/* istanbul ignore file */
// src/app/pages/admin/promo/promo-slot-editor.ts
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Firestore, doc, docData, setDoc, serverTimestamp } from '@angular/fire/firestore';

import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdSlotComponent } from '../../../components/promo-slot/ad-slot.component';
import type { AdSlotConfig } from '../../../models/ad.types';

type AdSlotDoc = {
  linkUrl?: string | null;
  linkEnabled?: boolean;
  activeExt?: AdSlotConfig['activeExt'] | null;
  updatedAt?: any;
};

const IMAGE_RULES = {
  maxBytes: 700 * 1024, // 700 KB
  allowedMime: ['image/svg+xml', 'image/webp', 'image/png', 'image/jpeg'],
} as const;

@Component({
  standalone: true,
  selector: 'app-promo-slot-editor',
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatSnackBarModule,

    AdSlotComponent,
  ],
  templateUrl: './promo-slot-editor.html',
  styleUrls: ['./promo-slot-editor.css'],
})
export class PromoSlotEditorComponent implements OnInit, OnDestroy {
  private afs = inject(Firestore, { optional: true });
  private snack = inject(MatSnackBar, { optional: true });

  @Input({ required: true }) slotId!: string;
  @Input() title = '';
  @Input() subtitle = '';

  private sub?: Subscription;

  readonly allowed = IMAGE_RULES.allowedMime
    .map((m) => m.replace('image/', '').toUpperCase().replace('SVG+XML', 'SVG'))
    .join(', ');

  readonly maxKb = Math.round(IMAGE_RULES.maxBytes / 1024);

  /** Angular Templates koennen nicht direkt auf globale Objekte wie `Math` zugreifen. */
  readonly Math = Math;

  // Firestore Doc
  doc$!: Observable<{
    linkEnabled: boolean;
    linkUrl: string | null;
    activeExt: AdSlotConfig['activeExt'];
    updatedAt?: string | null;
  }>;

  // Form
  form = new FormGroup({
    linkEnabled: new FormControl<boolean>(true, { nonNullable: true }),
    linkUrl: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^https?:\/\/.+/i)],
    }),
  });

  // Bild-Auswahl
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  fileError: string | null = null;

  // aktuelle Konfig (aus Firestore)
  current: { linkEnabled: boolean; linkUrl: string | null; activeExt: AdSlotConfig['activeExt']; updatedAt?: string | null } = {
    linkEnabled: true,
    linkUrl: null,
    activeExt: 'webp',
    updatedAt: null,
  };

  ngOnInit(): void {
    if (!this.afs) {
      // z.B. in Unit-Tests ohne AngularFire Provider
      this.doc$ = of({ linkEnabled: true, linkUrl: null, activeExt: 'webp', updatedAt: null } as any);
      this.sub = this.doc$.subscribe();
      return;
    }

    // Input ist hier gesetzt → erst jetzt Observables bauen
    this.doc$ = this.slotDoc$().pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.sub = this.doc$.subscribe((d) => {
      this.current = {
        linkEnabled: d.linkEnabled ?? true,
        linkUrl: d.linkUrl ?? null,
        activeExt: (d.activeExt ?? 'webp') as any,
        updatedAt: d.updatedAt ?? null,
      };

      // Form nur initial/bei externen Aenderungen syncen (ohne dirty zu machen)
      this.form.patchValue(
        {
          linkEnabled: this.current.linkEnabled,
          linkUrl: this.current.linkUrl ?? '',
        },
        { emitEvent: false }
      );
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
  }

  serverTargetPath(): string {
    const ext = this.nextExt();
    return `/media/${this.slotId}/banner.${ext}`;
  }

  assetsTargetPath(): string {
    // Assets-Fallback im Repo war bisher SVG/PNG.
    // (Im laufenden Browser kann man assets nicht austauschen, daher nur Hinweis.)
    return `src/assets/promo/${this.slotId}/banner.svg`;
  }

  /** Welche Endung soll ab jetzt bevorzugt werden? */
  nextExt(): AdSlotConfig['activeExt'] {
    if (this.selectedFile) {
      // SVG bleibt SVG; alles andere -> WEBP (sauberer Standard)
      return this.selectedFile.type === 'image/svg+xml' ? 'svg' : 'webp';
    }
    return this.current.activeExt ?? 'webp';
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError = null;

    if (!file) return;

    if (!IMAGE_RULES.allowedMime.includes(file.type as any)) {
      this.fileError = `Ungueltiges Format (${file.type}). Erlaubt: ${this.allowed}`;
      return;
    }

    if (file.size > IMAGE_RULES.maxBytes) {
      this.fileError = `Datei zu gross (${Math.round(file.size / 1024)} KB). Max ${this.maxKb} KB.`;
      return;
    }

    this.selectedFile = file;

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
  }

  resetSelection() {
    this.selectedFile = null;
    this.fileError = null;
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }

  async downloadPrepared() {
    if (!this.selectedFile) {
      this.snack?.open('Bitte erst ein Bild auswaehlen.', 'OK', { duration: 2000 });
      return;
    }

    try {
      const prepared = await this.prepareFile(this.selectedFile);
      this.downloadFile(prepared, `banner.${this.nextExt()}`);
      this.snack?.open('Datei vorbereitet. Jetzt per FTP/Server ersetzen und danach "Speichern" klicken.', 'OK', {
        duration: 3500,
      });
    } catch {
      this.snack?.open('Konnte Datei nicht vorbereiten.', 'OK', { duration: 2500 });
    }
  }

  /** Speichert Link + preferred Ext + bump timestamp (Clients refreshen Banner) */
  async save() {
    try {
      const afs = this.afs;
      if (!afs) return;
      const linkEnabled = !!this.form.controls.linkEnabled.value;
      const linkUrl = (this.form.controls.linkUrl.value ?? '').trim();

      // Wenn Link deaktiviert -> URL null
      const finalUrl = linkEnabled ? (linkUrl || null) : null;

      const r = doc(afs, 'adSlots', this.slotId);
      await setDoc(
        r,
        {
          linkEnabled,
          linkUrl: finalUrl,
          activeExt: this.nextExt(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.snack?.open('Promo gespeichert ✅', 'OK', { duration: 2000 });

      // optional: nach speichern selection zuruecksetzen
      this.resetSelection();
    } catch {
      this.snack?.open('Speichern fehlgeschlagen ❌', 'OK', { duration: 3000 });
    }
  }

  async copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      this.snack?.open('Pfad kopiert', 'OK', { duration: 1500 });
    } catch {
      // Fallback (keine Clipboard-API)
      try {
        const el = document.createElement('textarea');
        el.value = path;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        this.snack?.open('Pfad kopiert', 'OK', { duration: 1500 });
      } catch {
        this.snack?.open('Konnte nicht kopieren. (Browser blockiert)', 'OK', { duration: 2000 });
      }
    }
  }

  openLink() {
    const url = this.current.linkUrl;
    if (!this.current.linkEnabled || !url) {
      this.snack?.open('Kein aktiver Link gesetzt.', 'OK', { duration: 1500 });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // -----------------------
  // intern
  // -----------------------

  private slotDoc$(): Observable<{ linkEnabled: boolean; linkUrl: string | null; activeExt: AdSlotConfig['activeExt']; updatedAt?: string | null }> {
    const afs = this.afs;
    if (!afs) {
      return of({ linkEnabled: true, linkUrl: null, activeExt: 'webp', updatedAt: null } as any);
    }
    const r = doc(afs, 'adSlots', this.slotId);
    return (docData(r) as Observable<AdSlotDoc>).pipe(
      map((d) => ({
        linkEnabled: typeof d?.linkEnabled === 'boolean' ? d.linkEnabled : true,
        linkUrl: (d?.linkUrl ?? null) as string | null,
        activeExt: (d?.activeExt ?? 'webp') as any,
        updatedAt: this.toIsoSafe(d?.updatedAt) ?? null,
      })),
      catchError(() => of({ linkEnabled: true, linkUrl: null, activeExt: 'webp', updatedAt: null } as any))
    );
  }

  private toIsoSafe(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    return null;
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Sauberer Server-Standard:
   * - SVG bleibt SVG
   * - PNG/JPEG/WEBP -> WEBP (fixer Dateiname: banner.webp)
   */
  private async prepareFile(file: File): Promise<Blob> {
    if (file.type === 'image/svg+xml') {
      return file;
    }

    // already webp? still re-encode to ensure cache + consistent settings
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/webp',
        0.92
      );
    });

    return blob;
  }
}
