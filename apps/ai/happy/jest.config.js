module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@ratingo/ai-core$': '<rootDir>/../../../../packages/ai-core/src',
    '^@ratingo/node-telemetry$': '<rootDir>/../../../../packages/node-telemetry/src',
  },
};
