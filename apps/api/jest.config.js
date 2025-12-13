module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/main.(t|j)s',
    '!**/app.module.(t|j)s',
    '!**/*.module.(t|j)s',
    '!**/index.(t|j)s',
    '!**/config/*.config.(t|j)s',
    '!**/modules/auth/infrastructure/strategies/*.(t|j)s',
    '!**/modules/auth/infrastructure/decorators/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
