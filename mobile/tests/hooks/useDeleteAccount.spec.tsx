import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { useDeleteAccount, type AccountDeletionSubmitResult } from '@/hooks/useDeleteAccount';
import { useAuth } from '@/hooks/useAuth';
import * as service from '@/services/auth';
import type { AccountDeletionImpact } from '@/types/auth';
import { consumeSessionNotice } from '@/lib/session-notice';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  getAccountDeletionImpact: jest.fn(),
  deleteOwnAccount: jest.fn(),
  verifyAccountDeletionSession: jest.fn(),
}));
const impact = {
  role: 'PARENT',
  canDelete: true,
  blockReason: null,
  ownedClassroomsCount: 0,
  announcementsInOwnedClassroomsCount: 0,
  externalMembershipsCount: 0,
  authoredAnnouncementsInOtherClassroomsCount: 0,
} as const;
const user = { id: 'u', name: 'Nome', email: 'synthetic@example.com', role: 'PARENT' };
const expireSession = jest.fn();
const read = jest.mocked(service.getAccountDeletionImpact);
const removeAccount = jest.mocked(service.deleteOwnAccount);
const verifySession = jest.mocked(service.verifyAccountDeletionSession);
const confirmation = {
  currentPassword: 'Synthetic fixture password',
  confirmationPhrase: 'EXCLUIR MINHA CONTA',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  consumeSessionNotice();
  jest.mocked(useAuth).mockReturnValue({ user, expireSession } as never);
  read.mockResolvedValue(impact);
  removeAccount.mockResolvedValue(undefined);
  verifySession.mockResolvedValue('valid');
});
describe('transient impact lifecycle', () => {
  it('starts loading and accepts a zero summary', async () => {
    const pending = deferred<AccountDeletionImpact>();
    read.mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useDeleteAccount());
    expect(hook.result.current.isLoading).toBe(true);
    await act(async () => pending.resolve(impact));
    expect(hook.result.current.impact).toEqual(impact);
    expect(hook.result.current.isLoading).toBe(false);
  });
  it('aborts a superseded read and ignores its late result even if cancellation is ignored by transport', async () => {
    const pending = deferred<AccountDeletionImpact>();
    read.mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useDeleteAccount());
    const signal = read.mock.calls[0][0];
    await act(async () => {
      await hook.result.current.reload();
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve({ ...impact, ownedClassroomsCount: 7 }));
    expect(hook.result.current.impact?.ownedClassroomsCount).toBe(0);
  });
  it('does not apply an old account/session result or expire a new session', async () => {
    const pending = deferred<AccountDeletionImpact>();
    read.mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useDeleteAccount());
    jest.mocked(useAuth).mockReturnValue({ user: { ...user, id: 'new' }, expireSession } as never);
    await hook.rerender(undefined);
    await waitFor(() => expect(hook.result.current.impact).toEqual(impact));
    await act(async () => pending.resolve({ ...impact, ownedClassroomsCount: 99 }));
    expect(hook.result.current.impact?.ownedClassroomsCount).toBe(0);
    expect(expireSession).not.toHaveBeenCalled();
  });
  it('aborts on unmount and ignores late responses', async () => {
    const pending = deferred<AccountDeletionImpact>();
    read.mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useDeleteAccount());
    const signal = read.mock.calls[0][0];
    await hook.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(impact));
    expect(expireSession).not.toHaveBeenCalled();
  });
  it('expires only a current definitive 401 and retains recoverable read feedback', async () => {
    read.mockRejectedValueOnce(
      new service.AccountDeletionError({
        status: 401,
        message: 'Sua sessão terminou. Entre novamente.',
      }),
    );
    const hook = await renderHook(() => useDeleteAccount());
    await waitFor(() => expect(expireSession).toHaveBeenCalledTimes(1));
    expect(hook.result.current.impact).toBeUndefined();
    read.mockRejectedValueOnce(
      new service.AccountDeletionError({ status: 500, message: 'Tente novamente.' }),
    );
    await act(async () => {
      await hook.result.current.reload();
    });
    expect(hook.result.current.feedback?.message).toBe('Tente novamente.');
    expect(expireSession).toHaveBeenCalledTimes(1);
  });

  it('closes duplicate taps synchronously and accepts only a committed response', async () => {
    const pending = deferred<void>();
    removeAccount.mockReturnValue(pending.promise);
    const hook = await renderHook(() => useDeleteAccount());
    await waitFor(() => expect(hook.result.current.impact).toEqual(impact));
    let first!: Promise<AccountDeletionSubmitResult>;
    let duplicate!: Promise<AccountDeletionSubmitResult>;

    await act(async () => {
      first = hook.result.current.submit(confirmation);
      duplicate = hook.result.current.submit(confirmation);
      await Promise.resolve();
    });
    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(removeAccount).toHaveBeenCalledWith(confirmation, expect.any(Number));
    await expect(duplicate).resolves.toBe('ignored');
    expect(hook.result.current.isPending).toBe(true);

    await act(async () => {
      pending.resolve(undefined);
      await expect(first).resolves.toBe('confirmed');
    });
    expect(expireSession).toHaveBeenCalledTimes(1);
    expect(hook.result.current.flowState).toBe('deleted');
    expect(consumeSessionNotice()).toBe('account-deleted');
  });

  it('keeps allowlisted field feedback and reloads the impact after a conflict', async () => {
    removeAccount.mockRejectedValueOnce(
      new service.AccountDeletionError({
        status: 400,
        field: 'currentPassword',
        message: 'A senha atual está incorreta.',
      }),
    );
    const hook = await renderHook(() => useDeleteAccount());
    await waitFor(() => expect(hook.result.current.impact).toEqual(impact));

    await act(async () => {
      await expect(hook.result.current.submit(confirmation)).resolves.toBe('field-error');
    });
    expect(hook.result.current.feedback).toEqual({
      status: 400,
      field: 'currentPassword',
      message: 'A senha atual está incorreta.',
    });
    expect(verifySession).not.toHaveBeenCalled();

    removeAccount.mockRejectedValueOnce(
      new service.AccountDeletionError({ status: 409, message: 'Resumo atualizado.' }),
    );
    await act(async () => {
      await expect(hook.result.current.submit(confirmation)).resolves.toBe('conflict');
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(hook.result.current.impact).toEqual(impact);
    expect(hook.result.current.feedback?.message).toBe('Resumo atualizado.');
    expect(hook.result.current.flowState).toBe('ready');
  });

  it('uses read-only verification after 401 and requires a fresh summary and manual confirmation', async () => {
    removeAccount.mockRejectedValue(
      new service.AccountDeletionError({ status: 401, message: 'Verifique sua sessão.' }),
    );
    verifySession.mockResolvedValue('valid');
    const hook = await renderHook(() => useDeleteAccount());
    await waitFor(() => expect(hook.result.current.impact).toEqual(impact));

    await act(async () => {
      await expect(hook.result.current.submit(confirmation)).resolves.toBe('conflict');
    });
    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(expireSession).not.toHaveBeenCalled();
    expect(hook.result.current.feedback?.message).toContain('confirme manualmente');
  });

  it.each([
    ['invalid', 'session-ended', 'session-ended'],
    ['indeterminate', 'indeterminate', 'indeterminate'],
  ] as const)(
    'handles verification result %s without declaring deletion success',
    async (verification, expectedResult, expectedState) => {
      removeAccount.mockRejectedValue(new Error('network result unavailable'));
      verifySession.mockResolvedValue(verification);
      const hook = await renderHook(() => useDeleteAccount());
      await waitFor(() => expect(hook.result.current.impact).toEqual(impact));

      await act(async () => {
        await expect(hook.result.current.submit(confirmation)).resolves.toBe(expectedResult);
      });
      expect(hook.result.current.flowState).toBe(expectedState);
      expect(consumeSessionNotice()).toBe(verification === 'invalid' ? 'session-ended' : undefined);
      if (verification === 'invalid') expect(expireSession).toHaveBeenCalledTimes(1);
      else expect(expireSession).not.toHaveBeenCalled();
      expect(hook.result.current.flowState).not.toBe('deleted');
    },
  );
});
