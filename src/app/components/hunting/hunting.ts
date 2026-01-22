import { Component, ChangeDetectorRef, Input, Output, EventEmitter, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

// Ein Typ für die Auswahl, um den Code sauberer zu machen
export interface HuntSelection {
  animal: string | null;
  weapon: string | null;
  location: string | null;
}

interface Huntable {
  name: string;
  img: string;
}

@Component({
  selector: 'app-hunting', // Dieser Selector wird im Dashboard verwendet
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hunting.html',
  styleUrl: './hunting.css',
})
export class HuntingComponent {
  // @Input() empfängt Daten von der Eltern-Komponente (Dashboard)
  @Input() isSaving: boolean = false;
  @Input() justSaved: boolean = false;
  @Input() savedAt: Date | null = null;

  // @Output() sendet ein Event mit den ausgewählten Daten an die Eltern-Komponente
  @Output() logRequest = new EventEmitter<HuntSelection>();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  animals: Huntable[] = [
    { name: 'Hirsch', img: 'assets/animals/Deer.png' },
    { name: 'Wildschwein', img: 'assets/animals/WildBoar.png' },
    { name: 'Hase', img: 'assets/animals/Hare.png' },
    { name: 'Kaninchen', img: 'assets/animals/Rabbit.png' },
    { name: 'Pharsan', img: 'assets/animals/Phesant.png' },
    { name: 'Rebhun', img: 'assets/animals/Grouse.png' },
  ];
  weapons: Huntable[] = [
    { name: 'Gewehr', img: 'assets/weapons/BoltActionRifle.png' },
    { name: 'Bogen', img: 'assets/weapons/HuntingBow.png' },
    { name: 'Schrot', img: 'assets/weapons/Shotgun.png' },
  ];
  locations: Huntable[] = [
    { name: 'Wald', img: 'assets/locations/ForesStand.svg' },
    { name: 'Feld', img: 'assets/locations/GroundBlind.svg' },
    { name: 'Hochsitz', img: 'assets/locations/Treestand.svg' },
    { name: 'Gebirge', img: 'assets/locations/MountainOutlook.svg' },
  ];

  selection: HuntSelection = {
    animal: null,
    weapon: null,
    location: null,
  };

  activeDropdown: 'animal' | 'weapon' | 'location' | null = null;

  toggleDropdown(menu: 'animal' | 'weapon' | 'location' | null) {
    this.activeDropdown = this.activeDropdown === menu ? null : menu;
  }

  selectAnimal(name: string) {
    this.selection.animal = name;
    this.activeDropdown = 'weapon';
    this.cdr.markForCheck();
  }

  selectWeapon(name: string) {
    this.selection.weapon = name;
    this.activeDropdown = 'location';
    this.cdr.markForCheck();
  }

  selectLocation(name: string) {
    this.selection.location = name;
    this.activeDropdown = null;
    this.cdr.markForCheck();
  }

  // Diese Methode sendet die Auswahl an das Dashboard, anstatt selbst zu speichern.
  logHunt() {
    this.logRequest.emit(this.selection);
  }

  // Diese Methode wird vom Dashboard aufgerufen, um das Formular zurückzusetzen.
  public resetSelection(): void {
    this.selection = { animal: null, weapon: null, location: null };
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
