// karma.conf.js
module.exports = function (config) {
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

  config.set({
    basePath: '',

    // ✅ nur Jasmine – kein @angular-devkit/build-angular mehr
    frameworks: ['jasmine'],

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      ...(isCI ? [] : [require('karma-jasmine-html-reporter')]),
    ],

    client: {
      jasmine: {
        random: false, // ✅ Random aus
      },
      clearContext: false,
    },

    reporters: isCI ? ['progress', 'coverage'] : ['progress', 'kjhtml', 'coverage'],

    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }],
      includeAllSources: true,
    },

    browsers: [isCI ? 'ChromeHeadlessCI' : 'Chrome'],

    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-translate',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--remote-debugging-port=9222',
        ],
      },
    },

    autoWatch: !isCI,
    singleRun: isCI,
    restartOnFileChange: !isCI,

    colors: !isCI,
    logLevel: config.LOG_INFO,

    browserNoActivityTimeout: isCI ? 120000 : 30000,
    browserDisconnectTimeout: isCI ? 20000 : 10000,
    browserDisconnectTolerance: isCI ? 2 : 0,
  });
};
