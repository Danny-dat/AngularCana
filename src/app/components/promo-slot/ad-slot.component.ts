// src/app/components/promo-slot/ad-slot.component.ts
import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { AdService } from '../../services/ad.service';
import type { AdSlotConfig } from '../../models/ad.types';

@Component({
  selector: 'promo-slot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-slot.component.html',
  styleUrls: ['./ad-slot.component.css'],
})
export class AdSlotComponent {
  private ads = inject(AdService);

  private readonly DEBUG = true;

  _slotId = '';
  vm$: Observable<AdSlotConfig | undefined> = of(undefined);

  /** Aktuelle Bildquelle, an die das <img> gebunden ist */
  imgSrc = '';

  /** URLs, die bereits fehlgeschlagen sind – nie wieder setzen */
  private badUrls = new Set<string>();

  /** Fallbackfortschritt */
  private tried = { slotSvg: false, slotPng: false, genSvg: false, genPng: false };

  @Input() set slotId(value: string) {
    this._slotId = value;

    // 1) Sofort sichtbarer Default
    this.resetFallbacks();
    this.setImgSrc(this.slotSvgPath(), 'init(slotSvg)');

    // 2) Auf Service hören – nur *valide* (nicht-bad) URLs übernehmen
    this.vm$ = this.ads.slot$(value).pipe(
      filter((vm): vm is AdSlotConfig => !!vm), // undefined überspringen
      distinctUntilChanged((a, b) => (a?.imgUrl ?? '') === (b?.imgUrl ?? '')),
      tap((vm) => {
        this.resetFallbacks(); // neue Quelle → Kaskade neu
        if (vm.imgUrl && !this.badUrls.has(vm.imgUrl)) {
          this.setImgSrc(vm.imgUrl, 'vm.imgUrl');
        } else {
          // Wenn vm-URL bereits als "bad" markiert ist, bleib auf aktuellem/fallback
          if (this.DEBUG) console.warn('[promo-slot] skip bad vm url', vm.imgUrl);
        }
      }),
    );
  }

  /** Absolute Pfade */
  private slotSvgPath() {
    return `/assets/promo/${this._slotId}/banner.svg`;
  }
  private slotPngPath() {
    return `/assets/promo/${this._slotId}/banner.png`;
  }
  private genSvgPath() {
    return `/assets/promo/generic/banner.svg`;
  }
  private genPngPath() {
    return `/assets/promo/generic/banner.png`;
  }

  /** Bei Fehler: aktuelle URL merken und zur nächsten sinnvollen Quelle wechseln */
  onImgError() {
    if (this.imgSrc) this.badUrls.add(this.imgSrc);

    const next = !this.tried.slotSvg
      ? ((this.tried.slotSvg = true), this.slotSvgPath())
      : !this.tried.slotPng
        ? ((this.tried.slotPng = true), this.slotPngPath())
        : !this.tried.genSvg
          ? ((this.tried.genSvg = true), this.genSvgPath())
          : !this.tried.genPng
            ? ((this.tried.genPng = true), this.genPngPath())
            : null;

    if (next && !this.badUrls.has(next)) {
      if (this.DEBUG) console.warn('[promo-slot] ERROR → fallback', this._slotId, '→', next);
      this.setImgSrc(next, 'onImgError');
    } else {
      console.warn('[promo-slot] all fallbacks failed for', this._slotId);
    }
  }

  onImgLoad(ev: Event) {
    if (!this.DEBUG) return;
    const el = ev.target as HTMLImageElement | null;
    console.debug('[promo-slot] LOAD', this._slotId, '←', el?.currentSrc || this.imgSrc);
  }

  private setImgSrc(src: string, reason?: string) {
    this.imgSrc = src;
    if (this.DEBUG && reason)
      console.debug('[promo-slot] SRC', this._slotId, '←', src, `(${reason})`);
  }

  private resetFallbacks() {
    this.tried = { slotSvg: false, slotPng: false, genSvg: false, genPng: false };
  }
}
