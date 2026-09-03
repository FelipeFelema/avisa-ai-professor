import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';

import { AuthProvider } from '@/providers/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/config';
import * as authService from '@/services/auth';
import * as storage from '@/storage';
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

function AuthProbe({ updatedUser }: { updatedUser: AuthUser }) {
  const { user, applyProfileUpdate, expireSession } = useAuth();

  return (
    <>
      <Text>{user?.name ?? 'sem usuário'}</Text>
      <Pressable onPress={() => applyProfileUpdate(updatedUser)}>
        <Text>Aplicar perfil</Text>
      </Pressable>
      <Pressable onPress={() => void expireSession()}>
        <Text>Expirar sessão</Text>
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

    setQueryData.mockRestore();
    invalidateQueries.mockRestore();
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
      fireEvent.press(getByText('Expirar sessão'));
    });

    await waitFor(() => expect(getByText('sem usuário')).toBeTruthy());
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);

    clear.mockRestore();
  });
});
