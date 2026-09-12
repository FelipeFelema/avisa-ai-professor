import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import * as classroomService from '@/services/classes/classroom.service';

jest.mock('@/services/classes/classroom.service', () => ({
  leaveClassroom: jest.fn(),
}));

const leaveClassroomMock = jest.mocked(classroomService.leaveClassroom);

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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.available() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: announcementKeys.all });
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
