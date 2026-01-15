import { Component, computed, inject, signal } from '@angular/core';
import { EventsService, EventItem } from '../../services/events.service';
import { EventSuggestionsService } from '../../services/event-suggestions.service';
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-events',
  standalone: true,
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
})
export class EventsComponent {
  private eventsSvc = inject(EventsService);
  private suggestSvc = inject(EventSuggestionsService);
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
  sAddress = signal<string>('');
  sLat = signal<string>('');
  sLng = signal<string>('');
  sNote = signal<string>('');
  suggestBusy = signal<boolean>(false);

  constructor() {
    this.events$.subscribe(this.eventsSig.set);
    onAuthStateChanged(this.auth, (u) => this.uid.set(u?.uid ?? null));

    try { this.skipConfirm.set(localStorage.getItem(this.CONFIRM_KEY) === '1'); } catch {}
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
    this.sAddress.set('');
    this.sLat.set('');
    this.sLng.set('');
    this.sNote.set('');
    this.suggestBusy.set(false);
    this.suggestOpen.set(true);
  }

  cancelSuggest() {
    this.suggestOpen.set(false);
  }

  async submitSuggest() {
    const uid = this.uid();
    if (!uid) return;

    const name = this.sName().trim();
    if (!name) {
      alert('Bitte gib mindestens einen Event-Namen an.');
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
        address: this.sAddress().trim() || null,
        lat: this.sLat().trim() ? Number(this.sLat().trim()) : null,
        lng: this.sLng().trim() ? Number(this.sLng().trim()) : null,
        note: this.sNote().trim() || null,
      });
      this.suggestOpen.set(false);
      alert('Danke! Dein Vorschlag wurde an die Admins geschickt.');
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
      res = res.filter(e =>
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.address ?? '').toLowerCase().includes(q)
      );
    }
    if (mine && me) res = res.filter(e => e.upvotes?.includes(me));
    return res;
  });

  likedCount = computed(() => {
    const me = this.uid();
    return me ? this.eventsSig().filter(e => e.upvotes?.includes(me)).length : 0;
  });

  async vote(e: EventItem, type: 'up' | 'down') {
    const me = this.uid();
    if (!me) { alert('Bitte zuerst einloggen.'); return; }

    this.pending.update(p => ({ ...p, [e.id]: true }));
    try {
      await this.eventsSvc.voteEvent(e.id, me, type);
    } catch (err) {
      console.error('vote failed', err);
    } finally {
      this.pending.update(p => { const { [e.id]: _, ...rest } = p; return rest; });
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
      try { localStorage.setItem(this.CONFIRM_KEY, '1'); } catch {}
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
          w.opener = null;                         // Sicherheit
          w.document.title = 'Öffne Google Maps …';
          w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:16px">Öffne Google Maps …</p>';
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

    let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
    if (pos?.coords) {
      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      url += `&origin=${encodeURIComponent(origin)}`;
    }

    // Dashboard informieren (falls es z. B. fokussieren soll)
    document.dispatchEvent(new CustomEvent('events:routeTo', { detail: e }));

    // bereits geöffneten Tab verwenden; sonst neuer Tab
    if (popup && !popup.closed) {
      try { popup.location.replace(url); return; } catch {}
    }
    window.open(url, '_blank', 'noopener'); // Fallback
  }

  // --- helpers --------------------------------------------------------------
  private getPosition(timeoutMs = 6000): Promise<GeolocationPosition | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!done) { done = true; clearTimeout(timer); resolve(pos); } },
        ()    => { if (!done) { done = true; clearTimeout(timer); resolve(null); } },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
      );
    });
  }
}
