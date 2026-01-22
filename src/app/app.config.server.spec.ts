import { config } from './app.config.server';

describe('server app config', () => {
  it('should merge configs', () => {
    expect(config).toBeTruthy();
    expect((config.providers?.length ?? 0)).toBeGreaterThan(0);
  });
});
