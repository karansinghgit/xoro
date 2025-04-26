module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'], // Look for tests in packages directory
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  // Setup files after env for frontend tests (e.g., React Testing Library)
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // Uncomment and create this file if needed

  // Coverage configuration (optional)
  // collectCoverage: true,
  // coverageDirectory: "coverage",
  // coverageReporters: ["json", "lcov", "text", "clover"],
  // collectCoverageFrom: [
  //   "packages/**/*.{ts,tsx}",
  //   "!packages/**/dist/**",
  //   "!packages/**/node_modules/**",
  //   "!packages/**/index.ts", // Often just exports
  // ],

  // Handle module name mapping if needed (e.g., for path aliases)
  // moduleNameMapper: {
  //   '^@/(.*)$': '<rootDir>/packages/frontend/src/$1',
  // },
};
