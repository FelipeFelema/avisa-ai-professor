import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { classroomKeys } from '@/config';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import * as classroomService from '@/services/classes/classroom.service';
import type { ClassroomSummary } from '@/types/classroom';
import {
  cacheAvailableClassroomVariants,
  cleanupClassroomSearchState,
  createClassroomSearchQueryClient,
  createControlledAvailableClassroomService,
  createControlledMyClassroomService,
  createDeferred,
  observeAvailableClassroomVariants,
  observeMyClassrooms,
} from '../helpers/classroom-search';

jest.mock('@/services/classes/classroom.service', () => ({
  joinClassroom: jest.fn(),
}));

const joinClassroomMock = jest.mocked(classroomService.joinClassroom);

const classroom: ClassroomSummary = {
  id: 'classroom-mat',
  name: 'Matemática',
  ownerId: 'teacher-1',
  teacher: { id: 'teacher-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

const historyClassroom: ClassroomSummary = {
  ...classroom,
  id: 'classroom-history',
  name: 'História',
};

function createWrapper(queryClient: ReturnType<typeof createClassroomSearchQueryClient>) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useJoinClassroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels old list requests, awaits active refresh, and invalidates inactive search variants', async () => {
    joinClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    const my = createControlledMyClassroomService();
    cacheAvailableClassroomVariants(queryClient, [
      { search: '', data: [classroom] },
      { search: 'mat', data: [classroom] },
      { search: 'hist', data: [historyClassroom] },
    ]);
    queryClient.setQueryData(classroomKeys.my(), []);

    const variants = observeAvailableClassroomVariants(
      queryClient,
      [
        { search: 'mat', active: true },
        { search: '', active: false },
        { search: 'hist', active: false },
      ],
      available.getAvailableClassrooms,
    );
    const myObserver = observeMyClassrooms(queryClient, my.getMyClassrooms, { active: true });
    let oldRefresh!: Promise<void[]>;
    await act(async () => {
      oldRefresh = Promise.all([
        queryClient.refetchQueries({ queryKey: classroomKeys.my(), type: 'active' }),
        queryClient.refetchQueries({ queryKey: classroomKeys.available('mat'), type: 'active' }),
      ]);
      await waitFor(() => {
        expect(my.requests).toHaveLength(1);
        expect(available.requests).toHaveLength(1);
      });
    });

    const cancelQueries = jest.spyOn(queryClient, 'cancelQueries');
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useJoinClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void>;
    let mutationSettled = false;

    await act(async () => {
      mutationPromise = result.current.mutateAsync(classroom.id).then(() => {
        mutationSettled = true;
      });
      await waitFor(() => {
        expect(my.requests).toHaveLength(2);
        expect(available.requests).toHaveLength(2);
      });
    });

    expect(my.requests[0]?.signal.aborted).toBe(true);
    expect(available.requests[0]?.signal?.aborted).toBe(true);
    expect(mutationSettled).toBe(false);
    expect(result.current.isPending).toBe(true);
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.availableRoot() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: classroomKeys.availableRoot(),
    });
    expect(Math.max(...cancelQueries.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...invalidateQueries.mock.invocationCallOrder),
    );
    expect(queryClient.getQueryState(classroomKeys.available())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(classroomKeys.available('hist'))?.isInvalidated).toBe(true);
    expect(available.requests).toHaveLength(2);

    await act(async () => {
      available.requests[1]!.deferred.resolve([]);
      my.requests[1]!.deferred.resolve([classroom]);
      await mutationPromise;
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);
      expect(queryClient.getQueryData(classroomKeys.my())).toEqual([classroom]);
      expect(result.current.isPending).toBe(false);
    });

    await act(async () => {
      available.requests[0]!.deferred.resolve([classroom]);
      my.requests[0]!.deferred.resolve([]);
      await oldRefresh;
    });
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([classroom]);

    await act(async () => {
      variants.observers[1]!.activate();
      await waitFor(() => expect(available.requests).toHaveLength(3));
    });
    expect(available.requests[2]?.search).toBe('');
    await act(async () => available.requests[2]!.deferred.resolve([]));
    await waitFor(() =>
      expect(queryClient.getQueryState(classroomKeys.available())?.isInvalidated).toBe(false),
    );

    await act(async () => {
      variants.observers[2]!.activate();
      await waitFor(() => expect(available.requests).toHaveLength(4));
    });
    expect(available.requests[3]?.search).toBe('hist');
    await act(async () => available.requests[3]!.deferred.resolve([]));

    unmount();
    myObserver.dispose();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });

  it('does not change cached participation while join is pending or failed', async () => {
    const failure = new Error('network unavailable');
    const mutation = createDeferred<void>();
    joinClassroomMock.mockReturnValue(mutation.promise);
    const queryClient = createClassroomSearchQueryClient();
    cacheAvailableClassroomVariants(queryClient, [{ search: 'mat', data: [classroom] }]);
    queryClient.setQueryData(classroomKeys.my(), []);
    const cancelQueries = jest.spyOn(queryClient, 'cancelQueries');
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useJoinClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void>;

    await act(async () => {
      mutationPromise = result.current.mutateAsync(classroom.id);
      await waitFor(() => expect(result.current.isPending).toBe(true));
    });
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([classroom]);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      mutation.reject(failure);
      await expect(mutationPromise).rejects.toBe(failure);
    });
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([classroom]);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    expect(invalidateQueries).not.toHaveBeenCalled();

    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('keeps a successful join successful when the active list refresh fails', async () => {
    joinClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    cacheAvailableClassroomVariants(queryClient, [{ search: 'mat', data: [classroom] }]);
    const variants = observeAvailableClassroomVariants(
      queryClient,
      [{ search: 'mat', active: true }],
      available.getAvailableClassrooms,
    );
    const { result, unmount } = await renderHook(() => useJoinClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void>;

    await act(async () => {
      mutationPromise = result.current.mutateAsync(classroom.id);
      await waitFor(() => expect(available.requests).toHaveLength(1));
    });
    await act(async () => {
      available.requests[0]!.deferred.reject(new Error('refresh failed'));
      await mutationPromise;
    });

    expect(result.current.isError).toBe(false);
    expect(variants.observers[0]!.observer.getCurrentResult().isError).toBe(true);
    expect(variants.observers[0]!.observer.getCurrentResult().data).toEqual([classroom]);

    unmount();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });
});
