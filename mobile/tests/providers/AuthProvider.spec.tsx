import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import * as apiLib from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/providers/AuthProvider';
import * as authService from '@/services/auth';
import * as pushLifecycle from '@/services/push/push-lifecycle';
import * as revocation from '@/services/auth/session-revocation.service';
import * as storage from '@/storage';
import { queryClient } from '@/config';
import {
  getSessionGeneration,
  invalidateSessionGeneration,
  SessionGenerationChangedError,
} from '@/lib/session-generation';
import type { AuthUser, SessionCleanupOutcome } from '@/types/auth';

jest.mock('@/services/auth', () => ({
  getProfile: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
}));

jest.mock('@/services/auth/session-revocation.service', () => ({
  ensureSessionRevocation: jest.fn(),
  queueCurrentSessionRevocation: jest.fn(),
  flushPendingSessionRevocations: jest.fn(),
  startSessionRevocationRecovery: jest.fn(),
}));

jest.mock('@/storage', () => ({
  clearTokens: jest.fn(),
  getTokens: jest.fn(),
  saveTokens: jest.fn(),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');

  return {
    ...actual,
    setSessionExpiredHandler: jest.fn(),
  };
});

function AuthProbe({ updatedUser }: { updatedUser: AuthUser }) {
  const { user, isLoading, applyProfileUpdate, expireSession, login, register } = useAuth();
  const { sessionStorageRecoveryRequired, retrySessionCleanup } = useAuth();

  return (
    <>
      <Text>{user?.name ?? 'NO_USER'}</Text>
      <Text>{isLoading ? 'LOADING' : 'READY'}</Text>
      <Text>{sessionStorageRecoveryRequired ? 'STORAGE_RECOVERY_REQUIRED' : 'STORAGE_READY'}</Text>
      <Pressable onPress={() => applyProfileUpdate(updatedUser)}>
        <Text>Aplicar perfil</Text>
      </Pressable>
      <Pressable onPress={() => void expireSession()}>
        <Text>Expirar sessao</Text>
      </Pressable>
      <Pressable onPress={() => void retrySessionCleanup?.()}>
        <Text>Retry cleanup</Text>
      </Pressable>
      <Pressable onPress={() => void login({ email: 'login@example.com', password: 'secret' })}>
        <Text>Entrar</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          void register({
            name: 'Novo Usuario',
            email: 'register@example.com',
            password: 'secret',
            teacherCode: 'TEACHER-1',
          })
        }
      >
        <Text>Cadastrar</Text>
      </Pressable>
    </>
  );
}

function AuthActionsProbe({
  onActions,
}: {
  onActions: (actions: ReturnType<typeof useAuth>) => void;
}) {
  const actions = useAuth();
  useEffect(() => onActions(actions), [actions, onActions]);
  return null;
}

describe('AuthProvider profile/session boundaries', () => {
  const currentUser: AuthUser = {
    id: 'user-1',
    name: 'Nome Atual',
    email: 'atual@example.com',
    role: 'PARENT',
  };
  const updatedUser: AuthUser = {
    ...currentUser,
    name: 'Nome Atualizado',
    email: 'atualizado@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(revocation.ensureSessionRevocation).mockResolvedValue(undefined);
    jest.mocked(revocation.queueCurrentSessionRevocation).mockResolvedValue(true);
    jest.mocked(revocation.flushPendingSessionRevocations).mockResolvedValue(true);
    jest.mocked(revocation.startSessionRevocationRecovery).mockReturnValue(jest.fn());
    jest.mocked(storage.saveTokens).mockResolvedValue(true);
    jest.mocked(storage.clearTokens).mockResolvedValue({
      accessTokenRemoved: true,
      refreshTokenRemoved: true,
      complete: true,
    });
    jest.mocked(storage.getTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    jest.mocked(authService.getProfile).mockResolvedValue(currentUser);
    jest.spyOn(pushLifecycle, 'preparePushLogout').mockResolvedValue(null);
    jest.spyOn(pushLifecycle, 'completePushLogoutCleanup').mockResolvedValue(undefined);
  });

  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

  it('logs in, saves the returned tokens and restores the profile', async () => {
    const tokens = { accessToken: 'login-access', refreshToken: 'login-refresh' };
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    jest.mocked(authService.login).mockResolvedValue(tokens);
    jest.mocked(authService.getProfile).mockResolvedValue(currentUser);

    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText('READY')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Entrar'));
    });

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    expect(authService.login).toHaveBeenCalledWith({
      email: 'login@example.com',
      password: 'secret',
    });
    expect(storage.saveTokens).toHaveBeenCalledWith(tokens, expect.any(Number));
    expect(authService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('registers, saves the returned tokens and loads the new profile', async () => {
    const tokens = { accessToken: 'register-access', refreshToken: 'register-refresh' };
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    jest.mocked(authService.register).mockResolvedValue(tokens);
    jest.mocked(authService.getProfile).mockResolvedValue(updatedUser);

    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText('READY')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Cadastrar'));
    });

    await waitFor(() => expect(getByText(updatedUser.name)).toBeTruthy());
    expect(authService.register).toHaveBeenCalledWith({
      name: 'Novo Usuario',
      email: 'register@example.com',
      password: 'secret',
      teacherCode: 'TEACHER-1',
    });
    expect(storage.saveTokens).toHaveBeenCalledWith(tokens, expect.any(Number));
    expect(authService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('finishes restoration without a user when no tokens are persisted', async () => {
    jest.mocked(storage.getTokens).mockResolvedValue(null);

    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText('READY')).toBeTruthy());
    expect(getByText('NO_USER')).toBeTruthy();
    expect(authService.getProfile).not.toHaveBeenCalled();
  });

  it('clears the session when profile restoration fails', async () => {
    const clear = jest.spyOn(queryClient, 'clear');
    jest.mocked(authService.getProfile).mockRejectedValue(new Error('profile unavailable'));

    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText('READY')).toBeTruthy());
    expect(getByText('NO_USER')).toBeTruthy();
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('registers the session-expired handler, handles it atomically and cleans it up', async () => {
    const clear = jest.spyOn(queryClient, 'clear');
    const setHandler = jest.mocked(apiLib.setSessionExpiredHandler);

    const { getByText, unmount } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    const registeredHandler = [...setHandler.mock.calls]
      .reverse()
      .find(([handler]) => typeof handler === 'function')?.[0];

    expect(registeredHandler).toEqual(expect.any(Function));
    await act(async () => {
      await (registeredHandler as () => Promise<void>)();
    });

    await waitFor(() => expect(getByText('NO_USER')).toBeTruthy());
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);

    await unmount();
    expect(setHandler).toHaveBeenLastCalledWith(undefined);
  });

  it('applies the returned profile immediately and invalidates identity-bearing caches', async () => {
    const setQueryData = jest.spyOn(queryClient, 'setQueryData');
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Aplicar perfil'));
    });

    await waitFor(() => expect(getByText(updatedUser.name)).toBeTruthy());
    expect(setQueryData).toHaveBeenCalledWith(['auth', 'profile'], updatedUser);
    expect(invalidateQueries).toHaveBeenCalled();
    expect(queryClient.getQueryData(['auth', 'profile'])).toEqual(updatedUser);
    expect(storage.clearTokens).not.toHaveBeenCalled();
    expect(storage.saveTokens).not.toHaveBeenCalled();
  });

  it('clears tokens, cache and context together when the session expires', async () => {
    const clear = jest.spyOn(queryClient, 'clear');
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Expirar sessao'));
    });

    await waitFor(() => expect(getByText('NO_USER')).toBeTruthy());
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('closes identity and cache before waiting for token storage cleanup', async () => {
    let finishCleanup!: (outcome: SessionCleanupOutcome) => void;
    jest.mocked(storage.clearTokens).mockReturnValue(
      new Promise((resolve) => {
        finishCleanup = resolve;
      }),
    );
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    queryClient.setQueryData(['private', 'fixture'], { content: 'private-content' });
    await act(async () => {
      fireEvent.press(getByText('Expirar sessao'));
    });

    expect(getByText('NO_USER')).toBeTruthy();
    expect(queryClient.getQueryData(['private', 'fixture'])).toBeUndefined();
    expect(getByText('READY')).toBeTruthy();
    finishCleanup({ accessTokenRemoved: true, refreshTokenRemoved: true, complete: true });
    await waitFor(() => expect(getByText('STORAGE_READY')).toBeTruthy());
  });

  it('persists capability-only logout cleanup before clearing auth and does not await network cleanup', async () => {
    const pending = {
      installationId: '00000000-0000-4000-8000-000000000101',
      capability: 'A'.repeat(43),
      bindingId: '00000000-0000-4000-8000-000000000102',
      lifecycleVersion: 1,
      reason: 'LOGOUT' as const,
    };
    let finishPushPreparation!: (value: typeof pending) => void;
    const prepare = jest
      .spyOn(pushLifecycle, 'preparePushLogout')
      .mockReturnValue(new Promise((resolve) => (finishPushPreparation = resolve)));
    const complete = jest.spyOn(pushLifecycle, 'completePushLogoutCleanup');
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());

    let logout!: Promise<void>;
    await act(async () => {
      logout = actions.logout();
      await Promise.resolve();
    });
    expect(storage.clearTokens).not.toHaveBeenCalled();
    expect(getByText(currentUser.name)).toBeTruthy();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    finishPushPreparation(pending);
    await act(async () => logout);
    expect(getByText('NO_USER')).toBeTruthy();
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(complete).toHaveBeenCalledWith(pending));
  });

  it('finishes logout and auth storage cleanup when push cleanup persistence fails', async () => {
    const prepare = jest
      .spyOn(pushLifecycle, 'preparePushLogout')
      .mockRejectedValue(new Error('secure store unavailable'));
    const complete = jest.spyOn(pushLifecycle, 'completePushLogoutCleanup');
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());

    await act(async () => actions.logout());

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(null);
    expect(getByText('NO_USER')).toBeTruthy();
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
  });

  it('preserves account B when account A logout preparation finishes late', async () => {
    let finish!: (value: null) => void;
    jest.spyOn(pushLifecycle, 'preparePushLogout').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
        <AuthActionsProbe onActions={onActions} />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    let logout!: Promise<void>;
    await act(async () => {
      logout = actions.logout();
      await Promise.resolve();
    });
    const cleanupGeneration = getSessionGeneration();
    const replacement = { ...currentUser, id: 'user-B', name: 'Account B' };
    jest
      .mocked(authService.login)
      .mockResolvedValueOnce({ accessToken: 'B-access', refreshToken: 'B-refresh' });
    jest.mocked(authService.getProfile).mockResolvedValueOnce(replacement);
    await act(async () => {
      await actions.login({ email: 'b@example.com', password: 'synthetic' });
    });
    queryClient.setQueryData(['auth', 'profile'], replacement);
    await act(async () => {
      finish(null);
      await logout;
    });
    expect(getByText(replacement.name)).toBeTruthy();
    expect(queryClient.getQueryData(['auth', 'profile'])).toEqual(replacement);
    expect(getSessionGeneration()).not.toBe(cleanupGeneration);
    expect(storage.clearTokens).toHaveBeenCalledWith(cleanupGeneration);
  });

  it('closes local logout and flags recovery even when session queue storage fails', async () => {
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
        <AuthActionsProbe onActions={onActions} />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    jest
      .mocked(revocation.queueCurrentSessionRevocation)
      .mockRejectedValueOnce(new Error('private store failed'));
    jest.mocked(revocation.flushPendingSessionRevocations).mockResolvedValueOnce(false);
    await act(async () => {
      await expect(actions.logout()).resolves.toBeUndefined();
    });
    expect(getByText('NO_USER')).toBeTruthy();
    expect(getByText('STORAGE_RECOVERY_REQUIRED')).toBeTruthy();
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(revocation.queueCurrentSessionRevocation).toHaveBeenCalledTimes(1);
  });

  it('does not wait for backend revocation to finish local logout', async () => {
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
        <AuthActionsProbe onActions={onActions} />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    jest
      .mocked(revocation.flushPendingSessionRevocations)
      .mockReturnValueOnce(new Promise(() => undefined));
    await act(async () => {
      await actions.logout();
    });
    expect(getByText('NO_USER')).toBeTruthy();
    expect(getByText('READY')).toBeTruthy();
    expect(revocation.queueCurrentSessionRevocation).toHaveBeenCalledTimes(1);
  });

  it('ignores a profile restore that resolves after session invalidation', async () => {
    let resolveProfile!: (profile: AuthUser) => void;
    jest.mocked(authService.getProfile).mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    expect(getByText('LOADING')).toBeTruthy();
    expect(getByText('NO_USER')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Expirar sessao'));
    });
    resolveProfile(currentUser);
    await act(async () => Promise.resolve());

    expect(getByText('NO_USER')).toBeTruthy();
    expect(getByText('READY')).toBeTruthy();
    expect(queryClient.getQueryData(['auth', 'profile'])).toBeUndefined();
  });

  it('does not apply a profile update from an invalidated session generation', async () => {
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    const staleGeneration = getSessionGeneration();
    await act(async () => {
      await actions.expireSession();
    });
    await act(async () => {
      actions.applyProfileUpdate(updatedUser, staleGeneration);
    });

    expect(getByText('NO_USER')).toBeTruthy();
    expect(queryClient.getQueryData(['auth', 'profile'])).toBeUndefined();
  });

  it('ignores login tokens returned after the session generation changes', async () => {
    const tokens = { accessToken: 'late-access', refreshToken: 'late-refresh' };
    let resolveLogin!: (value: typeof tokens) => void;
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    jest.mocked(authService.login).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText('READY')).toBeTruthy());

    let loginPromise!: Promise<void>;
    await act(async () => {
      loginPromise = actions.login({ email: 'login@example.com', password: 'secret' });
    });
    const observed = loginPromise.catch((error: unknown) => error);
    await act(async () => {
      await actions.expireSession();
    });
    await act(async () => {
      resolveLogin(tokens);
      await observed;
    });

    expect(await observed).toBeInstanceOf(SessionGenerationChangedError);
    expect(storage.saveTokens).not.toHaveBeenCalled();
    expect(authService.getProfile).not.toHaveBeenCalled();
    expect(getByText('NO_USER')).toBeTruthy();
  });

  it('ignores registration tokens returned after the session generation changes', async () => {
    const tokens = { accessToken: 'late-access', refreshToken: 'late-refresh' };
    let resolveRegister!: (value: typeof tokens) => void;
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    jest.mocked(authService.register).mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText('READY')).toBeTruthy());

    let registerPromise!: Promise<void>;
    await act(async () => {
      registerPromise = actions.register({
        name: 'Novo Usuario',
        email: 'register@example.com',
        password: 'secret',
        teacherCode: 'TEACHER-1',
      });
    });
    const observed = registerPromise.catch((error: unknown) => error);
    await act(async () => {
      await actions.expireSession();
    });
    await act(async () => {
      resolveRegister(tokens);
      await observed;
    });

    expect(await observed).toBeInstanceOf(SessionGenerationChangedError);
    expect(storage.saveTokens).not.toHaveBeenCalled();
    expect(authService.getProfile).not.toHaveBeenCalled();
    expect(getByText('NO_USER')).toBeTruthy();
  });

  it('keeps authentication closed when token persistence fails', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    jest.mocked(storage.saveTokens).mockResolvedValue(false);
    jest.mocked(storage.clearTokens).mockResolvedValue({
      accessTokenRemoved: false,
      refreshTokenRemoved: false,
      complete: false,
    });
    jest.mocked(authService.login).mockResolvedValue(tokens);
    let actions!: ReturnType<typeof useAuth>;
    const onActions = (value: ReturnType<typeof useAuth>) => {
      actions = value;
    };
    const { getByText } = await render(
      <AuthProvider>
        <>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </>
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText('READY')).toBeTruthy());

    await act(async () => {
      await expect(
        actions.login({ email: 'login@example.com', password: 'secret' }),
      ).rejects.toThrow('Não foi possível salvar a sessão neste dispositivo.');
    });

    expect(getByText('NO_USER')).toBeTruthy();
    expect(getByText('STORAGE_RECOVERY_REQUIRED')).toBeTruthy();
    expect(authService.getProfile).not.toHaveBeenCalled();
  });

  it('ignores an expired-session callback from an old generation', async () => {
    const setHandler = jest.mocked(apiLib.setSessionExpiredHandler);
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
    const handler = [...setHandler.mock.calls]
      .reverse()
      .find(([candidate]) => typeof candidate === 'function')?.[0];
    expect(handler).toEqual(expect.any(Function));
    const staleGeneration = getSessionGeneration();
    queryClient.setQueryData(['auth', 'profile'], currentUser);
    invalidateSessionGeneration();

    await act(async () => {
      await (handler as (generation: number) => Promise<void>)(staleGeneration);
    });

    expect(getByText(currentUser.name)).toBeTruthy();
    expect(storage.clearTokens).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['auth', 'profile'])).toEqual(currentUser);
  });

  it('keeps authentication closed and exposes a retry when SecureStore cleanup is partial', async () => {
    jest.mocked(authService.getProfile).mockRejectedValue(new Error('profile unavailable'));
    jest.mocked(storage.clearTokens).mockResolvedValue({
      accessTokenRemoved: false,
      refreshTokenRemoved: true,
      complete: false,
    });
    const { getByText } = await render(
      <AuthProvider>
        <AuthProbe updatedUser={updatedUser} />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText('STORAGE_RECOVERY_REQUIRED')).toBeTruthy());
    expect(getByText('NO_USER')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Retry cleanup'));
    });
    expect(storage.clearTokens).toHaveBeenCalledTimes(2);
  });

  it.each(['different-account', 'same-account-new-session'] as const)(
    'does not apply old account callbacks after %s',
    async (kind) => {
      let actions!: ReturnType<typeof useAuth>;
      const onActions = (value: ReturnType<typeof useAuth>) => {
        actions = value;
      };
      const { getByText } = await render(
        <AuthProvider>
          <AuthProbe updatedUser={updatedUser} />
          <AuthActionsProbe onActions={onActions} />
        </AuthProvider>,
      );
      await waitFor(() => expect(getByText(currentUser.name)).toBeTruthy());
      const oldGeneration = getSessionGeneration();
      await act(async () => {
        await actions.expireSession();
      });
      const replacement = {
        ...currentUser,
        id: kind === 'different-account' ? 'user-B' : currentUser.id,
        name: 'Replacement session',
      };
      jest.mocked(authService.login).mockResolvedValueOnce({
        accessToken: 'replacement-access',
        refreshToken: 'replacement-refresh',
      });
      jest.mocked(authService.getProfile).mockResolvedValueOnce(replacement);
      await act(async () => {
        await actions.login({ email: 'replacement@example.com', password: 'synthetic' });
      });
      await waitFor(() => expect(getByText(replacement.name)).toBeTruthy());
      await act(async () => {
        actions.applyProfileUpdate(
          { ...currentUser, name: 'Stale private profile' },
          oldGeneration,
        );
        await actions.expireSession(oldGeneration);
      });
      expect(getByText(replacement.name)).toBeTruthy();
      expect(actions.user?.id).toBe(replacement.id);
      expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    },
  );
});
