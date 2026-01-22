import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'public-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="public-shell">
      <div class="public-container">
        <router-outlet></router-outlet>
      </div>
    </main>
  `,
})
export class PublicLayoutComponent {}
