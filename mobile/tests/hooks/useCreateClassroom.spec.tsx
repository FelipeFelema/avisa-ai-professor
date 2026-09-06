import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { classroomKeys } from '@/config';
import { useCreateClassroom } from '@/hooks/useCreateClassroom';
import * as classroomService from '@/services/classes/classroom.service';

jest.mock('@/services/classes/classroom.service', () => ({
  createClassroom: jest.fn(),
}));

const createClassroomMock = jest.mocked(classroomService.createClassroom);

function createWrapper(queryClient: QueryClient) {
  return function TestQueryClientProvider({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCreateClassroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates classroom lists after successful creation', async () => {
    createClassroomMock.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: 2, gcTime: 0 },
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateClassroom(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: '7º Ano A' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(createClassroomMock).toHaveBeenCalledWith({ name: '7º Ano A' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.my() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: classroomKeys.available() });
  });
});
