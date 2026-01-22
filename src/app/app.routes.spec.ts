import { routes } from './app.routes';

function flatten(rs: any[]): any[] {
  const out: any[] = [];
  for (const r of rs ?? []) {
    out.push(r);
    if (r?.children) out.push(...flatten(r.children));
  }
  return out;
}

describe('routes', () => {
  it('should define at least one route', () => {
    expect(Array.isArray(routes)).toBeTrue();
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should include a login route', () => {
    const all = flatten(routes as any);
    expect(all.some(r => r?.path === 'login')).toBeTrue();
  });

  it('should include a fallback route', () => {
    const all = flatten(routes as any);
    expect(all.some(r => r?.path === '**')).toBeTrue();
  });
});
