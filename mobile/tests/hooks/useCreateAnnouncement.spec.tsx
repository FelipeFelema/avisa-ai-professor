import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { useCreateAnnouncement } from '@/hooks/useCreateAnnouncement';
import * as announcementsService from '@/services/announcements';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/services/announcements', () => ({
  createAnnouncement: jest.fn(),
}));

const mockUseRouter = jest.mocked(useRouter);
const createAnnouncementMock = jest.mocked(announcementsService.createAnnouncement);

function createWrapper(queryClient: QueryClient) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCreateAnnouncement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      back: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('invalidates the classroom announcement and summary after successful creation', async () => {
    createAnnouncementMock.mockResolvedValue({
      id: 'announcement-1',
      classroomId: 'classroom-1',
      title: 'Reunião',
      content: 'Reunião amanhã.',
      createdAt: '2026-09-06T12:00:00.000Z',
      expiresAt: '2026-09-13T12:00:00.000Z',
      author: { id: 'professor-1', name: 'Professor' },
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateAnnouncement(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        classroomId: 'classroom-1',
        title: 'Reunião',
        content: 'Reunião amanhã.',
        durationInDays: 7,
      });
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(createAnnouncementMock).toHaveBeenCalledWith({
      classroomId: 'classroom-1',
      title: 'Reunião',
      content: 'Reunião amanhã.',
      durationInDays: 7,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: announcementKeys.byClassroom('classroom-1'),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(mockUseRouter().back).toHaveBeenCalledTimes(1);
  });
});
