import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as L from 'leaflet';
import type { EventItem } from './events.service';

@Injectable({ providedIn: 'root' })
export class MapService {
  private L?: typeof import('leaflet'); // dynamic import
  private map?: L.Map;

  private eventsLayer?: L.LayerGroup;
  private routeLine?: L.Polyline;
  private invalidateTimer?: any;

  constructor(@Inject(PLATFORM_ID) private pid: Object) {}

  private async ensureLeaflet(): Promise<typeof import('leaflet')> {
    if (!isPlatformBrowser(this.pid)) throw new Error('Leaflet only in browser');
    if (!this.L) {
      this.L = await import('leaflet');

      // 1) Pfad für Standard-Assets (optional)
      (this.L.Icon.Default as any).imagePath = 'assets/';

      // 2) Default-Icon EXPLIZIT setzen (wichtig gegen "createIcon of undefined")
      const def = this.L.icon({
        iconUrl: 'assets/marker-icon.png',
        iconRetinaUrl: 'assets/marker-icon-2x.png',
        shadowUrl: 'assets/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      (this.L.Marker as any).prototype.options.icon = def;
    }
    return this.L!;
  }

  /** Karte aufbauen (idempotent) */
  async initializeMap(elementId: string): Promise<L.Map | undefined> {
    if (!isPlatformBrowser(this.pid)) return;
    const L = await this.ensureLeaflet();

    const el = document.getElementById(elementId);
    if (!el) throw new Error(`#${elementId} not found`);

    if (!this.map) {
      this.map = L.map(el).setView([51.16, 10.45], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.map);

      this.eventsLayer = L.layerGroup().addTo(this.map);
    }

    // sichtbare Größe aktualisieren
    requestAnimationFrame(() => this.map?.invalidateSize(true));
    return this.map;
  }

  invalidateSizeSoon(delay = 250) {
    if (!this.map) return;
    clearTimeout(this.invalidateTimer);
    this.invalidateTimer = setTimeout(() => this.map?.invalidateSize(true), delay);
  }

  /** Map & Layer sauber abbauen (ohne Exceptions) */
  destroyMap(): void {
    if (!isPlatformBrowser(this.pid)) return;
    try {
      this.clearRoute();
    } catch {}
    try {
      this.clearEvents();
    } catch {}

    try {
      if (this.eventsLayer && this.map) {
        this.eventsLayer.removeFrom(this.map);
      }
    } catch {}

    try {
      this.map?.off();
      this.map?.remove();
    } catch {}

    this.routeLine = undefined;
    this.eventsLayer = undefined;
    this.map = undefined;
    clearTimeout(this.invalidateTimer);
  }

  // ---------- Events ----------
  clearEvents() {
    if (!this.eventsLayer) return;
    try {
      this.eventsLayer.clearLayers();
    } catch (err) {
      console.warn('[MapService] clearEvents failed:', err);
    }
  }

  addEventMarker(e: EventItem, highlight = false) {
    if (!this.map || !this.eventsLayer) {
      console.warn('[MapService] addEventMarker: map/layer not ready');
      return;
    }
    const L = this.L!;
    const nLat = Number((e as any).lat);
    const nLng = Number((e as any).lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      console.warn('[MapService] invalid coords for event:', e);
      return;
    }

    // ⭐️-Icon als DivIcon (keine Assets nötig)
    const starHtml = `<div style="
      display:flex;align-items:center;justify-content:center;
      width:30px;height:30px;border-radius:50%;
      background:#fef3c7;border:2px solid #f59e0b;
      box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:16px;line-height:1">⭐</div>`;
    const starIcon = L.divIcon({
      html: starHtml,
      className: 'ev-star-icon', // optional, falls du später stylen willst
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });

    const icon = highlight ? starIcon : (L.Marker as any).prototype.options.icon; // dein Default (PNG)

    const m = L.marker([nLat, nLng], { title: e.name, icon }).bindPopup(
      `<strong>${e.name}</strong><br>${e.address ?? ''}`
    );

    m.addTo(this.eventsLayer);
    return m;
  }

  /** Nur gelikte Events des Users anzeigen und sinnvoll zoomen */
  showLikedEvents(events: EventItem[], uid: string) {
    if (!this.map || !this.L) return;
    const sUid = String(uid);
    const liked = (events || []).filter(e => (e.upvotes || []).map(String).includes(sUid));

    this.clearEvents();
    liked.forEach(e => this.addEventMarker(e, true));

    if (liked.length === 1) {
      const e = liked[0];
      this.focus(Number(e.lat), Number(e.lng), 15);
    } else if (liked.length > 1) {
      const L = this.L;
      const b = L.latLngBounds(liked.map(e => [Number(e.lat), Number(e.lng)]) as L.LatLngTuple[]);
      this.map.fitBounds(b, { padding: [20, 20] });
    }
  }

  /** Hilfsfunktion: auf alle Events zoomen (Debug/All-View) */
  fitToEvents(events: EventItem[]) {
    if (!this.map || !this.L) return;
    const valid = (events || []).filter(
      (e) => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng))
    );
    if (!valid.length) return;
    const L = this.L;
    const b = L.latLngBounds(valid.map((e) => [Number(e.lat), Number(e.lng)]) as L.LatLngTuple[]);
    this.map.fitBounds(b, { padding: [20, 20] });
  }

  focus(lat: number, lng: number, zoom = 15) {
    this.map?.setView([lat, lng], zoom);
  }

  // ---------- Routing (optional) ----------
  async showRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    await this.ensureLeaflet();
    if (!this.map) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates?.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      if (!coords?.length) return;

      this.clearRoute();
      const L = this.L!;
      this.routeLine = L.polyline(coords as any, { weight: 5 }).addTo(this.map);
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [20, 20] });
    } catch {}
  }

  clearRoute() {
    try {
      if (this.routeLine && this.map) {
        this.map.removeLayer(this.routeLine);
      }
    } catch {}
    this.routeLine = undefined;
  }
}
