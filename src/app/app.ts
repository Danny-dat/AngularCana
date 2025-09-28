// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// <- WICHTIG: Pfad an dein Projekt anpassen, falls anders
import { AppHeaderComponent } from './components/app-header/app-header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, AppHeaderComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent {}
