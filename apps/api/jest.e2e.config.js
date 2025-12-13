/* eslint-env node */
/* eslint-disable no-undef */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: './',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  testPathIgnorePatterns: ['<rootDir>/test/catalog.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage-e2e',
  testEnvironment: 'node',
  testTimeout: 20000,
};
