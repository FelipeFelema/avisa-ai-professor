import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { invalidateSessionGeneration } from '@/lib/session-generation';
import { updateProfile } from '@/services/auth';
import type { AuthContextData, AuthUser } from '@/types/auth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';

jest.mock('@/services/auth', () => ({ updateProfile: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const applyProfileUpdate = jest.fn();
  const auth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(async () => undefined),
    register: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
    applyProfileUpdate,
    expireSession: jest.fn(async () => undefined),
  } as AuthContextData;
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper, applyProfileUpdate };
}

describe('late mutation effects at a session boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not restore a profile identity or call consumers after cleanup', async () => {
    const pending = deferred<AuthUser>();
    jest.mocked(updateProfile).mockReturnValue(pending.promise);
    const { queryClient, wrapper, applyProfileUpdate } = setup();
    const hook = await renderHook(() => useUpdateProfile(), { wrapper });
    await waitFor(() => expect(hook.result.current).not.toBeNull());
    const onSuccess = jest.fn();
    let mutation!: Promise<AuthUser | undefined>;

    act(() => {
      mutation = hook.result.current.mutateAsync({ name: 'Updated name' }, { onSuccess });
    });
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    invalidateSessionGeneration();
    queryClient.clear();
    pending.resolve({
      id: 'user-1',
      name: 'Updated name',
      email: 'user@example.com',
      role: 'PARENT',
    });

    await act(async () => {
      await expect(mutation).resolves.toBeUndefined();
    });
    expect(applyProfileUpdate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    await hook.unmount();
  });
});
