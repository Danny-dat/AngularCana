/* istanbul ignore file */
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
  ViewChild,
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
import { NotificationService } from '../../services/notification.service';
// Der Pfad muss korrekt sein, damit CannaComponent gefunden wird
import { CannaComponent, ConsumptionSelection } from '../canna/canna';
import { geoCellE2, keyify } from '../../utils/analytics-utils';

type Toast = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AdSlotComponent, CannaComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly env = inject(EnvironmentInjector);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  @ViewChild(CannaComponent) private cannaComponent?: CannaComponent;

  constructor(
    private readonly mapService: MapService,
    private readonly eventsSvc: EventsService,
    private readonly notifications: NotificationService,
    @Inject(PLATFORM_ID) private readonly pid: Object,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  isSaving = false;
  justSaved = false;
  savedAt: Date | null = null;
  toast: Toast | null = null;
  
  private autoResetTimer?: any;
  private autoToastTimer?: any;
  private authUnsub?: () => void;
  private eventsSub?: { unsubscribe: () => void };
  private latestEvents: EventItem[] = [];
  private eventsRefreshTimer?: any;

  ngOnInit(): void {}

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.pid)) return;

    await this.mapService.initializeMap('map-container');
    this.mapService.invalidateSizeSoon();

    runInInjectionContext(this.env, () => {
      this.authUnsub = onAuthStateChanged(this.auth, (user) => {
        this.eventsSub?.unsubscribe?.();
        clearInterval(this.eventsRefreshTimer);
        this.eventsRefreshTimer = undefined;
        this.latestEvents = [];

        if (!user?.uid) {
          this.mapService.clearEvents();
          return;
        }

        // zusätzlich: alle 60s neu filtern (abgelaufene Events verschwinden ohne Firestore-Update)
        this.eventsRefreshTimer = setInterval(() => {
          this.applyEventMarkers(user.uid);
        }, 60_000);

        this.eventsSub = this.eventsSvc
          .listen()
          .subscribe((events: EventItem[]) => {
            this.latestEvents = events || [];
            this.applyEventMarkers(user.uid);
            this.mapService.invalidateSizeSoon(100);
          });
      });
    });
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe?.();
    this.authUnsub?.();
    this.mapService.destroyMap();
    clearInterval(this.eventsRefreshTimer);
    clearTimeout(this.autoResetTimer);
    clearTimeout(this.autoToastTimer);
  }

  private applyEventMarkers(uid: string) {
    const now = Date.now();
    const active = (this.latestEvents || []).filter((e: any) => this.isEventActiveUser(e, now));
    this.mapService.showLikedEvents(active, uid);
  }

  /** User-Logik: manuell deaktivierte Events sind aus, vergangene startAt sind aus. Ohne startAt: aktiv. */
  private isEventActiveUser(e: any, nowMs: number): boolean {
    const status = String(e?.status ?? 'active');
    if (status === 'inactive') return false;

    const d = this.asMaybeDate(e?.startAt);
    if (!d) return true;

    return d.getTime() > nowMs;
  }

  private asMaybeDate(x: any): Date | null {
    if (!x) return null;
    if (x instanceof Date) return x;
    if (typeof x?.toDate === 'function') return x.toDate();
    const d = new Date(String(x));
    return isNaN(d.getTime()) ? null : d;
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

  // ─────────────────────────────────────────────
  // Daily Limit (client-side)
  // ─────────────────────────────────────────────
  private dayKey(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  private getDailyLimit(): number {
    try {
      const raw = localStorage.getItem('settings:consumptionThreshold');
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    } catch {}
    return 3;
  }

  private todayCountKey(uid: string): string {
    return `consumptions:count:${uid}:${this.dayKey()}`;
  }

  private canLogToday(uid: string): boolean {
    const limit = this.getDailyLimit();
    if (!limit || limit <= 0) return true;
    try {
      const key = this.todayCountKey(uid);
      const c = Number(localStorage.getItem(key) ?? '0');
      return !(Number.isFinite(c) && c >= limit);
    } catch {
      return true;
    }
  }

  private bumpToday(uid: string): void {
    try {
      const key = this.todayCountKey(uid);
      const c = Number(localStorage.getItem(key) ?? '0');
      const next = Number.isFinite(c) ? c + 1 : 1;
      localStorage.setItem(key, String(next));
    } catch {}
  }

  async logConsumption(selection: ConsumptionSelection) {
    if (
      !selection.product ||
      !selection.device ||
      !selection.location
    )
      return;

    const user = this.auth.currentUser;
    if (!user?.uid) {
      this.showToast('error', 'Bitte zuerst einloggen.');
      return;
    }

    // Tageslimit (clientseitig, basierend auf Settings)
    if (!this.canLogToday(user.uid)) {
      const limit = this.getDailyLimit();
      this.showToast('error', `Tageslimit erreicht (${limit}).`);
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      const pos = await this.getPosition();
      const geo = pos
        ? new GeoPoint(pos.coords.latitude, pos.coords.longitude)
        : null;

      // DisplayName einmal lesen (für Payload + Notification)
      const userSnap = await runInInjectionContext(this.env, () =>
        getDoc(doc(this.firestore, `users/${user.uid}`))
      );
      const displayName: string | null = userSnap.exists()
        ? (userSnap.data() as any)['displayName'] ?? null
        : null;

      const productLabel = selection.product!;
      const deviceLabel = selection.device!;
      const locationLabel = selection.location!;

      // stabile Keys für spätere Auswertungen
      const productKey = keyify(productLabel);
      const deviceKey = keyify(deviceLabel);
      const locationKey = keyify(locationLabel);

      // Privacy-friendly Geo Raster (optional)
      const cell = geo ? geoCellE2(geo.latitude, geo.longitude) : null;

      const payload: any = {
        userId: user.uid,
        userDisplayName: displayName,
        product: productLabel,
        device: deviceLabel,
        location: locationLabel,

        productKey,
        deviceKey,
        locationKey,

        // Server-Zeit für Statistik/Queries
        timestamp: serverTimestamp(),

        // Debug/Qualität: Clientzeit (nicht für Auswertung, nur hilfreich)
        clientTimestampMs: Date.now(),
        platform: 'web',

        ...(geo && { locationGeo: geo, hasGeo: true }),
        ...(cell && {
          geoCellLatE2: cell.latE2,
          geoCellLngE2: cell.lngE2,
          geoCellId: cell.id,
        }),
      };

      await runInInjectionContext(this.env, () =>
        addDoc(collection(this.firestore, 'consumptions'), payload)
      );

      this.bumpToday(user.uid);

      await this.notifications.sendConsumptionToFriends({
        userId: user.uid,
        displayName,
        product: selection.product!,
        device: selection.device!,
        location: selection.location!,
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
      this.cannaComponent?.resetSelection(); 
      this.cdr.markForCheck();
    }
  }

}

