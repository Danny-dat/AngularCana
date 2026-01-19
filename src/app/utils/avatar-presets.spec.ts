import { AVATAR_PRESETS } from './avatar-presets';

describe('avatar-presets', () => {
  it('should contain presets', () => {
    expect(Array.isArray(AVATAR_PRESETS)).toBeTrue();
    expect(AVATAR_PRESETS.length).toBeGreaterThan(0);
  });

  it('should have unique keys', () => {
    const keys = AVATAR_PRESETS.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
