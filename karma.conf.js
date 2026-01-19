module.exports = function (config) {
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        random: false,
      },
      clearContext: false,
    },
    reporters: ['progress', 'kjhtml', 'coverage'],
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reports: ['html', 'text-summary', 'lcovonly'],
      check: { global: { statements: 100, branches: 100, functions: 100, lines: 100 } },
    },

    // Headless-Settings
    // Local dev: run with a real Chrome window.
    // CI: run headless (more reliable + works without a display).
    browsers: [isCI ? 'ChromeHeadlessCI' : 'Chrome'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--headless=new', // neuer Headless-Mode (Chrome 109+)
          '--disable-gpu',
          '--no-sandbox', // wichtig in CI/Container
          '--disable-dev-shm-usage',
        ],
      },
    },

    // Für CI oft sinnvoll:
    singleRun: true,
    restartOnFileChange: false,
  });
};
