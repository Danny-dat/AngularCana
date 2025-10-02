import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as L from 'leaflet';
import type { EventItem } from './events.service';

@Injectable({ providedIn: 'root' })
export class MapService {
  private L?: typeof import('leaflet'); // dynamic import
  private map?: L.Map;

  // Layer für Events und optionale Route
  private eventsLayer?: L.LayerGroup;
  private routeLine?: L.Polyline;
  private invalidateTimer?: any;

  constructor(@Inject(PLATFORM_ID) private pid: Object) {}

  private async ensureLeaflet(): Promise<typeof import('leaflet')> {
    if (!isPlatformBrowser(this.pid)) throw new Error('Leaflet only in browser');
    if (!this.L) {
      this.L = await import('leaflet');
      (this.L.Icon.Default as any).imagePath = 'assets/'; // Standard-Icons
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
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(this.map);

      this.eventsLayer = L.layerGroup().addTo(this.map);
    }

    requestAnimationFrame(() => this.map?.invalidateSize(true));
    return this.map;
  }

  destroyMap(): void {
    if (!isPlatformBrowser(this.pid)) return;
    this.clearRoute();
    this.clearEvents();
    if (this.map) this.map.remove();
    this.map = undefined;
    this.eventsLayer = undefined;
    clearTimeout(this.invalidateTimer);
  }

  invalidateSizeSoon(delay = 250) {
    if (!this.map) return;
    clearTimeout(this.invalidateTimer);
    this.invalidateTimer = setTimeout(() => this.map?.invalidateSize(true), delay);
  }

  // ---------- Events ----------
  clearEvents() { this.eventsLayer?.clearLayers(); }

  addEventMarker(e: EventItem, highlight = false) {
    if (!this.map || !this.eventsLayer || !this.L) {
      console.warn('[MapService] addEventMarker: map/layer/Leaflet not ready');
      return;
    }
    const { lat, lng } = e as any;
    const nLat = Number(lat), nLng = Number(lng);
    if (!isFinite(nLat) || !isFinite(nLng)) {
      console.warn('[MapService] invalid coords for event:', e);
      return;
    }

    const L = this.L;
    const m = L
      .marker([nLat, nLng], {
        title: e.name,
        icon: highlight
          ? L.icon({
              iconUrl: 'assets/marker-icon-2x.png',
              shadowUrl: 'assets/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })
          : undefined,
      })
      .bindPopup(`<strong>${e.name}</strong><br>${e.address}`);
    m.addTo(this.eventsLayer);
    return m;
  }

  /** Nur gelikte Events des Users anzeigen und sinnvoll zoomen */
  showLikedEvents(events: EventItem[], uid: string) {
    if (!this.map || !this.L) { console.warn('[MapService] showLikedEvents: map/Leaflet missing'); return; }
    const sUid = String(uid);
    const liked = (events || []).filter(e => (e.upvotes || []).map(String).includes(sUid));
    console.log('[MapService] liked for uid', sUid, '->', liked.length);

    this.clearEvents();
    liked.forEach(e => this.addEventMarker(e, true));

    if (liked.length) {
      const L = this.L;
      const b = L.latLngBounds(liked.map(e => [Number(e.lat), Number(e.lng)]) as L.LatLngTuple[]);
      this.map!.fitBounds(b, { padding: [20, 20] });
    }
  }

  /** Hilfsfunktion: auf alle Events zoomen (wird im Debug-Pfad genutzt) */
  fitToEvents(events: EventItem[]) {
    if (!this.map || !this.L) return;
    const valid = (events || []).filter(e => isFinite(Number(e.lat)) && isFinite(Number(e.lng)));
    if (!valid.length) return;
    const L = this.L;
    const b = L.latLngBounds(valid.map(e => [Number(e.lat), Number(e.lng)]) as L.LatLngTuple[]);
    this.map.fitBounds(b, { padding: [20, 20] });
  }

  focus(lat: number, lng: number, zoom = 15) { this.map?.setView([lat, lng], zoom); }

  // ---------- Routing (optional) ----------
  async showRoute(from: {lat:number; lng:number}, to: {lat:number; lng:number}) {
    await this.ensureLeaflet();
    if (!this.map) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const coords: [number, number][] | undefined =
        data?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]);
      if (!coords?.length) return;

      this.clearRoute();
      const L = this.L!;
      this.routeLine = L.polyline(coords as any, { weight: 5 }).addTo(this.map);
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [20, 20] });
    } catch {}
  }

  clearRoute() {
    if (this.routeLine && this.map) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = undefined;
    }
  }
}
