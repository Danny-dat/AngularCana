// karma.conf.js
module.exports = function (config) {
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

  config.set({
    basePath: '',

    // Angular-Karma läuft am stabilsten mit build-angular Framework
    frameworks: ['jasmine', '@angular-devkit/build-angular'],

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      // ✅ wichtig für Angular
      require('@angular-devkit/build-angular/plugins/karma'),
      // UI-Reporter nur lokal (siehe reporters unten)
      ...(isCI ? [] : [require('karma-jasmine-html-reporter')]),
    ],

    client: {
      jasmine: {
        random: false,
      },
      // UI lokal behalten, CI egal
      clearContext: false,
    },

    // Reporter: CI ohne kjhtml (spart Ärger + unnötig)
    reporters: isCI ? ['progress', 'coverage'] : ['progress', 'kjhtml', 'coverage'],

    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }],
      // optional, aber oft hilfreich bei Angular-Pfaden
      fixWebpackSourcePaths: true,
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

    // CI stabil
    autoWatch: !isCI,
    singleRun: isCI,
    restartOnFileChange: !isCI,

    // nicer logs
    colors: !isCI,
    logLevel: config.LOG_INFO,

    // verhindert Hänger wenn irgendwas nicht sauber beendet
    browserNoActivityTimeout: isCI ? 120000 : 30000,
    browserDisconnectTimeout: isCI ? 20000 : 10000,
    browserDisconnectTolerance: isCI ? 2 : 0,
  });
};
