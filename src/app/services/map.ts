import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';

// 👉 Nur Typen importieren (führt kein Leaflet-Code auf dem Server aus)
import type * as Leaflet from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private platformId = inject(PLATFORM_ID);

  // Laufzeit-Referenz auf das Leaflet-Modul (wird nur im Browser gesetzt)
  private L: typeof import('leaflet') | null = null;

  // Streng typisierte Map-Referenz
  private map: Leaflet.Map | null = null;

  constructor(private firestore: Firestore) {
    // Wir laden Leaflet nur, wenn wir im Browser sind, um serverseitige Fehler zu vermeiden
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then((leaflet) => {
        this.L = leaflet;

        // Icon-Fix, nachdem Leaflet geladen ist
        const iconDefault = this.L.icon({
          iconRetinaUrl: 'assets/marker-icon-2x.png',
          iconUrl: 'assets/marker-icon.png',
          shadowUrl: 'assets/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          tooltipAnchor: [16, -28],
          shadowSize: [41, 41]
        });
        this.L.Marker.prototype.options.icon = iconDefault;
      });
    }
  }

  initializeMap(elementId: string): void {
    // Nur im Browser und wenn Leaflet bereits geladen ist
    if (!isPlatformBrowser(this.platformId) || !this.L) return;

    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (!el) return; // Sicherheitscheck

      if (!this.map) {
        this.map = this.L!.map(elementId).setView([51.16, 10.45], 6);
        this.L!.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(this.map);
      }

      // Berechnet die Kartengröße neu (falls Container anfangs versteckt war)
      this.map?.invalidateSize();
    }, 100);
  }

  destroyMap(): void {
    if (isPlatformBrowser(this.platformId) && this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // Streamt die Konsum-Standorte eines Nutzers und zeichnet Marker
  listenForConsumptionMarkers(
    uid: string,
    onMarkersReady: (markers: Leaflet.Marker[]) => void
  ): Unsubscribe {
    // Falls kein Browser/keine Map/kein Leaflet, leere Unsubscribe-Funktion zurückgeben
    if (!isPlatformBrowser(this.platformId) || !this.map || !this.L) {
      return () => {};
    }

    const consumptionsRef = collection(this.firestore, 'consumptions');
    const q = query(
      consumptionsRef,
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

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

  // Erstellt ein benutzerdefiniertes HTML-Icon für die Marker
  private createMarkerIcon(color: string): Leaflet.DivIcon {
    const html = `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,.5)"></div>`;
    return this.L!.divIcon({
      html,
      className: 'custom-map-icon-container',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  // Konvertiert verschiedene Standortformate in Leaflet-geeignete Koordinaten
  private toLatLng(loc: any): Leaflet.LatLngTuple | null {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length === 2 && !isNaN(loc[0]) && !isNaN(loc[1])) return [loc[0], loc[1]];
    if (loc.lat != null && loc.lng != null && !isNaN(loc.lat) && !isNaN(loc.lng)) return [loc.lat, loc.lng];
    if (loc.latitude != null && loc.longitude != null && !isNaN(loc.latitude) && !isNaN(loc.longitude)) return [loc.latitude, loc.longitude];
    return null;
  }
}
