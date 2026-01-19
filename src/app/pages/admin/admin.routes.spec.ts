import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES', () => {
  it('should include dashboard redirect', () => {
    expect(ADMIN_ROUTES.length).toBeGreaterThan(0);
    const root = ADMIN_ROUTES[0];
    expect(root.children?.some(c => c.path === '' && c.redirectTo === 'dashboard')).toBeTrue();
  });
});
