const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: __dirname });

const ESM_ONLY_PACKAGES = ['ky', '@heroui', 'react-aria-components', '@react-aria', '@react-stately', '@internationalized', 'tailwind-variants', 'tailwind-merge', 'lucide-react', '@vercel', '@serwist', 'serwist'];
const NODE_MODULES_PATTERN_PREFIX = '/node_modules/';

const storefrontJestConfig = createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/app'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.(ts|tsx)'],
});

module.exports = async () => {
  const config = await storefrontJestConfig();
  const nonDependencyPatterns = config.transformIgnorePatterns.filter(
    (pattern) => !pattern.startsWith(NODE_MODULES_PATTERN_PREFIX),
  );
  return {
    ...config,
    transformIgnorePatterns: [
      ...nonDependencyPatterns,
      `${NODE_MODULES_PATTERN_PREFIX}(?!(${ESM_ONLY_PACKAGES.join('|')})/)`,
    ],
  };
};
