import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useChangePassword } from '@/hooks/useChangePassword';
import * as service from '@/services/auth';
import * as storage from '@/storage';
import type { AuthContextData } from '@/types/auth';
import { createDeferredRequest } from '../helpers/profile-password';

jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  changePassword: jest.fn(),
}));
jest.mock('@/storage', () => ({
  getTokens: jest.fn(),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
const change = jest.mocked(service.changePassword);
const body = {
  currentPassword: 'Synthetic old password',
  newPassword: 'Synthetic new password',
  confirmNewPassword: 'Synthetic new password',
};
function harness() {
  const client = new QueryClient();
  const auth = {
    user: { id: 'user-id', name: 'Name', email: 'test@example.com', role: 'PARENT' },
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    applyProfileUpdate: jest.fn(),
    expireSession: jest.fn(),
  } as AuthContextData;
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return { client, auth, wrapper };
}
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());
describe('imperative useChangePassword', () => {
  it('suppresses immediate duplicate requests and never caches or updates identity/tokens', async () => {
    const consoleLog = jest.spyOn(console, 'log');
    const consoleError = jest.spyOn(console, 'error');
    const deferred = createDeferredRequest<void>();
    change.mockReturnValue(deferred.promise);
    const { wrapper, client, auth } = harness();
    const { result, unmount } = await renderHook(useChangePassword, { wrapper });
    let first!: Promise<string>;
    await act(async () => {
      first = result.current.submit(body);
      await result.current.submit(body);
    });
    expect(change).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await act(async () => {
      deferred.resolve();
      await first;
    });
    expect(result.current.isPending).toBe(false);
    expect(auth.applyProfileUpdate).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(storage.saveTokens).not.toHaveBeenCalled();
    expect(storage.clearTokens).not.toHaveBeenCalled();
    const diagnostics = JSON.stringify([...consoleLog.mock.calls, ...consoleError.mock.calls]);
    expect(
      !diagnostics.includes(body.currentPassword) && !diagnostics.includes(body.newPassword),
    ).toBe(true);
    await unmount();
    client.clear();
  });
  it('retains only safe field feedback and expires an invalid session', async () => {
    const { wrapper, client, auth } = harness();
    const { result, unmount } = await renderHook(useChangePassword, { wrapper });
    change.mockRejectedValue(
      new service.ChangePasswordError({
        status: 400,
        message: 'A senha atual está incorreta.',
        field: 'currentPassword',
      }),
    );
    await act(async () => {
      await result.current.submit(body);
    });
    expect(result.current.feedback?.field).toBe('currentPassword');
    expect(JSON.stringify(result.current.feedback).includes(body.currentPassword)).toBe(false);
    change.mockRejectedValue(
      new service.ChangePasswordError({
        status: 401,
        message: 'Entre novamente para alterar sua senha.',
      }),
    );
    await act(async () => {
      await result.current.submit(body);
    });
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
    await unmount();
    client.clear();
  });
  it.each(['unmount', 'abandon', 'expiry'])(
    'ignores late completion after %s',
    async (scenario) => {
      const deferred = createDeferredRequest<void>();
      change.mockReturnValue(deferred.promise);
      const { wrapper, client, auth } = harness();
      const { result, unmount, rerender } = await renderHook(useChangePassword, { wrapper });
      let pending!: Promise<string>;
      await act(async () => {
        pending = result.current.submit(body);
      });
      if (scenario === 'unmount') await unmount();
      if (scenario === 'abandon') await act(async () => result.current.clearFeedback());
      if (scenario === 'expiry') {
        auth.user = null;
        auth.isAuthenticated = false;
        await rerender({});
      }
      let completion: string | undefined;
      await act(async () => {
        deferred.resolve();
        completion = await pending;
      });
      expect(completion).toBe('ignored');
      if (scenario !== 'unmount') {
        expect(result.current.feedback).toBeUndefined();
        await unmount();
      }
      client.clear();
    },
  );
});
