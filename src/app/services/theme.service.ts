// src/app/services/theme.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private r: Renderer2;
  constructor(rf: RendererFactory2) { this.r = rf.createRenderer(null, null); }

  setTheme(mode: 'light'|'dark') {
    const body = document.body;
    this.r.removeClass(body, 'theme-light');
    this.r.removeClass(body, 'theme-dark');
    this.r.addClass(body, mode === 'dark' ? 'theme-dark' : 'theme-light');
  }
}
