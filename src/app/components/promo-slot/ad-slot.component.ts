import { Component, Input, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdService } from '../../services/ad.service';
import type { AdSlotConfig } from '../../models/ad.types';

@Component({
  selector: 'promo-slot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-slot.component.html',
  styleUrls: ['./ad-slot.component.css'],
})
export class AdSlotComponent implements OnDestroy {
  private ads = inject(AdService);
  private sub?: Subscription;

  private _slotId = '';
  cfg?: AdSlotConfig;

  /** aktuell verwendete Bildquelle */
  currentSrc = '';

  /** Fallback-Flags (um Schleifen zu verhindern) */
  private triedSvg = false;
  private triedPng = false;
  private loadedOnce = false;

  @Input() set slotId(value: string) {
    const v = (value || '').trim();
    if (v === this._slotId) return;          // nicht neu laden, wenn gleich
    this._slotId = v;
    this.reload();
  }
  get slotId() { return this._slotId; }

  /** ALT-Text */
  get alt(): string {
    return this.cfg?.alt || this._slotId || 'advertising';
  }

  // --- Pfade immer ABSOLUT (vermeidet Route/SSR-Probleme) ---
  private svgPath(): string     { return `/assets/promo/${this._slotId}/banner.svg`; }
  private pngPath(): string     { return `/assets/promo/${this._slotId}/banner.png`; }
  private genericPath(): string { return `/assets/promo/generic/banner.svg`; }

  private toAbsoluteAssets(url: string): string {
    if (!url) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/assets/')) return url;
    if (url.startsWith('assets/')) return '/' + url;
    return url; // sonst so lassen
  }

  private setSrcOnce(src: string) {
    if (!src) return;
    if (this.currentSrc === src) return;
    this.currentSrc = src;
    // console.log('[ad-slot] set src:', src);
  }

  private reload(): void {
    // reset
    this.sub?.unsubscribe();
    this.cfg = undefined;
    this.loadedOnce = false;
    this.triedSvg = false;
    this.triedPng = false;

    if (!this._slotId) {
      this.setSrcOnce(this.genericPath());
      return;
    }

    // sofort mit SVG beginnen (sichtbar ab Erst-Render)
    this.setSrcOnce(this.svgPath());
    this.triedSvg = true;

    // Config abonnieren (kann imgUrl liefern)
    this.sub = this.ads.slot$(this._slotId).subscribe((c) => {
      this.cfg = c;
      const candidate = (c?.imgUrl && this.toAbsoluteAssets(c.imgUrl)) || this.svgPath();
      // Nur umstellen, wenn wir noch nichts erfolgreich geladen haben
      if (!this.loadedOnce) {
        this.setSrcOnce(candidate);
        this.triedSvg = candidate.endsWith('.svg');
        this.triedPng = candidate.endsWith('.png');
      }
    });
  }

  onImgLoad() {
    this.loadedOnce = true;
    // console.log('[ad-slot] loaded:', this.currentSrc);
  }

  /** Fehlerkaskade: svg → png → generic (einmalig) */
  onImgError() {
    // console.warn('[ad-slot] error for', this.currentSrc);
    if (this.triedSvg && !this.triedPng) {
      this.triedPng = true;
      this.setSrcOnce(this.pngPath());
      return;
    }
    if (this.currentSrc !== this.genericPath()) {
      this.setSrcOnce(this.genericPath());
      return;
    }
    // Ab hier nicht weiter umschalten
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
