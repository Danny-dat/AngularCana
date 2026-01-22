// src/app/services/theme.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private r: Renderer2;
  private KEY = 'pref-theme';

  constructor(rf: RendererFactory2) {
    this.r = rf.createRenderer(null, null);
  }

  getTheme(): Theme {
    try {
      const t = localStorage.getItem(this.KEY) as Theme | null;
      if (t === 'light' || t === 'dark') return t;
    } catch {}
    if (document.body.classList.contains('theme-dark')) return 'dark';
    return 'light';
  }

  setTheme(mode: Theme) {
    const body = document.body;
    this.r.removeClass(body, 'theme-light');
    this.r.removeClass(body, 'theme-dark');
    this.r.addClass(body, mode === 'dark' ? 'theme-dark' : 'theme-light');
    try {
      localStorage.setItem(this.KEY, mode);
    } catch {}
  }
}
