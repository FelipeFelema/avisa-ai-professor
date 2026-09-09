import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import * as apiLib from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/providers/AuthProvider';
import * as authService from '@/services/auth';
import * as storage from '@/storage';
import { queryClient } from '@/config';
import type { AuthUser } from '@/types/auth';

jest.mock('@/services/auth', () => ({
  getProfile: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
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

  return (
    <>
      <Text>{user?.name ?? 'NO_USER'}</Text>
      <Text>{isLoading ? 'LOADING' : 'READY'}</Text>
      <Pressable onPress={() => applyProfileUpdate(updatedUser)}>
        <Text>Aplicar perfil</Text>
      </Pressable>
      <Pressable onPress={() => void expireSession()}>
        <Text>Expirar sessao</Text>
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
    jest.mocked(storage.getTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    jest.mocked(authService.getProfile).mockResolvedValue(currentUser);
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
    expect(storage.saveTokens).toHaveBeenCalledWith(tokens);
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
    expect(storage.saveTokens).toHaveBeenCalledWith(tokens);
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
    expect(storage.clearTokens).not.toHaveBeenCalled();
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
});
