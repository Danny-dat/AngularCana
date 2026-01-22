import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../components/app-header/app-header';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent],
  template: `
    <div class="app-shell">
      <app-header></app-header>

      <main class="app-main">
        <div class="app-container">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
})
export class AppLayoutComponent {}
