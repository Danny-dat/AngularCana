import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  it('should prerender fallback', () => {
    expect(serverRoutes.length).toBeGreaterThan(0);
    const fallback = serverRoutes.find(r => r.path === '**');
    expect(fallback).toBeTruthy();
    expect(fallback?.renderMode).toBe(RenderMode.Prerender);
  });
});
