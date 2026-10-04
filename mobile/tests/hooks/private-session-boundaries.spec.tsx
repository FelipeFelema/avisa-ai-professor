import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import type { AxiosResponse } from 'axios';

import { api } from '@/lib';
import { invalidateSessionGeneration } from '@/lib/session-generation';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useCreateClassroom } from '@/hooks/useCreateClassroom';

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return { ...actual, api: { get: jest.fn(), post: jest.fn() } };
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('private operations at a session boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes cancellation to private reads and discards a response from an old generation', async () => {
    const pending = deferred<AxiosResponse>();
    jest.mocked(api.get).mockReturnValue(pending.promise);
    const { queryClient, wrapper } = setup();
    const hook = await renderHook(() => useMyClassrooms(), { wrapper });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const config = jest.mocked(api.get).mock.calls[0]?.[1] as { signal?: AbortSignal };
    expect(config.signal).toBeInstanceOf(AbortSignal);
    invalidateSessionGeneration();
    queryClient.clear();
    expect(config.signal?.aborted).toBe(true);

    pending.resolve({ data: [{ id: 'private-classroom' }] } as AxiosResponse);
    await act(async () => Promise.resolve());

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    await hook.unmount();
  });

  it('suppresses stale mutation cache effects and caller success callbacks', async () => {
    const pending = deferred<AxiosResponse>();
    const lateFailure = deferred<AxiosResponse>();
    jest
      .mocked(api.post)
      .mockReturnValueOnce(pending.promise)
      .mockReturnValueOnce(lateFailure.promise);
    const { queryClient, wrapper } = setup();
    const hook = await renderHook(() => useCreateClassroom(), { wrapper });
    const onSuccess = jest.fn();
    let mutation!: Promise<void | undefined>;

    act(() => {
      mutation = hook.result.current.mutateAsync({ name: 'Turma temporária' }, { onSuccess });
    });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    invalidateSessionGeneration();
    queryClient.clear();
    pending.resolve({ data: undefined } as AxiosResponse);

    await act(async () => {
      await expect(mutation).resolves.toBeUndefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);

    const onError = jest.fn();
    let failedMutation!: Promise<void | undefined>;
    act(() => {
      failedMutation = hook.result.current.mutateAsync({ name: 'Turma temporária' }, { onError });
    });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    invalidateSessionGeneration();
    queryClient.clear();
    lateFailure.reject(new Error('late private failure'));

    await act(async () => {
      await expect(failedMutation).resolves.toBeUndefined();
    });
    expect(onError).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
    await hook.unmount();
  });
});
