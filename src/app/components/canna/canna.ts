import { Component, ChangeDetectorRef, Input, Output, EventEmitter, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

// Ein Typ für die Auswahl, um den Code sauberer zu machen
export interface ConsumptionSelection {
  product: string | null;
  device: string | null;
  location: string | null;
}

interface Consumable {
  name: string;
  img: string;
}

@Component({
  selector: 'app-canna', // Dieser Selector wird im Dashboard verwendet
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canna.html',
  styleUrl: './canna.css',
})
export class CannaComponent {
  // @Input() empfängt Daten von der Eltern-Komponente (Dashboard)
  @Input() isSaving: boolean = false;
  @Input() justSaved: boolean = false;
  @Input() savedAt: Date | null = null;

  // @Output() sendet ein Event mit den ausgewählten Daten an die Eltern-Komponente
  @Output() logRequest = new EventEmitter<ConsumptionSelection>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  products: Consumable[] = [
    { name: 'Blüte', img: 'assets/produkte/flower.png' },
    { name: 'Hash', img: 'assets/produkte/hash.png' },
    { name: 'Harz', img: 'assets/produkte/resin1.png' },
  ];
  devices: Consumable[] = [
    { name: 'Joint', img: 'assets/devices/joint.png' },
    { name: 'Bong', img: 'assets/devices/bong.png' },
    { name: 'Vaporizer', img: 'assets/devices/vaporizer.png' },
    { name: 'Pfeife', img: 'assets/devices/pfeife.png' },
  ];
  locations: Consumable[] = [
    { name: 'Küche', img: 'assets/locations/kitchen.svg' },
    { name: 'Badezimmer', img: 'assets/locations/bathroom.svg' },
    { name: 'Garten', img: 'assets/locations/garden.svg' },
    { name: 'Wohnzimmer', img: 'assets/locations/livingroom.svg' },
  ];

  selection: ConsumptionSelection = {
    product: null,
    device: null,
    location: null,
  };

  activeDropdown: 'product' | 'device' | 'location' | null = null;

  toggleDropdown(menu: 'product' | 'device' | 'location' | null) {
    this.activeDropdown = this.activeDropdown === menu ? null : menu;
  }

  selectProduct(name: string) {
    this.selection.product = name;
    this.activeDropdown = 'device';
    this.cdr.markForCheck();
  }

  selectDevice(name: string) {
    this.selection.device = name;
    this.activeDropdown = 'location';
    this.cdr.markForCheck();
  }

  selectLocation(name: string) {
    this.selection.location = name;
    this.activeDropdown = null;
    this.cdr.markForCheck();
  }

  // Diese Methode sendet die Auswahl an das Dashboard, anstatt selbst zu speichern.
  logConsumption() {
    this.logRequest.emit(this.selection);
  }

  // Diese Methode wird vom Dashboard aufgerufen, um das Formular zurückzusetzen.
  public resetSelection(): void {
    this.selection = { product: null, device: null, location: null };
    this.cdr.markForCheck();
  }

  onImgError(ev: Event, _kind: string) {
    const img = ev.target as HTMLImageElement;
    if (img) {
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#9aa0a6">n/a</text></svg>`,
      )}`;
      img.alt = 'Platzhalter';
    }
  }
}
