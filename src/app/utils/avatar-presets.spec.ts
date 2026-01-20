import { AVATAR_PRESETS } from './avatar-presets';

describe('avatar-presets', () => {
  it('should contain presets', () => {
    expect(Array.isArray(AVATAR_PRESETS)).toBeTrue();
    expect(AVATAR_PRESETS.length).toBeGreaterThan(0);
  });

  it('should have unique ids', () => {
    const ids = AVATAR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have label + path for each preset', () => {
    for (const p of AVATAR_PRESETS) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
      expect(typeof p.path).toBe('string');
      expect(p.path.startsWith('assets/')).toBeTrue();
    }
  });
});
