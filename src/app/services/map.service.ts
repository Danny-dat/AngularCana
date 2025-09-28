import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, query, where, orderBy, limit, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import type * as Leaflet from 'leaflet';

@Injectable({ providedIn: 'root' })
export class MapService {
  private platformId = inject(PLATFORM_ID);
  private L: typeof import('leaflet') | null = null;
  private map: Leaflet.Map | null = null;

  // EINZIGE Quelle der Wahrheit: lädt Leaflet genau einmal und merkt sich das Ergebnis
  private leafletReadyPromise: Promise<typeof import('leaflet')> | null = null;

  constructor(private firestore: Firestore) {}

  private loadLeaflet(): Promise<typeof import('leaflet')> {
    if (!isPlatformBrowser(this.platformId)) {
      // auf dem Server niemals laden
      return Promise.reject('SSR: Leaflet wird nicht geladen');
    }
    if (!this.leafletReadyPromise) {
      this.leafletReadyPromise = import('leaflet').then((leaflet) => {
        // Icon-Fix (falls benötigt)
        const iconDefault = leaflet.icon({
          iconRetinaUrl: 'assets/marker-icon-2x.png',
          iconUrl: 'assets/marker-icon.png',
          shadowUrl: 'assets/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          tooltipAnchor: [16, -28],
          shadowSize: [41, 41]
        });
        leaflet.Marker.prototype.options.icon = iconDefault;
        this.L = leaflet;
        return leaflet;
      });
    }
    return this.leafletReadyPromise;
  }

  /** Initialisiert die Karte zuverlässig (wartet auf Leaflet + DOM). */
  async initializeMap(elementId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // 1) Leaflet laden (wartet, statt frühzeitig return)
    const L = await this.loadLeaflet().catch(() => null);
    if (!L) return;

    // 2) Auf das Ziel-Element warten (falls DOM noch nicht da)
    const el = await this.waitForElement(elementId, 1000);
    if (!el) return;

    // 3) Existierende Map entsorgen
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // 4) Map erstellen
    this.map = L.map(elementId).setView([51.16, 10.45], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // 5) Sicherstellen, dass die Größe passt (nach Render/Animation)
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  /** Zerstört die Karte. */
  destroyMap(): void {
    if (isPlatformBrowser(this.platformId) && this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /** Marker-Listen-Stream (nur aufrufen, wenn Map bereits initialisiert ist). */
  listenForConsumptionMarkers(
    uid: string,
    onMarkersReady: (markers: Leaflet.Marker[]) => void
  ): Unsubscribe {
    if (!isPlatformBrowser(this.platformId) || !this.map || !this.L) return () => {};

    const consumptionsRef = collection(this.firestore, 'consumptions');
    const q = query(consumptionsRef, where('userId', '==', uid), orderBy('timestamp', 'desc'), limit(100));

    return onSnapshot(q, (snapshot) => {
      const markers: Leaflet.Marker[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        const latLng = this.toLatLng(data?.location);
        if (latLng && this.map) {
          const marker = this.L!.marker(latLng, { icon: this.createMarkerIcon('green') }).addTo(this.map);
          markers.push(marker);
        }
      });
      onMarkersReady(markers);
    });
  }

  invalidateSizeSoon(delay = 50) {
    setTimeout(() => this.map?.invalidateSize(), delay);
  }

  // Helpers
  private async waitForElement(id: string, timeoutMs = 800): Promise<HTMLElement | null> {
    const start = Date.now();
    let el = document.getElementById(id);
    while (!el && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 16)); // ~1 Frame
      el = document.getElementById(id);
    }
    return el;
  }

  private createMarkerIcon(color: string): Leaflet.DivIcon {
    const html = `<div style="background:${color};width:20px;height:20px;border-radius:50%;
                   border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,.5)"></div>`;
    return this.L!.divIcon({ html, className: 'custom-map-icon-container', iconSize: [26, 26], iconAnchor: [13, 13] });
    }

  private toLatLng(loc: any): Leaflet.LatLngTuple | null {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length === 2 && !isNaN(loc[0]) && !isNaN(loc[1])) return [loc[0], loc[1]];
    if (loc.lat != null && loc.lng != null && !isNaN(loc.lat) && !isNaN(loc.lng)) return [loc.lat, loc.lng];
    if (loc.latitude != null && loc.longitude != null && !isNaN(loc.latitude) && !isNaN(loc.longitude)) return [loc.latitude, loc.longitude];
    return null;
  }
}
