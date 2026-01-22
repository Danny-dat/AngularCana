import { appConfig } from './app.config';

describe('appConfig', () => {
  it('should define application providers', () => {
    expect(appConfig).toBeTruthy();
    expect((appConfig.providers?.length ?? 0)).toBeGreaterThan(0);
  });
});
