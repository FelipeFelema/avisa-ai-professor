import * as SecureStore from 'expo-secure-store';
import { jest } from '@jest/globals';

export const secureStoreMock = jest.mocked(SecureStore);
export const routerMock = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

export function resetTestMocks() {
  jest.clearAllMocks();
}
