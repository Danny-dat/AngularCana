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
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  GeoPoint,
} from '@angular/fire/firestore';
import { AdSlotComponent } from '../promo-slot/ad-slot.component';
import { EventsService, EventItem } from '../../services/events.service';
import { NotificationService } from '../../services/notification.service'; // ✅ neu hinzugefügt

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
  private readonly env = inject(EnvironmentInjector);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  constructor(
    private readonly mapService: MapService,
    private readonly eventsSvc: EventsService,
    private readonly notifications: NotificationService, // ✅ NotificationService
    @Inject(PLATFORM_ID) private readonly pid: Object,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  products: Consumable[] = [
    { name: 'Blüte', img: 'assets/produkte/flower.png' },
    { name: 'Hash', img: 'assets/produkte/hash.png' },
    { name: 'Harz', img: 'assets/produkte/resin1.png' },
  ];
  devices: Consumable[] = [
    { name: 'Joint', img: 'assets/devices/joint.png' },
    { name: 'Bong', img: 'assets/devices/bong.png' },
    { name: 'Vaporizer', img: 'assets/devices/vaporizer.png' },
    { name: 'Pfeife', img: 'assets/devices/pfeife.png' },
  ];
  locations: Consumable[] = [
    { name: 'Küche', img: 'assets/locations/kitchen.svg' },
    { name: 'Badezimmer', img: 'assets/locations/bathroom.svg' },
    { name: 'Garten', img: 'assets/locations/garden.svg' },
    { name: 'Wohnzimmer', img: 'assets/locations/livingroom.svg' },
  ];

  selection = {
    product: null as string | null,
    device: null as string | null,
    location: null as string | null,
  };

  isSaving = false;
  justSaved = false;
  savedAt: Date | null = null;
  toast: Toast | null = null;
  activeDropdown: 'product' | 'device' | 'location' | null = null;
  private autoResetTimer?: any;
  private autoToastTimer?: any;
  private authUnsub?: () => void;
  private eventsSub?: { unsubscribe: () => void };

  ngOnInit(): void {}

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.pid)) return;

    await this.mapService.initializeMap('map-container');
    this.mapService.invalidateSizeSoon();

    // Auth Listener
    runInInjectionContext(this.env, () => {
      this.authUnsub = onAuthStateChanged(this.auth, (user) => {
        this.eventsSub?.unsubscribe?.();

        if (!user?.uid) {
          this.mapService.clearEvents();
          return;
        }

        this.eventsSub = this.eventsSvc
          .listen()
          .subscribe((events: EventItem[]) => {
            this.mapService.showLikedEvents(events, user.uid);
            this.mapService.invalidateSizeSoon(100);
          });
      });
    });
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe?.();
    this.authUnsub?.();
    this.mapService.destroyMap();
    clearTimeout(this.autoResetTimer);
    clearTimeout(this.autoToastTimer);
  }

  toggleDropdown(menu: 'product' | 'device' | 'location' | null) {
    this.activeDropdown = this.activeDropdown === menu ? null : menu;
  }

  selectProduct(name: string) {
    this.selection.product = name;
    this.activeDropdown = 'device';
    this.cdr.markForCheck();
  }

  selectDevice(name: string) {
    this.selection.device = name;
    this.activeDropdown = 'location';
    this.cdr.markForCheck();
  }

  selectLocation(name: string) {
    this.selection.location = name;
    this.activeDropdown = null;
    this.cdr.markForCheck();
  }

  onImgError(ev: Event, _kind: string) {
    const img = ev.target as HTMLImageElement;
    if (img) {
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#9aa0a6">n/a</text></svg>`
      )}`;
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

  private getPosition(timeoutMs = 6000): Promise<GeolocationPosition | null> {
    if (!isPlatformBrowser(this.pid) || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    return Promise.race([
      new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null)
        );
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      ),
    ]);
  }

  async logConsumption() {
    if (
      !this.selection.product ||
      !this.selection.device ||
      !this.selection.location
    )
      return;

    const user = this.auth.currentUser;
    if (!user?.uid) {
      this.showToast('error', 'Bitte zuerst einloggen.');
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      const pos = await this.getPosition();
      const geo = pos
        ? new GeoPoint(pos.coords.latitude, pos.coords.longitude)
        : null;

      const payload = {
        userId: user.uid,
        product: this.selection.product!,
        device: this.selection.device!,
        location: this.selection.location!,
        timestamp: serverTimestamp(),
        ...(geo && { locationGeo: geo }),
      };

      await runInInjectionContext(this.env, () =>
        addDoc(collection(this.firestore, 'consumptions'), payload)
      );

      // 🔔 DisplayName aus users/{uid} holen
      const userSnap = await runInInjectionContext(this.env, () =>
        getDoc(doc(this.firestore, `users/${user.uid}`))
      );
      const displayName: string | null = userSnap.exists()
        ? (userSnap.data() as any)['displayName'] ?? null
        : null;

      // ✅ Freunde benachrichtigen
      await this.notifications.sendConsumptionToFriends({
        userId: user.uid,
        displayName,
        product: this.selection.product!,
        device: this.selection.device!,
        location: this.selection.location!,
      });

      this.buttonSavedPulse();
      this.showToast(
        'success',
        geo ? 'Gespeichert (inkl. Standort).' : 'Gespeichert.'
      );
      this.mapService.invalidateSizeSoon();
    } catch (e: any) {
      const code = e?.code || 'unknown';
      const msg =
        code === 'permission-denied'
          ? 'Keine Schreibrechte.'
          : 'Speichern fehlgeschlagen.';
      console.error('[logConsumption] FAILED:', code, e);
      this.showToast('error', msg);
    } finally {
      this.isSaving = false;
      this.selection = { product: null, device: null, location: null };
      this.cdr.markForCheck();
    }
  }
}
