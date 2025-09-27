import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// VOLLSTÄNDIGE FIREBASE-IMPORTE HINZUGEFÜGT:
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe // <-- Wichtiger Typ für den Listener
} from '@angular/fire/firestore';

// Wir laden Leaflet nur, wenn wir im Browser sind, um serverseitige Fehler zu vermeiden
let L: any = null;

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private platformId = inject(PLATFORM_ID);
  private map: L.Map | null = null;

  constructor(private firestore: Firestore) {
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then(leaflet => {
        L = leaflet;
        // Icon-Fix, nachdem L geladen ist
        const iconDefault = L.icon({
          iconRetinaUrl: 'assets/marker-icon-2x.png', iconUrl: 'assets/marker-icon.png',
          shadowUrl: 'assets/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41],
          popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41]
        });
        L.Marker.prototype.options.icon = iconDefault;
      });
    }
  }

  initializeMap(elementId: string): void {
    if (!isPlatformBrowser(this.platformId) || !L) return;

    setTimeout(() => {
      if (!document.getElementById(elementId)) return; // Sicherheitscheck
      if (!this.map) {
        this.map = L.map(elementId).setView([51.16, 10.45], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '© OpenStreetMap'
        }).addTo(this.map);
      }
      // Optional Chaining `?.` behebt den 'Object is possibly null' Fehler
      this.map?.invalidateSize();
    }, 100);
  }

  destroyMap(): void {
    if (isPlatformBrowser(this.platformId) && this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  listenForConsumptionMarkers(uid: string, onMarkersReady: (markers: L.Marker[]) => void): Unsubscribe {
    if (!isPlatformBrowser(this.platformId) || !this.map) {
      return () => {}; // Leere Unsubscribe-Funktion zurückgeben
    }

    const consumptionsRef = collection(this.firestore, 'consumptions');
    const q = query(consumptionsRef, where('userId', '==', uid), orderBy('timestamp', 'desc'), limit(100));

    return onSnapshot(q, (snapshot) => {
      const markers: L.Marker[] = [];
      snapshot.forEach(doc => { // Typ für 'doc' wird automatisch erkannt
        const data = doc.data();
        const latLng = this.toLatLng(data['location']);
        if (latLng && this.map) {
          const marker = L.marker(latLng, { icon: this.createMarkerIcon('green') }).addTo(this.map);
          markers.push(marker);
        }
      });
      onMarkersReady(markers);
    });
  }

  private createMarkerIcon(color: string): L.DivIcon {
    const html = `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,.5)"></div>`;
    return L.divIcon({
      html, className: 'custom-map-icon-container',
      iconSize: [26, 26], iconAnchor: [13, 13],
    });
  }

  private toLatLng(loc: any): L.LatLngTuple | null {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length === 2 && !isNaN(loc[0]) && !isNaN(loc[1])) return [loc[0], loc[1]];
    if (loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng)) return [loc.lat, loc.lng];
    if (loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude)) return [loc.latitude, loc.longitude];
    return null;
  }
}