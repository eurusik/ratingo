const unitConfig = require('./jest.config.js');

module.exports = {
  ...unitConfig,
  rootDir: './',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/test/support/e2e-env.setup.ts'],
  collectCoverageFrom: unitConfig.collectCoverageFrom.map((pattern) =>
    pattern.startsWith('!') ? `!src/${pattern.slice(1)}` : `src/${pattern}`,
  ),
  coverageDirectory: './coverage-e2e',
  testTimeout: 20000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^isomorphic-dompurify$': '<rootDir>/__mocks__/isomorphic-dompurify.js',
  },
};
