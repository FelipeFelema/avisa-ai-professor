import type { ReactNode } from 'react';
import { jest } from '@jest/globals';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const ReactRuntime = require('react');
    const Native = require('react-native');
    return ReactRuntime.createElement(Native.Text, null, `REDIRECT:${href}`);
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: Object.assign(({ children }: { children?: ReactNode }) => children, {
    Screen: () => null,
  }),
  Slot: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
