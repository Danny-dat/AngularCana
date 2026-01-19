import { geoCellE2, keyify } from './analytics-utils';

describe('analytics-utils', () => {
  it('keyify should normalize strings', () => {
    expect(keyify('  Hallo Welt  ')).toBe('hallo_welt');
    expect(keyify('---')).toBe('');
  });

  it('geoCellE2 should bucket lat/lon', () => {
    const cell = geoCellE2(52.52, 13.405); // Berlin
    expect(cell).toContain('52');
    expect(cell).toContain('13');
  });
});
