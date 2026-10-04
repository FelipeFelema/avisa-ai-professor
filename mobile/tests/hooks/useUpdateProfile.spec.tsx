import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import * as authService from '@/services/auth';
import type { AuthContextData, AuthUser } from '@/types/auth';

jest.mock('@/services/auth', () => ({
  updateProfile: jest.fn(),
}));

const updateProfileMock = jest.mocked(authService.updateProfile);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUpdateProfile', () => {
  const currentUser: AuthUser = {
    id: 'user-1',
    name: 'Nome Atual',
    email: 'atual@example.com',
    role: 'PARENT',
  };
  const updatedUser: AuthUser = {
    ...currentUser,
    name: 'Nome Atualizado',
  };

  it('applies the returned profile and does not retry a failed mutation', async () => {
    const applyProfileUpdate = jest.fn();
    updateProfileMock.mockResolvedValue(updatedUser);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const auth = {
      user: currentUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      applyProfileUpdate,
      expireSession: jest.fn(),
    } satisfies AuthContextData;
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );

    const { result } = await renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: updatedUser.name });
    });

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock).toHaveBeenCalledWith(
      { name: updatedUser.name },
      { sessionGeneration: expect.any(Number) },
    );
    expect(applyProfileUpdate).toHaveBeenCalledWith(updatedUser, expect.any(Number));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('preserves the authenticated user and session when the update fails', async () => {
    const applyProfileUpdate = jest.fn();
    const expireSession = jest.fn();
    updateProfileMock.mockRejectedValue(new Error('profile update failed'));
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const auth = {
      user: currentUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      applyProfileUpdate,
      expireSession,
    } satisfies AuthContextData;
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
    const { result } = await renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'Nome Novo' })).rejects.toThrow(
        'profile update failed',
      );
    });

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(applyProfileUpdate).not.toHaveBeenCalled();
    expect(expireSession).not.toHaveBeenCalled();
    expect(auth.user).toEqual(currentUser);
    queryClient.clear();
  });
});
