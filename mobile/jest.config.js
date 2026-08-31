/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/app/'],
};
