module.exports = function (config) {
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
      check: { global: { statements: 80, branches: 70, functions: 80, lines: 80 } },
    },

    // Headless-Settings
    browsers: ['ChromeHeadlessCI'],
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
