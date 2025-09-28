// src/app/components/dashboard/dashboard.ts
import { Component, OnDestroy, OnInit, AfterViewInit, Inject, NgZone, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { MapService } from '../../services/map.service';

interface Consumable { name: string; img: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  products: Consumable[] = [
    { name: 'Hash',   img: 'assets/produkte/hash.png'   },
    { name: 'Blüte',  img: 'assets/produkte/flower.png' },
    { name: 'Öl / Harz', img: 'assets/produkte/resin1.png' },
  ];
  devices: Consumable[] = [
    { name: 'Joint',     img: 'assets/devices/joint.png'     },
    { name: 'Bong',      img: 'assets/devices/bong.png'      },
    { name: 'Vaporizer', img: 'assets/devices/vaporizer.png' },
    { name: 'Pfeife',    img: 'assets/devices/pfeife.png'    },
  ];

  selection = { product: null as string | null, device: null as string | null };

  constructor(
    private readonly mapService: MapService,
    @Inject(PLATFORM_ID) private readonly pid: Object,
    private readonly zone: NgZone
  ) {}

  ngOnInit(): void {
    // nichts — Map erst nach View-Init initialisieren
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.pid)) return; // SSR: aussteigen
    // minimal warten, bis das DIV sicher im Layout ist (nach Navigation):
    requestAnimationFrame(() => {
      this.zone.runOutsideAngular(() => this.mapService.initializeMap('map-container'));
    });
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
  }

  selectProduct(name: string) { this.selection.product = name; }
  selectDevice(name: string)  { this.selection.device  = name; }
  logConsumption() { 
    // nach einer UI-Änderung die Map neu berechnen:
    this.mapService.invalidateSizeSoon();
    alert('Konsum geloggt!');
  }
}
