import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import * as L from 'leaflet'; // Leaflet importieren

// Einmaliger Fix für die Standard-Icons von Leaflet in Angular
const iconDefault = L.icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: L.Map | null = null;

  constructor(private firestore: Firestore) { }

  /**
   * Initialisiert und rendert die Leaflet-Karte in einem HTML-Container.
   */
  initializeMap(elementId: string): L.Map {
    // Falls eine alte Karte existiert, diese zuerst entfernen
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(elementId).setView([51.16, 10.45], 6); // Zentrum Deutschland

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);
    
    // Wichtig, um die Kartengrösse korrekt zu rendern, falls sie in einem Tab versteckt war
    setTimeout(() => this.map?.invalidateSize(), 100);

    return this.map;
  }

  /**
   * Zerstört die Karteninstanz, um Speicherlecks zu vermeiden.
   */
  destroyMap() {
    this.map?.remove();
    this.map = null;
  }
  
  /**
   * Streamt die Konsum-Standorte eines Nutzers und zeichnet sie als Marker auf die Karte.
   * Gibt eine Funktion zurück, um den Listener zu beenden.
   */
  listenForConsumptionMarkers(uid: string, onMarkersReady: (markers: L.Marker[]) => void): Unsubscribe {
    if (!this.map) return () => {};
    
    const consumptionsRef = collection(this.firestore, 'consumptions');
    const q = query(consumptionsRef, where('userId', '==', uid), orderBy('timestamp', 'desc'), limit(100));

    // onSnapshot ist die Echtzeit-Funktion von Firestore
    return onSnapshot(q, (snapshot) => {
      const markers: L.Marker[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const latLng = this.toLatLng(data['location']);
        if (latLng && this.map) {
          // Erstellt einen grünen Marker und fügt ihn zur Karte hinzu
          const marker = L.marker(latLng, { icon: this.createMarkerIcon('green') }).addTo(this.map);
          markers.push(marker);
        }
      });
      onMarkersReady(markers);
    });
  }

  /**
   * Erstellt ein benutzerdefiniertes HTML-Icon für die Marker.
   */
  private createMarkerIcon(color: string): L.DivIcon {
    const html = `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,.5)"></div>`;
    return L.divIcon({
      html,
      className: 'custom-map-icon-container', // Leere Klasse, um Leaflet-Standardstile zu vermeiden
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  /**
   * Konvertiert verschiedene Standortformate in ein Leaflet-kompatibles Format.
   */
  private toLatLng(loc: any): L.LatLngTuple | null {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length === 2 && !isNaN(loc[0]) && !isNaN(loc[1])) return [loc[0], loc[1]];
    if (loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng)) return [loc.lat, loc.lng];
    if (loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude)) return [loc.latitude, loc.longitude];
    return null;
  }
}