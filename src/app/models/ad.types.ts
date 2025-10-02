export interface AdSlotConfig {
  id: string;
  imgUrl: string;       // endgültige URL (mit ?v= Cache-Bust)
  linkUrl?: string;
  alt?: string;
  updatedAt?: string;   // ISO
}