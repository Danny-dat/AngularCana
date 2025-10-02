import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  Inject,
  NgZone,
  PLATFORM_ID,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MapService } from '../../services/map.service';

import { Auth } from '@angular/fire/auth';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';
import { GeoPoint } from 'firebase/firestore';
import { AdSlotComponent } from '../promo-slot/ad-slot.component';

interface Consumable {
  name: string;
  img: string;
}
type Toast = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AdSlotComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // AngularFire + DI
  private readonly env = inject(EnvironmentInjector);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  constructor(
    private readonly mapService: MapService,
    @Inject(PLATFORM_ID) private readonly pid: Object,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  // Auswahl
  products: Consumable[] = [
    { name: 'Hash', img: 'assets/produkte/hash.png' },
    { name: 'Blüte', img: 'assets/produkte/flower.png' },
    { name: 'Öl / Harz', img: 'assets/produkte/resin1.png' },
  ];
  devices: Consumable[] = [
    { name: 'Joint', img: 'assets/devices/joint.png' },
    { name: 'Bong', img: 'assets/devices/bong.png' },
    { name: 'Vaporizer', img: 'assets/devices/vaporizer.png' },
    { name: 'Pfeife', img: 'assets/devices/pfeife.png' },
  ];

  selection = { product: null as string | null, device: null as string | null };

  // UI-State
  isSaving = false;
  justSaved = false; // steuert Buttonzustand „Gespeichert“
  savedAt: Date | null = null;
  toast: Toast | null = null;
  private autoResetTimer?: any;
  private autoToastTimer?: any;

  // Asset-Platzhalter (verhindert sichtbare Bild-404s)
  private readonly placeholderSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="sans-serif" font-size="12" fill="#9aa0a6">kein Bild</text>
    </svg>`);

  // Feature-Flags
  private readonly USE_GEOLOCATION = true;
  private readonly GEO_TIMEOUT_MS = 6000;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.pid)) return; // SSR guard
    requestAnimationFrame(() => {
      this.zone.runOutsideAngular(() => this.mapService.initializeMap('map-container'));
    });
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
    clearTimeout(this.autoResetTimer);
    clearTimeout(this.autoToastTimer);
  }

  // --- UI Helper -------------------------------------------------------------

  selectProduct(name: string) {
    this.selection.product = name;
    this.cdr.markForCheck();
  }
  selectDevice(name: string) {
    this.selection.device = name;
    this.cdr.markForCheck();
  }

  onImgError(ev: Event, _kind: 'product' | 'device') {
    const img = ev.target as HTMLImageElement;
    if (img && img.src !== this.placeholderSvg) {
      img.src = this.placeholderSvg;
      img.alt = 'Platzhalter';
    }
  }

  private showToast(type: Toast['type'], text: string, ms = 2200) {
    this.toast = { type, text };
    this.cdr.markForCheck();
    clearTimeout(this.autoToastTimer);
    this.autoToastTimer = setTimeout(
      () =>
        this.zone.run(() => {
          this.toast = null;
          this.cdr.markForCheck();
        }),
      ms
    );
  }

  private buttonSavedPulse() {
    this.justSaved = true;
    this.savedAt = new Date();
    // Haptik/kurzes Vibrationsfeedback (falls vorhanden)
    try {
      (navigator as any).vibrate?.(25);
    } catch {}
    this.cdr.markForCheck();
    clearTimeout(this.autoResetTimer);
    this.autoResetTimer = setTimeout(
      () =>
        this.zone.run(() => {
          this.justSaved = false;
          this.cdr.markForCheck();
        }),
      1500
    );
  }

  // Geolocation (optional) mit Timeout – gibt bei Fehlern null zurück
  private getPosition(timeoutMs = this.GEO_TIMEOUT_MS): Promise<GeolocationPosition | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve(null);
        }
      }, timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(pos);
          }
        },
        (_err) => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(null);
          }
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
      );
    });
  }

  // --- Action: Konsum speichern ---------------------------------------------

  async logConsumption() {
    if (!this.selection.product || !this.selection.device) return;

    const u = this.auth.currentUser;
    if (!u?.uid) {
      this.showToast('error', 'Bitte zuerst einloggen.');
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      // optionaler Standort
      let geo: GeoPoint | null = null;
      if (this.USE_GEOLOCATION) {
        const pos = await this.getPosition().catch(() => null);
        if (pos) geo = new GeoPoint(pos.coords.latitude, pos.coords.longitude);
      }

      const payload: any = {
        userId: u.uid,
        product: this.selection.product,
        device: this.selection.device,
        timestamp: serverTimestamp(),
        ...(geo ? { location: geo } : {}),
      };

      // Firestore-Write sicher im Injection Context
      await runInInjectionContext(this.env, async () => {
        await addDoc(collection(this.firestore, 'consumptions'), payload);
      });

      // sichtbares Feedback
      this.buttonSavedPulse();
      this.showToast('success', geo ? 'Gespeichert (inkl. Standort).' : 'Gespeichert.');

      // Map-Resize (falls du später Marker setzt)
      this.mapService.invalidateSizeSoon();
    } catch (e: any) {
      const code = e?.code || e?.name || 'unknown';
      const msg =
        code === 'permission-denied'
          ? 'Keine Schreibrechte.'
          : code === 'unauthenticated'
          ? 'Session abgelaufen.'
          : code === 'unavailable'
          ? 'Netzwerk/Backend nicht erreichbar.'
          : 'Speichern fehlgeschlagen.';
      console.error('[logConsumption] FAILED:', code, e);
      this.showToast('error', msg);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }
}
