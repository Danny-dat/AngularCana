import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { EventItem } from './events.service';

@Injectable({ providedIn: 'root' })
export class MapService {
  // intern zwischengespeichertes Leaflet-Modul
  private L?: typeof import('leaflet');
  private map?: import('leaflet').Map;

  private eventsLayer?: import('leaflet').LayerGroup;
  private routeLine?: import('leaflet').Polyline;
  private invalidateTimer?: any;

  constructor(@Inject(PLATFORM_ID) private pid: Object) {}

  /** Leaflet nur im Browser laden; gibt IMMER ein definiertes Modul zurück */
  private async ensureLeaflet(): Promise<typeof import('leaflet')> {
    if (!isPlatformBrowser(this.pid)) throw new Error('Leaflet only in browser');

    if (!this.L) {
      const mod = await import('leaflet');
      const L = (mod as any).default ?? (mod as any); // ESM/UMD normalisieren
      this.L = L;

      // Standard-Icon mit ABSOLUTEN Pfaden
      const def = L.icon({
        iconUrl: '/assets/leaflet/marker-icon.png',
        iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
        shadowUrl: '/assets/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      (L.Marker as any).prototype.options.icon = def;
    }
    // ab hier garantiert definiert
    return this.L!;
  }

  /** Karte aufbauen (idempotent) */
  async initializeMap(elementId: string): Promise<import('leaflet').Map | undefined> {
    if (!isPlatformBrowser(this.pid)) return;
    const L = await this.ensureLeaflet(); // L ist hier sicher definiert

    const el = document.getElementById(elementId);
    if (!el) throw new Error(`#${elementId} not found`);

    if (!this.map) {
      if (el.offsetHeight < 50) {
        console.warn(`[MapService] Container #${elementId} hat nur ${el.offsetHeight}px Höhe.`);
      }

      this.map = L.map(el).setView([51.16, 10.45], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.map);

      this.eventsLayer = L.layerGroup().addTo(this.map);
    }

    requestAnimationFrame(() => this.map?.invalidateSize(true));
    return this.map;
  }

  invalidateSizeSoon(delay = 250) {
    if (!this.map) return;
    clearTimeout(this.invalidateTimer);
    this.invalidateTimer = setTimeout(() => this.map?.invalidateSize(true), delay);
  }

  destroyMap(): void {
    if (!isPlatformBrowser(this.pid)) return;
    try { this.clearRoute(); } catch {}
    try { this.clearEvents(); } catch {}
    try { if (this.eventsLayer && this.map) this.eventsLayer.removeFrom(this.map); } catch {}
    try { this.map?.off(); this.map?.remove(); } catch {}
    this.routeLine = undefined;
    this.eventsLayer = undefined;
    this.map = undefined;
    clearTimeout(this.invalidateTimer);
  }

  // ---------- Events ----------
  clearEvents() {
    if (!this.eventsLayer) return;
    try { this.eventsLayer.clearLayers(); }
    catch (err) { console.warn('[MapService] clearEvents failed:', err); }
  }

  addEventMarker(e: EventItem, highlight = false) {
    if (!this.map || !this.eventsLayer) {
      console.warn('[MapService] addEventMarker: map/layer not ready');
      return;
    }
    const L = this.L!; // nach ensureLeaflet() sicher vorhanden
    const nLat = Number((e as any).lat);
    const nLng = Number((e as any).lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      console.warn('[MapService] invalid coords for event:', e);
      return;
    }

    const starHtml = `<div style="
      display:flex;align-items:center;justify-content:center;
      width:30px;height:30px;border-radius:50%;
      background:#fef3c7;border:2px solid #f59e0b;
      box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:16px;line-height:1">⭐</div>`;
    const starIcon = L.divIcon({
      html: starHtml, className: 'ev-star-icon',
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16],
    });

    const icon = highlight ? starIcon : (L.Marker as any).prototype.options.icon;
    const m = L.marker([nLat, nLng], { title: e.name, icon })
      .bindPopup(`<strong>${e.name}</strong><br>${e.address ?? ''}`);
    m.addTo(this.eventsLayer);
    return m;
  }

  showLikedEvents(events: EventItem[], uid: string) {
    if (!this.map || !this.L) return;
    const sUid = String(uid);
    const liked = (events || []).filter(e => (e.upvotes || []).map(String).includes(sUid));

    this.clearEvents();
    liked.forEach(e => this.addEventMarker(e, true));

    if (liked.length === 1) {
      const e = liked[0]; this.focus(Number(e.lat), Number(e.lng), 15);
    } else if (liked.length > 1) {
      const L = this.L!;
      const b = L.latLngBounds(liked.map(e => [Number(e.lat), Number(e.lng)]) as import('leaflet').LatLngTuple[]);
      this.map!.fitBounds(b, { padding: [20, 20] });
    }
  }

  fitToEvents(events: EventItem[]) {
    if (!this.map || !this.L) return;
    const valid = (events || []).filter(
      e => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng))
    );
    if (!valid.length) return;
    const L = this.L!;
    const b = L.latLngBounds(valid.map(e => [Number(e.lat), Number(e.lng)]) as import('leaflet').LatLngTuple[]);
    this.map!.fitBounds(b, { padding: [20, 20] });
  }

  focus(lat: number, lng: number, zoom = 15) {
    this.map?.setView([lat, lng], zoom);
  }

  // ---------- Routing (optional) ----------
  async showRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    const L = await this.ensureLeaflet();
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
      this.routeLine = L.polyline(coords as any, { weight: 5 }).addTo(this.map);
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [20, 20] });
    } catch {}
  }

  clearRoute() {
    try { if (this.routeLine && this.map) this.map.removeLayer(this.routeLine); } catch {}
    this.routeLine = undefined;
  }
}
