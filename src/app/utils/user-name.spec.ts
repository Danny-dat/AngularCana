import { normalizeUnifiedUserName, normalizeUnifiedUserNameKey } from './user-name';

describe('user-name utils', () => {
  describe('normalizeUnifiedUserName', () => {
    it('normalizes a handle according to the rules', () => {
      const input = '   @@Ma x!#- 123  ';
      // trim -> '@@Ma x!#- 123'
      // remove leading @ -> 'Ma x!#- 123'
      // spaces -> 'Ma_x!#-_123'
      // strip invalid -> 'Ma_x_123'
      expect(normalizeUnifiedUserName(input)).toBe('Ma_x_123');
    });

    it('handles nullish input', () => {
      expect(normalizeUnifiedUserName(undefined as any)).toBe('');
      expect(normalizeUnifiedUserName(null as any)).toBe('');
    });

    it('returns empty string for empty-ish values', () => {
      expect(normalizeUnifiedUserName('')).toBe('');
      // @ only
      expect(normalizeUnifiedUserName('   @@@   ')).toBe('');
    });

    it('limits to 20 characters', () => {
      const long = '@' + 'A'.repeat(50) + '   ';
      const out = normalizeUnifiedUserName(long);
      expect(out.length).toBe(20);
      expect(out).toBe('A'.repeat(20));
    });
  });

  describe('normalizeUnifiedUserNameKey', () => {
    it('lowercases the normalized handle', () => {
      expect(normalizeUnifiedUserNameKey('  @MaX  ')).toBe('max');
      expect(normalizeUnifiedUserNameKey('  @Ma X  ')).toBe('ma_x');
    });
  });
});
