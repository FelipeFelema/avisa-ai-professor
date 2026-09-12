import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { useUpdateAnnouncement } from '@/hooks/useUpdateAnnouncement';
import * as announcementsService from '@/services/announcements';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/services/announcements', () => ({
  updateAnnouncement: jest.fn(),
}));

const mockUseRouter = jest.mocked(useRouter);
const updateAnnouncementMock = jest.mocked(announcementsService.updateAnnouncement);

function createWrapper(queryClient: QueryClient) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateAnnouncement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      back: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('updates the announcement, invalidates exact data keys, and leaves navigation to the screen', async () => {
    const data = {
      title: 'Novo aviso',
      content: 'Conteudo atualizado',
      durationInDays: 15 as const,
    };
    updateAnnouncementMock.mockResolvedValue({
      id: 'announcement-1',
      classroomId: 'classroom-1',
      title: data.title,
      content: data.content,
      createdAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2026-09-16T00:00:00.000Z',
      author: { id: 'teacher-1', name: 'Prof. Ana' },
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useUpdateAnnouncement(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        announcementId: 'announcement-1',
        classroomId: 'classroom-1',
        data,
      });
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(updateAnnouncementMock).toHaveBeenCalledWith('announcement-1', data);
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
    updateAnnouncementMock.mockRejectedValue(failure);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const { result } = await renderHook(() => useUpdateAnnouncement(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          announcementId: 'announcement-1',
          classroomId: 'classroom-1',
          data: {
            title: 'Novo aviso',
            content: 'Conteudo atualizado',
            durationInDays: 7,
          },
        }),
      ).rejects.toBe(failure);
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(updateAnnouncementMock).toHaveBeenCalledTimes(1);
  });
});
