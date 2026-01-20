// This spec ensures that src/test.ts is executed when using the experimental
// @angular/build:unit-test builder + Karma, which may not automatically
// include src/test.ts as an entrypoint.
//
// It registers global providers (Firebase/Auth/Firestore, Router, HttpTesting, …)
// via the top-level beforeEach() in src/test.ts.

import './test';

describe('Global test setup', () => {
  it('should be loaded', () => {
    expect(true).toBeTrue();
  });
});
