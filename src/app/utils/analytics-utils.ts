// src/app/utils/analytics-utils.ts

/**
 * Macht aus Labels (z.B. "Blüte") einen stabilen Firestore-tauglichen Key (z.B. "blute").
 * - entfernt Umlaute/Diakritika
 * - lower-case
 * - ersetzt Nicht-Alnum durch '_'
 */
export function keyify(input: string): string {
  const s = (input ?? '').toString().trim();
  if (!s) return 'unknown';

  // Unicode-normalisieren + Diakritika entfernen
  const noDia = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const key = noDia
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return key || 'unknown';
}

/**
 * Grobe Geo-Zelle (Privacy-friendly). Wir speichern Lat/Lng * 100 als Int.
 * Das entspricht ~1.1km Raster (bei 0.01 Grad), ist also KEIN genauer Standort.
 */
export function geoCellE2(lat: number, lng: number): { latE2: number; lngE2: number; id: string } {
  const latE2 = Math.round(lat * 100);
  const lngE2 = Math.round(lng * 100);
  return { latE2, lngE2, id: `${latE2}_${lngE2}` };
}
