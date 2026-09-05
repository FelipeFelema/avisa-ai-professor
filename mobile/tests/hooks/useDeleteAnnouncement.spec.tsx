import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';
import * as announcementsService from '@/services/announcements';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/services/announcements', () => ({
  deleteAnnouncement: jest.fn(),
}));

const mockUseRouter = jest.mocked(useRouter);
const deleteAnnouncementMock = jest.mocked(announcementsService.deleteAnnouncement);

function createWrapper(queryClient: QueryClient) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteAnnouncement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      back: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('deletes the announcement, invalidates exact data keys, and leaves navigation to the screen', async () => {
    deleteAnnouncementMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteAnnouncement(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        announcementId: 'announcement-1',
        classroomId: 'classroom-1',
      });
    });

    expect(deleteAnnouncementMock).toHaveBeenCalledWith('announcement-1');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.detail('announcement-1'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(mockUseRouter().back).not.toHaveBeenCalled();
  });

  it('does not retry an ambiguous failure automatically', async () => {
    const failure = new Error('network timeout');
    deleteAnnouncementMock.mockRejectedValue(failure);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const { result } = await renderHook(() => useDeleteAnnouncement(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          announcementId: 'announcement-1',
          classroomId: 'classroom-1',
        }),
      ).rejects.toBe(failure);
    });

    expect(deleteAnnouncementMock).toHaveBeenCalledTimes(1);
  });
});
