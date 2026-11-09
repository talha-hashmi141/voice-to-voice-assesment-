import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', isolatedModules: true }] },
  collectCoverageFrom: ['**/*.ts', '!**/index.ts', '!main.ts', '!**/*.module.ts', '!**/schema/**'],
  coverageDirectory: '../coverage',
  clearMocks: true,
};

export default config;
