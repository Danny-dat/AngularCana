// src/app/components/dashboard/dashboard.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';

// Interface für ein sauberes Datenmodell
interface Consumable {
  name: string;
  img: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  products: Consumable[] = [
    { name: "Hash", img: "assets/produkte/hash.png" },
    { name: "Blüte", img: "assets/produkte/flower.png" },
    { name: "Öl / Harz", img: "assets/produkte/resin1.png" },
  ];
  devices: Consumable[] = [
    { name: "Joint", img: "assets/devices/joint.png" },
    { name: "Bong", img: "assets/devices/bong.png" },
    { name: "Vaporizer", img: "assets/devices/vaporizer.png" },
    { name: "Pfeife", img: "assets/devices/pfeife.png" },
  ];
  selection = { product: null as string | null, device: null as string | null };

  constructor(private mapService: MapService) { }

  ngOnInit(): void { this.mapService.initializeMap('map-container'); }
  ngOnDestroy(): void { this.mapService.destroyMap(); }
  selectProduct(productName: string): void { this.selection.product = productName; }
  selectDevice(deviceName: string): void { this.selection.device = deviceName; }
  logConsumption(): void { alert('Konsum geloggt!'); }
}