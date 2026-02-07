export interface AdSlotConfig {
  id: string;
  imgUrl: string; // endgültige URL (mit ?v= Cache-Bust)

  /** Optional: Wenn gesetzt, kommt das Bild direkt aus Firestore/Storage (hat Vorrang vor /assets Overrides) */
  manualImgUrl?: string | null;
  linkUrl?: string | null;
  /** Link deaktivieren (falls du das Banner nur anzeigen willst) */
  linkEnabled?: boolean;

  /** Priorisierte Server-Dateiendung (damit alte Dateien den neuen Slot nicht "ueberlagern") */
  activeExt?: 'svg' | 'webp' | 'png' | 'jpg';

  /** Letzte Konfig-Aenderung (z.B. fuer Cache-Bust/Refresh) */
  configUpdatedAt?: string;
  alt?: string;
  /** Letzte Bild-Aenderung (Version) */
  updatedAt?: string; // ISO
}
