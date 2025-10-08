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

  ngOnInit(): void {}

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.pid)) return;

    await this.mapService.initializeMap('map-container');
    this.mapService.invalidateSizeSoon();

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

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      const pos = await this.getPosition();
      const geo = pos
        ? new GeoPoint(pos.coords.latitude, pos.coords.longitude)
        : null;

      const payload = {
        userId: user.uid,
        product: selection.product!,
        device: selection.device!,
        location: selection.location!,
        timestamp: serverTimestamp(),
        ...(geo && { locationGeo: geo }),
      };

      await runInInjectionContext(this.env, () =>
        addDoc(collection(this.firestore, 'consumptions'), payload)
      );

      const userSnap = await runInInjectionContext(this.env, () =>
        getDoc(doc(this.firestore, `users/${user.uid}`))
      );
      const displayName: string | null = userSnap.exists()
        ? (userSnap.data() as any)['displayName'] ?? null
        : null;

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

