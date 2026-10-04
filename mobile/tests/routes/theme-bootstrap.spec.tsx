import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import RootLayout from '../../app/_layout';
import AppLayout from '../../app/(app)/_layout';
import { useAuth } from '@/hooks/useAuth';
import { AppProvider } from '@/providers/AppProvider';
import { darkTheme } from '@/theme';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: NativeText, View: NativeView } = require('react-native');
  const Stack = Object.assign(
    ({
      children,
      screenOptions,
    }: {
      children?: ReactNode;
      screenOptions?: Record<string, unknown>;
    }) =>
      React.createElement(
        NativeView,
        { testID: 'route-stack' },
        React.createElement(NativeText, { testID: 'stack-options' }, JSON.stringify(screenOptions)),
        children,
      ),
    {
      Screen: ({ name }: { name: string }) =>
        React.createElement(NativeText, { testID: 'stack-screen' }, name),
    },
  );

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(NativeText, { testID: 'redirect' }, href),
    Stack,
  };
});

jest.mock('expo-status-bar', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');
  return {
    StatusBar: (props: Record<string, unknown>) =>
      React.createElement(NativeView, { ...props, testID: 'root-status-bar' }),
  };
});

jest.mock('@/providers/AuthProvider', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');
  return {
    AuthProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(NativeView, { testID: 'auth-provider' }, children),
  };
});

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockGetItem = jest.mocked(AsyncStorage.getItem);
const mockUseAuth = jest.mocked(useAuth);

type SessionMode = 'loading' | 'logged-out' | 'expired' | 'account-a' | 'account-b';

const sessionValues = {
  loading: { isAuthenticated: false, isLoading: true },
  'logged-out': { isAuthenticated: false, isLoading: false },
  expired: { isAuthenticated: false, isLoading: false },
  'account-a': { isAuthenticated: true, isLoading: false },
  'account-b': { isAuthenticated: true, isLoading: false },
} as const;

function SessionHarness({ mode }: { mode: SessionMode }) {
  mockUseAuth.mockReturnValue(sessionValues[mode] as never);

  return (
    <View>
      <Text testID="session-mode">{mode}</Text>
      <AppLayout />
    </View>
  );
}

function sessionTree(mode: SessionMode) {
  return (
    <AppProvider>
      <SessionHarness mode={mode} />
    </AppProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue('dark');
});

describe('theme startup and session integration', () => {
  it('holds the root stack and status bar until a dark cold-start or restart read resolves', async () => {
    const read = deferred<string | null>();
    mockGetItem.mockReturnValueOnce(read.promise);

    const view = await render(<RootLayout />);

    expect(view.queryByTestId('auth-provider')).toBeNull();
    expect(view.queryByTestId('route-stack')).toBeNull();
    expect(view.queryByTestId('root-status-bar')).toBeNull();
    expect(mockGetItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      read.resolve('dark');
      await read.promise;
    });

    await waitFor(() => {
      expect(view.getByTestId('route-stack')).toBeTruthy();
      expect(view.getByTestId('root-status-bar').props.style).toBe('light');
      expect(view.getByTestId('root-status-bar').props.backgroundColor).toBeUndefined();
      expect(view.getByTestId('root-theme-surface').props.style.backgroundColor).toBe(
        darkTheme.colors.background,
      );
      expect(JSON.parse(view.getByTestId('stack-options').props.children).contentStyle).toEqual({
        backgroundColor: darkTheme.colors.background,
      });
    });
    expect(view.getByTestId('auth-provider')).toBeTruthy();
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it('preserves the restored theme through loading, logout, expiration, and account changes', async () => {
    const view = await render(sessionTree('loading'));

    await waitFor(() => expect(view.getByTestId('session-mode').props.children).toBe('loading'));
    expect(view.getByTestId('auth-provider')).toBeTruthy();
    expect(view.getByText('Carregando...').props.style.color).toBe(darkTheme.colors.text);

    await view.rerender(sessionTree('logged-out'));
    expect(view.getByTestId('redirect').props.children).toBe('/login');

    await view.rerender(sessionTree('account-a'));
    expect(view.getByTestId('route-stack')).toBeTruthy();
    expect(view.getAllByTestId('stack-screen').map((screen) => screen.props.children)).toEqual([
      '(tabs)',
      'profile/delete-account',
    ]);

    await view.rerender(sessionTree('account-b'));
    expect(view.getByTestId('route-stack')).toBeTruthy();
    expect(view.getByTestId('stack-options').props.children).toContain(darkTheme.colors.background);

    await view.rerender(sessionTree('expired'));
    expect(view.getByTestId('redirect').props.children).toBe('/login');
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
