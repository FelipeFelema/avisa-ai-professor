import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import * as classroomService from '@/services/classes/classroom.service';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';

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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.available() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
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
    expect(deleteClassroomMock).toHaveBeenCalledWith('classroom-1');

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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.available() });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
  });
});
