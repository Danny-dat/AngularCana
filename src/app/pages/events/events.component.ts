import { Component, computed, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { EventsService, EventItem } from '../../services/events.service';
import { EventSuggestionsService } from '../../services/event-suggestions.service';
import { GeocodingService, GeocodeResult } from '../../services/geocoding.service';

@Component({
  selector: 'app-events',
  standalone: true,
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
})
export class EventsComponent {
  private eventsSvc = inject(EventsService);
  private suggestSvc = inject(EventSuggestionsService);
  private geo = inject(GeocodingService);
  private auth = inject(Auth);

  private readonly CONFIRM_KEY = 'maps.confirm.skip';

  uid = signal<string | null>(null);

  // Live-Daten
  events$ = this.eventsSvc.listen();
  eventsSig = signal<EventItem[]>([]);

  // UI-State
  onlyMine = signal<boolean>(false);
  query = signal<string>('');
  pending = signal<Record<string, boolean>>({});

  // Modal-State
  confirmOpen = signal<boolean>(false);
  confirmEvent = signal<EventItem | null>(null);
  dontAskAgain = signal<boolean>(false);
  skipConfirm = signal<boolean>(false);

  // Vorschlag-Modal
  suggestOpen = signal<boolean>(false);
  sName = signal<string>('');
  sStreet = signal<string>('');
  sZip = signal<string>('');
  sCity = signal<string>('');
  sDate = signal<string>(''); // YYYY-MM-DD
  sTime = signal<string>('19:00');
  sNote = signal<string>('');

  geoBusy = signal<boolean>(false);
  geoResults = signal<GeocodeResult[]>([]);
  geoSelected = signal<number>(-1);
  geoQuery = signal<string>('');
  geoError = signal<string>('');

  suggestBusy = signal<boolean>(false);

  constructor() {
    this.events$.subscribe(this.eventsSig.set);
    onAuthStateChanged(this.auth, (u) => this.uid.set(u?.uid ?? null));

    try {
      this.skipConfirm.set(localStorage.getItem(this.CONFIRM_KEY) === '1');
    } catch {}
  }

  // ─────────────────────────────────────────────
  // Vorschlag machen
  // ─────────────────────────────────────────────

  openSuggest() {
    if (!this.uid()) {
      alert('Bitte zuerst einloggen.');
      return;
    }
    this.sName.set('');
    this.sStreet.set('');
    this.sZip.set('');
    this.sCity.set('');
    this.sDate.set('');
    this.sTime.set('19:00');
    this.sNote.set('');

    this.geoResults.set([]);
    this.geoSelected.set(-1);
    this.geoQuery.set('');
    this.geoError.set('');

    this.suggestBusy.set(false);
    this.suggestOpen.set(true);
  }

  cancelSuggest() {
    this.suggestOpen.set(false);
  }

  private buildAddressQuery(): string {
    const street = this.sStreet().trim();
    const zip = this.sZip().trim();
    const city = this.sCity().trim();
    return [street, zip, city].filter(Boolean).join(', ');
  }

  private parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
    // dateStr: YYYY-MM-DD
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
    if (!m) return null;
    const [y, mo, d] = dateStr.split('-').map((x) => Number(x));
    const [hh, mm] = (timeStr || '00:00').split(':').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    return new Date(y, mo - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  }

  async checkAddress() {
    const q = this.buildAddressQuery();
    if (!q || q.length < 6) {
      this.geoError.set('Bitte gib mindestens Straße und Stadt an.');
      return;
    }

    this.geoBusy.set(true);
    this.geoError.set('');

    try {
      const results = await firstValueFrom(this.geo.geocode(q, 5));
      this.geoQuery.set(q);
      this.geoResults.set(results || []);

      if (!results || results.length === 0) {
        this.geoSelected.set(-1);
        this.geoError.set('Adresse nicht gefunden. Bitte präziser eingeben (z.B. mit PLZ).');
        return;
      }

      // Wenn mehrere Treffer: User muss wählen
      this.geoSelected.set(results.length === 1 ? 0 : -1);
    } catch (e) {
      console.error('geocode failed', e);
      this.geoError.set('Adresse konnte nicht geprüft werden.');
    } finally {
      this.geoBusy.set(false);
    }
  }

  pickGeo(i: number) {
    this.geoSelected.set(i);
  }

  async submitSuggest() {
    const uid = this.uid();
    if (!uid) return;

    const name = this.sName().trim();
    if (!name) {
      alert('Bitte gib mindestens einen Event-Namen an.');
      return;
    }

    const street = this.sStreet().trim();
    const city = this.sCity().trim();
    if (!street || !city) {
      alert('Bitte gib Straße und Stadt an.');
      return;
    }

    const dateStr = this.sDate().trim();
    const timeStr = this.sTime().trim();
    if (!dateStr) {
      alert('Bitte wähle ein Datum.');
      return;
    }

    const startAt = this.parseLocalDateTime(dateStr, timeStr);
    if (!startAt) {
      alert('Datum/Uhrzeit ist ungültig.');
      return;
    }

    // Geocode sicherstellen (und ggf. Auswahl verlangen)
    const q = this.buildAddressQuery();
    const needsLookup = this.geoQuery() !== q || this.geoResults().length === 0;
    if (needsLookup) {
      await this.checkAddress();
    }

    const hits = this.geoResults();
    if (!hits || hits.length === 0) {
      alert('Adresse nicht gefunden. Bitte prüfe Straße/PLZ/Stadt.');
      return;
    }

    const sel = this.geoSelected();
    if (hits.length > 1 && (sel < 0 || sel >= hits.length)) {
      alert('Bitte wähle den passenden Adress-Treffer aus.');
      return;
    }

    const chosen = hits[hits.length === 1 ? 0 : sel];
    if (!chosen || !Number.isFinite(chosen.lat) || !Number.isFinite(chosen.lng)) {
      alert('Ungültige Koordinaten. Bitte Adresse erneut prüfen.');
      return;
    }

    const display =
      this.auth.currentUser?.displayName ||
      this.auth.currentUser?.email ||
      uid;

    this.suggestBusy.set(true);
    try {
      await this.suggestSvc.createSuggestion({
        createdBy: uid,
        createdByName: display,
        name,
        // wir speichern die normalisierte Adresse, damit Admins es easy haben
        address: chosen.label,
        lat: chosen.lat,
        lng: chosen.lng,
        startAt,
        note: this.sNote().trim() || null,
      });

      this.suggestOpen.set(false);
      alert('Danke! Dein Vorschlag wurde gespeichert.');
    } catch (e) {
      console.error('suggest failed', e);
      alert('Vorschlag konnte nicht gesendet werden.');
    } finally {
      this.suggestBusy.set(false);
    }
  }

  isUpvoted = (e: EventItem) => !!this.uid() && !!e.upvotes?.includes(this.uid()!);
  isDownvoted = (e: EventItem) => !!this.uid() && !!e.downvotes?.includes(this.uid()!);

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mine = this.onlyMine();
    const me = this.uid();
    let res = this.eventsSig();

    if (q) {
      res = res.filter((e) =>
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.address ?? '').toLowerCase().includes(q)
      );
    }
    if (mine && me) res = res.filter((e) => e.upvotes?.includes(me));
    return res;
  });

  likedCount = computed(() => {
    const me = this.uid();
    return me ? this.eventsSig().filter((e) => e.upvotes?.includes(me)).length : 0;
  });

  async vote(e: EventItem, type: 'up' | 'down') {
    const me = this.uid();
    if (!me) {
      alert('Bitte zuerst einloggen.');
      return;
    }

    this.pending.update((p) => ({ ...p, [e.id]: true }));
    try {
      await this.eventsSvc.voteEvent(e.id, me, type);
    } catch (err) {
      console.error('vote failed', err);
    } finally {
      this.pending.update((p) => {
        const { [e.id]: _, ...rest } = p;
        return rest;
      });
    }
  }

  showOnMap(e: EventItem) {
    document.dispatchEvent(new CustomEvent('events:showOnMap', { detail: e }));
  }

  /** Öffnet erst Modal; bei „Nicht mehr fragen“ direkt Maps */
  openRoute(e: EventItem) {
    if (this.skipConfirm()) {
      // 👉 leeren Tab sofort öffnen, dann URL berechnen
      const popup = this.openBlankTab();
      this.openMaps(e, 'walking', popup);
      return;
    }
    this.confirmEvent.set(e);
    this.dontAskAgain.set(false);
    this.confirmOpen.set(true);
  }

  // ===== Modal-Buttons =====
  confirmCancel() {
    this.confirmOpen.set(false);
    this.confirmEvent.set(null);
  }

  async confirmProceed() {
    if (this.dontAskAgain()) {
      this.skipConfirm.set(true);
      try {
        localStorage.setItem(this.CONFIRM_KEY, '1');
      } catch {}
    }
    const e = this.confirmEvent();
    this.confirmOpen.set(false);

    if (e) {
      // 👉 leeren Tab sofort öffnen (innerhalb des Click-Handlers)
      const popup = this.openBlankTab();
      await this.openMaps(e, 'walking', popup);
    }
    this.confirmEvent.set(null);
  }

  /** Leeren Tab synchron öffnen, um Popup-Blocker zu umgehen */
  private openBlankTab(): Window | null {
    try {
      const w = window.open('', '_blank'); // kein 'noopener' hier, sonst bekommt man evtl. kein Handle
      if (w) {
        try {
          w.opener = null; // Sicherheit
          w.document.title = 'Öffne Google Maps …';
          w.document.body.innerHTML =
            '<p style="font-family:sans-serif;padding:16px">Öffne Google Maps …</p>';
        } catch {}
      }
      return w;
    } catch {
      return null;
    }
  }

  /** Google-Maps Directions öffnen (Start = GPS wenn verfügbar) */
  private async openMaps(
    e: EventItem,
    mode: 'walking' | 'driving' | 'bicycling' | 'transit' = 'walking',
    popup?: Window | null
  ) {
    const dest = `${Number(e.lat)},${Number(e.lng)}`;

    // Standort optional (kurzer Timeout, damit es flott öffnet)
    const pos = await this.getPosition(4000).catch(() => null);

    let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      dest
    )}&travelmode=${mode}`;
    if (pos?.coords) {
      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      url += `&origin=${encodeURIComponent(origin)}`;
    }

    // Dashboard informieren (falls es z. B. fokussieren soll)
    document.dispatchEvent(new CustomEvent('events:routeTo', { detail: e }));

    // bereits geöffneten Tab verwenden; sonst neuer Tab
    if (popup && !popup.closed) {
      try {
        popup.location.replace(url);
        return;
      } catch {}
    }
    window.open(url, '_blank', 'noopener'); // Fallback
  }

  // --- helpers --------------------------------------------------------------
  private getPosition(timeoutMs = 6000): Promise<GeolocationPosition | null> {
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
        () => {
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
}
