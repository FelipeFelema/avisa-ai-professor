import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStringAsync, setStringAsync } from 'expo-clipboard';

import { useAuth } from '@/hooks/useAuth';
import { useTeacherInvite } from '@/hooks/useTeacherInvite';
import * as authService from '@/services/auth';
import * as inviteService from '@/services/admin/teacher-invite.service';
import { setSessionNotice } from '@/lib/session-notice';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData } from '@/types/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from '../../app/(app)/_layout';
import LoginScreen from '../../app/(auth)/login';
import { createDeferredRequest } from '../helpers/profile-password';

jest.mock('expo-router', () => {
  const ReactRuntime = require('react');
  const Native = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      ReactRuntime.createElement(Native.Text, null, `REDIRECT:${href}`),
    Stack: Object.assign(({ children }: { children?: React.ReactNode }) => children, {
      Screen: () => null,
    }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (callback: () => (() => void) | void) =>
      ReactRuntime.useEffect(callback, [callback]),
  };
});

jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  getProfile: jest.fn(),
}));
jest.mock('@/services/admin/teacher-invite.service', () => ({
  ...jest.requireActual('@/services/admin/teacher-invite.service'),
  createTeacherInvite: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));
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

const profile = jest.mocked(authService.getProfile);
const create = jest.mocked(inviteService.createTeacherInvite);
const mockClipboardSet = jest.mocked(setStringAsync);
const mockClipboardRead = jest.mocked(getStringAsync);
const invite = {
  id: 'e6a84760-64a8-4fe8-ae23-3a4e5b833c17',
  code: `PROF-${'C'.repeat(32)}`,
  role: 'PROFESSOR' as const,
  isActive: true as const,
  createdAt: '2026-10-04T12:00:00.000Z',
  expiresAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
let appStateSpy: jest.SpyInstance | undefined;
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

function createInviteHarness(auth: AuthContextData) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ ...auth }}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper };
}

async function withProviders(children: React.ReactNode, auth: AuthContextData) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>,
  );
  return view;
}

describe('authenticated route boundary and transient deletion feedback', () => {
  beforeEach(() => {
    appStateSpy?.mockRestore();
    appStateSpy = undefined;
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    profile.mockResolvedValue({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.test',
      role: 'ADMIN',
    });
    create.mockResolvedValue(invite);
    mockClipboardSet.mockReset();
    mockClipboardRead.mockReset();
  });

  it.each(['logout', 'restart'] as const)(
    'does not restore a copied invite or feedback after %s',
    async (change) => {
      const auth: AuthContextData = {
        ...baseAuth,
        user: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' as const },
        isAuthenticated: true,
      };
      let { queryClient, wrapper } = createInviteHarness(auth);
      let hook = await renderHook(() => useTeacherInvite(), { wrapper });
      await waitFor(() => expect(hook.result.current.state.access).toBe('authorized'));
      await act(async () => hook.result.current.generate());
      await waitFor(() => expect(hook.result.current.state.result?.code).toBe(invite.code));
      const clipboard = createDeferredRequest<boolean>();
      mockClipboardSet.mockReturnValue(clipboard.promise);
      expect(hook.result.current.copy).toEqual(expect.any(Function));
      let copyPromise!: Promise<void>;
      await act(async () => {
        copyPromise = hook.result.current.copy();
      });
      expect(mockClipboardSet).toHaveBeenCalledWith(invite.code);

      let activeState = () => hook.result.current.state;
      let activeClient = queryClient;
      if (change === 'logout') {
        auth.user = null;
        auth.isAuthenticated = false;
        await hook.rerender({});
      } else if (change === 'restart') {
        await hook.unmount();
        const restartedHarness = createInviteHarness(auth);
        queryClient = restartedHarness.queryClient;
        wrapper = restartedHarness.wrapper;
        hook = await renderHook(() => useTeacherInvite(), { wrapper });
        activeState = () => hook.result.current.state;
        activeClient = queryClient;
        await waitFor(() => expect(activeState().access).toBe('authorized'));
        expect(activeState().result).toBeUndefined();
      }

      await act(async () => {
        clipboard.resolve(true);
        await copyPromise;
      });
      expect(activeState().result).toBeUndefined();
      expect(activeState().feedback).toEqual({ kind: 'none' });
      expect(activeClient.getQueryCache().getAll()).toEqual([]);
      expect(activeClient.getMutationCache().getAll()).toEqual([]);
      expect(JSON.stringify((AsyncStorage.setItem as jest.Mock).mock.calls)).not.toContain(
        invite.code,
      );
      expect(JSON.stringify((AsyncStorage.getItem as jest.Mock).mock.calls)).not.toContain(
        invite.code,
      );
      expect(mockClipboardRead).not.toHaveBeenCalled();
      expect(mockClipboardSet).not.toHaveBeenCalledWith('');
      await hook.unmount();
    },
  );

  it('does not restore a pending deliberate generation after an app restart', async () => {
    const auth = {
      ...baseAuth,
      user: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' as const },
      isAuthenticated: true,
    };
    const harness = createInviteHarness(auth);
    const first = await renderHook(() => useTeacherInvite(), { wrapper: harness.wrapper });
    await waitFor(() => expect(first.result.current.state.access).toBe('authorized'));
    await act(async () => first.result.current.generate());
    await waitFor(() => expect(first.result.current.state.result?.code).toBe(invite.code));

    const second = {
      ...invite,
      id: '3a852bfd-f55e-4cc8-9084-2e5a9f801bcb',
      code: `PROF-${'D'.repeat(32)}`,
    };
    const pending = createDeferredRequest<typeof second>();
    create.mockReturnValueOnce(pending.promise);
    let generation!: Promise<void>;
    await act(async () => {
      generation = first.result.current.generate();
    });
    await waitFor(() => expect(first.result.current.state.operation).toBe('generating'));
    await first.unmount();

    const restartedHarness = createInviteHarness(auth);
    const restarted = await renderHook(() => useTeacherInvite(), {
      wrapper: restartedHarness.wrapper,
    });
    await waitFor(() => expect(restarted.result.current.state.access).toBe('authorized'));
    expect(restarted.result.current.state.result).toBeUndefined();
    await act(async () => {
      pending.resolve(second);
      await generation;
    });
    expect(restarted.result.current.state.result).toBeUndefined();
    expect(JSON.stringify(restarted.result.current.state)).not.toContain(second.code);
    expect(harness.queryClient.getQueryCache().getAll()).toEqual([]);
    expect(harness.queryClient.getMutationCache().getAll()).toEqual([]);
    expect(restartedHarness.queryClient.getQueryCache().getAll()).toEqual([]);
    expect(restartedHarness.queryClient.getMutationCache().getAll()).toEqual([]);
    await restarted.unmount();
  });

  it('keeps private routes hidden while bootstrap validates the stored session', async () => {
    const loading = await withProviders(<AppLayout />, { ...baseAuth, isLoading: true });
    expect(loading.getByText('SPLASH')).toBeTruthy();
    expect(loading.queryByText('PRIVATE_STACK')).toBeNull();
    loading.unmount();
    loading.unmount();

    const anonymous = await withProviders(<AppLayout />, baseAuth);
    expect(anonymous.getByText('REDIRECT:/login')).toBeTruthy();
    expect(anonymous.queryByText('SCREEN:profile/delete-account')).toBeNull();
    anonymous.unmount();
  });

  it('shows one identity-free neutral notice after session expiration', async () => {
    setSessionNotice('session-ended');
    const view = await withProviders(<LoginScreen />, {
      ...baseAuth,
      login: jest.fn(async () => undefined),
    });

    await waitFor(() =>
      expect(view.getByText('Sua sessão terminou. Entre novamente.')).toBeTruthy(),
    );
    expect(view.queryByText('user@example.com')).toBeNull();
    view.unmount();
  });
});
