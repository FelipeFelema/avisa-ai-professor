import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/hooks/useAuth';
import { setSessionNotice } from '@/lib/session-notice';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData } from '@/types/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from '../../app/(app)/_layout';
import LoginScreen from '../../app/(auth)/login';

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ palette: require('@/theme').lightTheme }),
}));
jest.mock('@/components/auth', () => {
  const ReactRuntime = require('react');
  const Native = require('react-native');
  return {
    AuthScreen: ({ children }: { children?: React.ReactNode }) =>
      ReactRuntime.createElement(Native.View, null, children),
    AuthField: ({ label }: { label: string }) =>
      ReactRuntime.createElement(Native.Text, null, label),
    AuthButton: ({ label }: { label: string }) =>
      ReactRuntime.createElement(Native.Text, null, label),
  };
});
jest.mock('@/components/ui', () => {
  const ReactRuntime = require('react');
  const Native = require('react-native');
  return {
    Button: ({ label }: { label: string }) => ReactRuntime.createElement(Native.Text, null, label),
    ThemeSelector: () => null,
  };
});
jest.mock('@/components/SplashScreen', () => {
  const ReactRuntime = require('react') as typeof React;
  const Native = require('react-native') as typeof import('react-native');
  return {
    SplashScreen: () => ReactRuntime.createElement(Native.Text, null, 'SPLASH'),
  };
});

const useAuthMock = jest.mocked(useAuth);
const baseAuth: AuthContextData = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(async () => undefined),
  register: jest.fn(async () => undefined),
  logout: jest.fn(async () => undefined),
  applyProfileUpdate: jest.fn(),
  expireSession: jest.fn(async () => ({
    accessTokenRemoved: true,
    refreshTokenRemoved: true,
    complete: true,
  })),
  sessionStorageRecoveryRequired: false,
  retrySessionCleanup: jest.fn(async () => true),
};

async function withProviders(children: React.ReactNode, auth: AuthContextData) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('authenticated route boundary and transient deletion feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps private routes hidden while bootstrap validates the stored session', async () => {
    useAuthMock.mockReturnValue({ ...baseAuth, isLoading: true } as never);
    const loading = await withProviders(<AppLayout />, { ...baseAuth, isLoading: true });
    expect(loading.getByText('SPLASH')).toBeTruthy();
    expect(loading.queryByText('PRIVATE_STACK')).toBeNull();
    loading.unmount();
    loading.unmount();

    useAuthMock.mockReturnValue(baseAuth as never);
    const anonymous = await withProviders(<AppLayout />, baseAuth);
    expect(anonymous.getByText('REDIRECT:/login')).toBeTruthy();
    expect(anonymous.queryByText('SCREEN:profile/delete-account')).toBeNull();
    anonymous.unmount();
  });

  it('shows one identity-free neutral notice after session expiration', async () => {
    setSessionNotice('session-ended');
    useAuthMock.mockReturnValue({ ...baseAuth, login: jest.fn(async () => undefined) } as never);
    const view = await withProviders(<LoginScreen />, baseAuth);

    await waitFor(() =>
      expect(view.getByText('Sua sessão terminou. Entre novamente.')).toBeTruthy(),
    );
    expect(view.queryByText('user@example.com')).toBeNull();
    view.unmount();
  });
});
