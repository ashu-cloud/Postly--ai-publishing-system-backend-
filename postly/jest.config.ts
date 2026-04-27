import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        // Include Jest types so describe/it/expect are recognised in test files
        types: ['jest', 'node'],
      },   
    }],
  },
  // Run tests serially — avoids DB connection race conditions
  maxWorkers: 1,
  // Longer timeout for integration tests that hit real DB
  testTimeout: 30000,
  // Map @ alias for test files
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Setup files — load env before tests run
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

export default config;
