import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import * as classroomService from '@/services/classes/classroom.service';
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
  leaveClassroom: jest.fn(),
}));

const leaveClassroomMock = jest.mocked(classroomService.leaveClassroom);

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

describe('useLeaveClassroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not retry and invalidates classroom and announcement data after success', async () => {
    leaveClassroomMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useLeaveClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('classroom-1');
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(leaveClassroomMock).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.availableRoot() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: announcementKeys.all });
  });

  it('cancels old snapshots, awaits eligible reappearance, and leaves inactive variants stale', async () => {
    leaveClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    const my = createControlledMyClassroomService();
    cacheAvailableClassroomVariants(queryClient, [
      { search: '', data: [] },
      { search: 'mat', data: [] },
      { search: 'hist', data: [] },
    ]);
    queryClient.setQueryData(classroomKeys.my(), [classroom]);
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

    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useLeaveClassroom(), {
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
    expect(available.requests).toHaveLength(2);

    await act(async () => {
      available.requests[1]!.deferred.resolve([classroom]);
      my.requests[1]!.deferred.resolve([]);
      await mutationPromise;
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([classroom]);
      expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    });
    await act(async () => {
      available.requests[0]!.deferred.resolve([]);
      my.requests[0]!.deferred.resolve([classroom]);
      await oldRefresh;
    });
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([classroom]);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.availableRoot() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: announcementKeys.all });

    unmount();
    myObserver.dispose();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });

  it('keeps leave confirmed when the refreshed list reports an error', async () => {
    leaveClassroomMock.mockResolvedValue(undefined);
    const queryClient = createClassroomSearchQueryClient();
    const available = createControlledAvailableClassroomService();
    cacheAvailableClassroomVariants(queryClient, [{ search: 'mat', data: [] }]);
    const variants = observeAvailableClassroomVariants(
      queryClient,
      [{ search: 'mat', active: true }],
      available.getAvailableClassrooms,
    );
    const { result, unmount } = await renderHook(() => useLeaveClassroom(), {
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
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);

    unmount();
    await variants.dispose();
    await cleanupClassroomSearchState(queryClient);
  });

  it('does not retry an ambiguous failure automatically', async () => {
    const failure = new Error('network timeout');
    leaveClassroomMock.mockRejectedValue(failure);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const { result } = await renderHook(() => useLeaveClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('classroom-1')).rejects.toBe(failure);
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(leaveClassroomMock).toHaveBeenCalledTimes(1);
  });
});
