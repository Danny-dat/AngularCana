// This spec is kept as a tiny smoke-test that the global test setup ran.
//
// IMPORTANT:
// With @angular/build:unit-test we use:
//  - options.providersFile: src/test-providers.ts
//  - options.setupFiles:    src/test-setup.ts
// Therefore we MUST NOT import the legacy src/test.ts entrypoint here,
// otherwise Angular will try to create a second testing platform and crash
// with NG0400 ("A platform with a different configuration has been created").

describe('Global test setup', () => {
  it('should be loaded', () => {
    expect(true).toBeTrue();
  });
});
