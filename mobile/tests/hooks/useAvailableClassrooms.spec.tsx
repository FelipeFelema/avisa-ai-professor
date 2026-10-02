import { act, renderHook, waitFor } from '@testing-library/react-native';

import { classroomKeys } from '@/config';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import * as classroomService from '@/services/classes/classroom.service';
import type { ClassroomSummary } from '@/types/classroom';
import {
  createClassroomSearchQueryClient,
  createDeferred,
  createClassroomSearchQueryWrapper,
  cleanupClassroomSearchState,
} from '../helpers/classroom-search';

jest.mock('@/services/classes/classroom.service', () => ({
  getAvailableClassrooms: jest.fn(),
}));

const getAvailableClassroomsMock = jest.mocked(classroomService.getAvailableClassrooms);

const classroomA: ClassroomSummary = {
  id: 'classroom-a',
  name: 'Matemática A',
  ownerId: 'teacher-a',
  teacher: { id: 'teacher-a', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

const classroomB: ClassroomSummary = {
  ...classroomA,
  id: 'classroom-b',
  name: 'Matemática B',
};

describe('useAvailableClassrooms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not query while disabled and uses the normalized criterion when enabled', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const deferred = createDeferred<ClassroomSummary[]>();
    getAvailableClassroomsMock.mockReturnValue(deferred.promise);
    const wrapper = createClassroomSearchQueryWrapper(queryClient);
    const { result, rerender, unmount } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useAvailableClassrooms('  matemática  ', { enabled }),
      { initialProps: { enabled: false }, wrapper },
    );

    expect(getAvailableClassroomsMock).not.toHaveBeenCalled();
    await act(async () => rerender({ enabled: true }));
    await waitFor(() => expect(getAvailableClassroomsMock).toHaveBeenCalledTimes(1));
    expect(getAvailableClassroomsMock).toHaveBeenCalledWith('matemática', expect.any(AbortSignal));

    await act(async () => deferred.resolve([classroomA]));
    await waitFor(() => expect(result.current.data).toEqual([classroomA]));
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('reuses the same normalized query identity for trim-equivalent terms', async () => {
    const queryClient = createClassroomSearchQueryClient();
    getAvailableClassroomsMock.mockResolvedValue([classroomA]);
    const { result, rerender, unmount } = await renderHook(
      ({ term }: { term: string }) => useAvailableClassrooms(term),
      {
        initialProps: { term: 'matemática' },
        wrapper: createClassroomSearchQueryWrapper(queryClient),
      },
    );

    await waitFor(() => expect(result.current.data).toEqual([classroomA]));
    await act(async () => rerender({ term: '  matemática  ' }));

    expect(classroomKeys.available('matemática')).toEqual(
      classroomKeys.available('  matemática  '),
    );
    expect(getAvailableClassroomsMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([classroomA]);
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('aborts the prior request on key change and never presents its data as a placeholder', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const requestA = createDeferred<ClassroomSummary[]>();
    const requestB = createDeferred<ClassroomSummary[]>();
    const requests: {
      search: string | undefined;
      signal: AbortSignal;
      promise: Promise<ClassroomSummary[]>;
    }[] = [];
    getAvailableClassroomsMock.mockImplementation((search, signal) => {
      const promise = search === 'a' ? requestA.promise : requestB.promise;
      requests.push({ search, signal: signal!, promise });
      return promise;
    });
    const { result, rerender, unmount } = await renderHook(
      ({ term }: { term: string }) => useAvailableClassrooms(term),
      { initialProps: { term: 'a' }, wrapper: createClassroomSearchQueryWrapper(queryClient) },
    );

    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => rerender({ term: 'b' }));
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(requests[0]?.signal.aborted).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);

    await act(async () => requestB.resolve([classroomB]));
    await waitFor(() => expect(result.current.data).toEqual([classroomB]));
    await act(async () => requestA.resolve([classroomA]));

    expect(result.current.data).toEqual([classroomB]);
    expect(result.current.isError).toBe(false);
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('ignores a late rejection from an earlier term after the latest term succeeds', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const requestA = createDeferred<ClassroomSummary[]>();
    const requestB = createDeferred<ClassroomSummary[]>();
    getAvailableClassroomsMock.mockImplementation((search) =>
      search === 'a' ? requestA.promise : requestB.promise,
    );
    const { result, rerender, unmount } = await renderHook(
      ({ term }: { term: string }) => useAvailableClassrooms(term),
      { initialProps: { term: 'a' }, wrapper: createClassroomSearchQueryWrapper(queryClient) },
    );

    await waitFor(() => expect(getAvailableClassroomsMock).toHaveBeenCalledTimes(1));
    await act(async () => rerender({ term: 'b' }));
    await waitFor(() => expect(getAvailableClassroomsMock).toHaveBeenCalledTimes(2));
    await act(async () => requestB.resolve([classroomB]));
    await waitFor(() => expect(result.current.data).toEqual([classroomB]));
    await act(async () => requestA.reject(new Error('late error from A')));

    expect(result.current.data).toEqual([classroomB]);
    expect(result.current.isError).toBe(false);
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('refreshes an invalidated cached variant when it becomes active again', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const oldData = [classroomA];
    const freshData = [classroomB];
    const deferred = createDeferred<ClassroomSummary[]>();
    getAvailableClassroomsMock.mockReturnValue(deferred.promise);
    const key = classroomKeys.available('matemática');
    queryClient.setQueryData(key, oldData);
    await queryClient.invalidateQueries({ queryKey: key, refetchType: 'none' });

    const { result, unmount } = await renderHook(() => useAvailableClassrooms('matemática'), {
      wrapper: createClassroomSearchQueryWrapper(queryClient),
    });

    await waitFor(() => expect(getAvailableClassroomsMock).toHaveBeenCalledTimes(1));
    expect(result.current.data).toEqual(oldData);
    expect(result.current.isFetching).toBe(true);
    await act(async () => deferred.resolve(freshData));
    await waitFor(() => expect(result.current.data).toEqual(freshData));
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('keeps query errors visible over cached data so the route can prioritize retry', async () => {
    const queryClient = createClassroomSearchQueryClient();
    const failure = new Error('offline');
    getAvailableClassroomsMock.mockRejectedValue(failure);
    const key = classroomKeys.available('matemática');
    queryClient.setQueryData(key, [classroomA]);
    await queryClient.invalidateQueries({ queryKey: key, refetchType: 'none' });

    const { result, unmount } = await renderHook(() => useAvailableClassrooms('matemática'), {
      wrapper: createClassroomSearchQueryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual([classroomA]);
    unmount();
    await cleanupClassroomSearchState(queryClient);
  });
});
