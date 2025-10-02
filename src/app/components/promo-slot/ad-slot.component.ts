// src/app/components/add-slot/ad-slot.component.ts
import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { AdService } from '../../services/ad.service';
import type { AdSlotConfig } from '../../models/ad.types';

@Component({
  selector: 'promo-slot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./ad-slot.component.html`,
  styleUrls: [`./ad-slot.component.css`,
  ],
})
export class AdSlotComponent {
  private ads = inject(AdService);

  _slotId = '';
  vm$: Observable<AdSlotConfig | undefined> = of(undefined);

  /** Fallback-Pfad: assets/promo/<slotId>/banner.png */
  get fallbackSrc() {
    return `assets/promo/${this._slotId}/banner.svg`;
  }

  @Input() set slotId(value: string) {
    this._slotId = value;
    this.vm$ = this.ads.slot$(value);
  }

  // Debug (optional)
  // die onload-Funktion gibt den aktuellen Bildpfad an
  // onLoad(u: string) { console.log('[ad-slot] loaded:', this._slotId, u); }
  onErr(u: string) {
    console.warn('[ad-slot] ERROR:', this._slotId, u);
  }
}
