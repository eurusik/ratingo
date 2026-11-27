module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/eval'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@ratingo/ai-core$': '<rootDir>/../../../packages/ai-core/src',
    '^@ratingo/ai-ops-tools$': '<rootDir>/../../../packages/ai-ops-tools/src',
    '^@ratingo/node-telemetry$': '<rootDir>/../../../packages/node-telemetry/src',
  },
};
