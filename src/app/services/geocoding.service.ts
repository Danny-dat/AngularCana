import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

/**
 * Lightweight Geocoding via OpenStreetMap Nominatim.
 * Spark-friendly (no billing) – avoid calling on every keystroke.
 */
export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
};

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  constructor(private http: HttpClient) {}

  /**
   * Returns up to `limit` results for the given query.
   * NOTE: Nominatim has rate limits – call on submit or a dedicated "Check address" button.
   */
  geocode(query: string, limit = 5): Observable<GeocodeResult[]> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('q', query)
      .set('limit', String(limit))
      .set('addressdetails', '1')
      .set('accept-language', 'de');

    return this.http
      .get<NominatimItem[]>('https://nominatim.openstreetmap.org/search', { params })
      .pipe(
        map((items) =>
          (items ?? []).map((i) => ({
            lat: Number(i.lat),
            lng: Number(i.lon),
            label: i.display_name,
          }))
        )
      );
  }
}
