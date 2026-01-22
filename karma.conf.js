module.exports = function (config) {
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],

    client: {
      jasmine: { random: false },
      clearContext: false,
    },

    reporters: ['progress', 'kjhtml', 'coverage'],
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: ['html', 'text-summary', 'lcovonly'],
      includeAllSources: true,
      check: isCI
        ? { global: { statements: 80, branches: 80, functions: 80, lines: 80 } }
        : undefined,
    },

    browsers: [isCI ? 'ChromeHeadlessCI' : 'Chrome'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      },
    },

    autoWatch: !isCI,
    singleRun: isCI,
    restartOnFileChange: !isCI,
  });
};
