import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import * as classroomService from '@/services/classes/classroom.service';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { invalidateSessionGeneration } from '@/lib/session-generation';
import type { ClassroomSummary } from '@/types/classroom';
import {
  cacheAvailableClassroomVariants,
  cleanupClassroomSearchState,
  createClassroomSearchQueryClient,
  createControlledAvailableClassroomService,
  createControlledMyClassroomService,
  observeAvailableClassroomVariants,
  observeMyClassrooms,
} from '../helpers/classroom-search';

jest.mock('@/services/classes/classroom.service', () => ({
  deleteClassroom: jest.fn(),
}));

const deleteClassroomMock = jest.mocked(
  (
    classroomService as typeof classroomService & {
      deleteClassroom: (classroomId: string) => Promise<void>;
    }
  ).deleteClassroom,
);

const classroom: ClassroomSummary = {
  id: 'classroom-mat',
  name: 'Matemática',
  ownerId: 'teacher-1',
  teacher: { id: 'teacher-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

function createWrapper(queryClient: QueryClient) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteClassroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates the exact joined, available, and classroom announcement keys on success', async () => {
    deleteClassroomMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('classroom-1');
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.availableRoot() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
  });

  it('prevents old snapshots from restoring a deleted classroom across cached terms', async () => {
    deleteClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    const my = createControlledMyClassroomService();
    cacheAvailableClassroomVariants(queryClient, [
      { search: '', data: [classroom] },
      { search: 'mat', data: [classroom] },
      { search: 'hist', data: [classroom] },
    ]);
    queryClient.setQueryData(classroomKeys.my(), [classroom]);
    queryClient.setQueryData(announcementKeys.byClassroom(classroom.id), []);
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

    const { result, unmount } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void>;
    await act(async () => {
      mutationPromise = result.current.mutateAsync(classroom.id);
      await waitFor(() => {
        expect(my.requests).toHaveLength(2);
        expect(available.requests).toHaveLength(2);
      });
    });

    expect(my.requests[0]?.signal.aborted).toBe(true);
    expect(available.requests[0]?.signal?.aborted).toBe(true);
    expect(queryClient.getQueryState(classroomKeys.available())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(classroomKeys.available('hist'))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(announcementKeys.byClassroom(classroom.id))?.isInvalidated,
    ).toBe(true);
    expect(available.requests).toHaveLength(2);

    await act(async () => {
      available.requests[1]!.deferred.resolve([]);
      my.requests[1]!.deferred.resolve([]);
      await mutationPromise;
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);
      expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    });
    await act(async () => {
      available.requests[0]!.deferred.resolve([classroom]);
      my.requests[0]!.deferred.resolve([classroom]);
      await oldRefresh;
    });
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);

    unmount();
    myObserver.dispose();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });

  it('keeps a confirmed deletion successful when the active list refresh fails', async () => {
    deleteClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    cacheAvailableClassroomVariants(queryClient, [{ search: 'mat', data: [classroom] }]);
    const variants = observeAvailableClassroomVariants(
      queryClient,
      [{ search: 'mat', active: true }],
      available.getAvailableClassrooms,
    );
    const { result, unmount } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void>;

    await act(async () => {
      mutationPromise = result.current.mutateAsync(classroom.id);
      await waitFor(() => expect(available.requests).toHaveLength(1));
    });
    await act(async () => {
      available.requests[0]!.deferred.reject(new Error('list refresh failed'));
      await mutationPromise;
    });

    expect(result.current.isError).toBe(false);
    expect(variants.observers[0]!.observer.getCurrentResult().isError).toBe(true);

    unmount();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });

  it('skips cache invalidation if the session changes during query cancellation', async () => {
    deleteClassroomMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    let releaseCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => {
      releaseCancellation = resolve;
    });
    const cancelQueries = jest
      .spyOn(queryClient, 'cancelQueries')
      .mockImplementation(async () => cancellation);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });
    let mutationPromise!: Promise<void | undefined>;

    try {
      await act(async () => {
        mutationPromise = result.current.mutateAsync('classroom-1');
        await waitFor(() => expect(cancelQueries).toHaveBeenCalledTimes(2));
      });
      invalidateSessionGeneration();
      await act(async () => {
        releaseCancellation();
        await mutationPromise;
      });

      expect(deleteClassroomMock).toHaveBeenCalledTimes(1);
      expect(invalidateQueries).not.toHaveBeenCalled();
      await expect(mutationPromise).resolves.toBeUndefined();
    } finally {
      releaseCancellation();
      jest.restoreAllMocks();
    }
  });

  it('ignores a second deletion while the first request is in flight', async () => {
    let resolveDelete!: () => void;
    deleteClassroomMock.mockImplementation(
      () => new Promise<void>((resolve) => (resolveDelete = resolve)),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const { result } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate('classroom-1');
      result.current.mutate('classroom-1');
      await waitFor(() => expect(result.current.isPending).toBe(true));
    });

    expect(deleteClassroomMock).toHaveBeenCalledTimes(1);
    expect(deleteClassroomMock).toHaveBeenCalledWith('classroom-1', {
      sessionGeneration: expect.any(Number),
    });

    await act(async () => {
      resolveDelete();
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('does not retry an ambiguous network failure automatically', async () => {
    const ambiguousFailure = new Error('network timeout');
    deleteClassroomMock.mockRejectedValue(ambiguousFailure);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const { result } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('classroom-1')).rejects.toBe(ambiguousFailure);
    });

    expect(deleteClassroomMock).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit second confirmation and accepts a receipt-backed 204 success', async () => {
    const ambiguousFailure = new Error('network timeout');
    deleteClassroomMock.mockRejectedValueOnce(ambiguousFailure).mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('classroom-1')).rejects.toBe(ambiguousFailure);
    });
    expect(deleteClassroomMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await expect(result.current.mutateAsync('classroom-1')).resolves.toBeUndefined();
    });

    expect(deleteClassroomMock).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.availableRoot() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
  });
});
