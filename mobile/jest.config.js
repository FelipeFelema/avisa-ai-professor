const expoPreset = require('jest-expo/jest-preset');
const [babelTransformer, babelOptions] = expoPreset.transform['\\.[jt]sx?$'];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transform: {
    ...expoPreset.transform,
    '\\.[jt]sx?$': [
      babelTransformer,
      {
        ...babelOptions,
        // Only Jest uses this transform; Metro keeps its normal import handling.
        plugins: [
          ...(babelOptions.plugins ?? []),
          require.resolve('./tests/helpers/transform-dynamic-import.cjs'),
        ],
      },
    ],
  },
  testMatch: ['<rootDir>/tests/**/*.spec.[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/app/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/helpers/push.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/index.ts', '!src/types/**'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    './src/hooks/useDeleteAnnouncement.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/hooks/useDeleteClassroom.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/hooks/useUpdateAnnouncement.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/hooks/useUpdateProfile.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/validations/updateProfile.schema.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/components/ui/ConfirmationDialog.tsx': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/providers/AuthProvider.tsx': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './src/lib/api.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};
