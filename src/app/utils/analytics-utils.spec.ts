import { geoCellE2, keyify } from './analytics-utils';

describe('analytics-utils', () => {
  it('keyify should normalize strings', () => {
    expect(keyify('  Hallo Welt  ')).toBe('hallo_welt');
    // For empty / non-alphanumeric inputs the implementation returns 'unknown'
    expect(keyify('---')).toBe('unknown');
  });

  it('geoCellE2 should bucket lat/lon', () => {
    const cell = geoCellE2(52.52, 13.405); // Berlin
    expect(cell.latE2).toBe(5252);
    expect(cell.lngE2).toBe(1341);
    expect(cell.id).toBe('5252_1341');
  });
});
