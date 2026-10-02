import { act, fireEvent, waitFor } from '@testing-library/react-native';

import ClassroomsScreen from '../../app/(app)/(tabs)/classrooms';
import { announcementKeys, classroomKeys } from '@/config';
import { useRouter } from 'expo-router';
import * as classroomService from '@/services/classes/classroom.service';
import type { ClassroomSummary } from '@/types/classroom';
import { renderWithProviders } from '../helpers/render';
import {
  cacheAvailableClassroomVariants,
  cleanupClassroomSearchState,
  createClassroomSearchQueryClient,
  createDeferred,
} from '../helpers/classroom-search';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/services/classes/classroom.service', () => ({
  getAvailableClassrooms: jest.fn(),
  getMyClassrooms: jest.fn(),
  joinClassroom: jest.fn(),
  leaveClassroom: jest.fn(),
  deleteClassroom: jest.fn(),
}));

const mockUseRouter = jest.mocked(useRouter);
const getAvailableClassroomsMock = jest.mocked(classroomService.getAvailableClassrooms);
const getMyClassroomsMock = jest.mocked(classroomService.getMyClassrooms);
const joinClassroomMock = jest.mocked(classroomService.joinClassroom);
const leaveClassroomMock = jest.mocked(classroomService.leaveClassroom);
const deleteClassroomMock = jest.mocked(classroomService.deleteClassroom);

const mockPush = jest.fn();
const mockReplace = jest.fn();

const classroom: ClassroomSummary = {
  id: 'classroom-mat',
  name: 'Matemática',
  ownerId: 'teacher-1',
  teacher: { id: 'teacher-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

type AvailableRequest = {
  search: string;
  signal: AbortSignal;
  deferred?: ReturnType<typeof createDeferred<ClassroomSummary[]>>;
};

let isMember = false;
let isDeleted = false;
let availableDeferredQueue: ReturnType<typeof createDeferred<ClassroomSummary[]>>[];
let availableRequests: AvailableRequest[];

function currentAvailable(search: string): ClassroomSummary[] {
  if (isDeleted || isMember) {
    return [];
  }

  return classroom.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ? [classroom] : [];
}

function renderClassrooms(
  queryClient: ReturnType<typeof createClassroomSearchQueryClient>,
  role: 'PARENT' | 'PROFESSOR' = 'PARENT',
) {
  return renderWithProviders(<ClassroomsScreen />, {
    queryClient,
    auth: {
      user: {
        id: role === 'PROFESSOR' ? classroom.ownerId : 'parent-1',
        name: 'Usuário de teste',
        email: 'teste@example.com',
        role,
      },
      isAuthenticated: true,
      isLoading: false,
    } as never,
  });
}

async function settleSearchPause() {
  await act(async () => jest.advanceTimersByTime(300));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  isMember = false;
  isDeleted = false;
  availableDeferredQueue = [];
  availableRequests = [];
  mockPush.mockReset();
  mockReplace.mockReset();
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  getAvailableClassroomsMock.mockImplementation((search = '', signal) => {
    const deferred = availableDeferredQueue.shift();
    availableRequests.push({ search, signal: signal!, deferred });
    return deferred?.promise ?? Promise.resolve(currentAvailable(search ?? ''));
  });
  getMyClassroomsMock.mockImplementation(async () => (isMember && !isDeleted ? [classroom] : []));
  joinClassroomMock.mockImplementation(async () => {
    isMember = true;
  });
  leaveClassroomMock.mockImplementation(async () => {
    isMember = false;
  });
  deleteClassroomMock.mockImplementation(async () => {
    isDeleted = true;
    isMember = false;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('classroom search consistency through the real route and hooks', () => {
  it('joins under a filter, suppresses a late pre-mutation response, retries refresh, and revalidates an inactive term', async () => {
    const queryClient = createClassroomSearchQueryClient();
    cacheAvailableClassroomVariants(queryClient, [
      { search: '', data: [classroom] },
      { search: 'his', data: [classroom] },
    ]);
    const view = await renderClassrooms(queryClient);
    expect(view.getByRole('button', { name: `Entrar: ${classroom.name}` })).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText('Buscar turma pelo nome'), 'mat');
    await settleSearchPause();
    await waitFor(() =>
      expect(view.getByRole('button', { name: `Entrar: ${classroom.name}` })).toBeTruthy(),
    );

    const joinResponse = createDeferred<void>();
    joinClassroomMock.mockReturnValueOnce(
      joinResponse.promise.then(() => {
        isMember = true;
      }),
    );
    await fireEvent.press(view.getByRole('button', { name: `Entrar: ${classroom.name}` }));

    const oldSnapshot = createDeferred<ClassroomSummary[]>();
    availableDeferredQueue.push(oldSnapshot);
    let oldRefetch!: Promise<void>;
    await act(async () => {
      oldRefetch = queryClient.refetchQueries({
        queryKey: classroomKeys.available('mat'),
        type: 'active',
      });
      await waitFor(() =>
        expect(availableRequests.some((request) => request.deferred === oldSnapshot)).toBe(true),
      );
    });
    await waitFor(() => expect(view.getByText('Buscando turmas')).toBeTruthy());
    expect(view.queryByRole('button', { name: `Entrar: ${classroom.name}` })).toBeNull();

    const failedRefresh = createDeferred<ClassroomSummary[]>();
    availableDeferredQueue.push(failedRefresh);
    await act(async () => joinResponse.resolve());
    await waitFor(() =>
      expect(availableRequests.some((request) => request.deferred === failedRefresh)).toBe(true),
    );
    expect(
      availableRequests.find((request) => request.deferred === oldSnapshot)?.signal.aborted,
    ).toBe(true);
    expect(isMember).toBe(true);
    expect(queryClient.isMutating()).toBe(1);
    await waitFor(() => expect(view.getByText('Buscando turmas')).toBeTruthy());
    expect(view.queryByRole('button', { name: `Entrar: ${classroom.name}` })).toBeNull();

    await act(async () => failedRefresh.reject(new Error('refresh after join failed')));
    await waitFor(() => expect(view.getByText('Não foi possível buscar turmas')).toBeTruthy());
    expect(queryClient.isMutating()).toBe(0);
    expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy();

    await act(async () => {
      oldSnapshot.resolve([classroom]);
      await oldRefetch;
    });
    expect(view.getByText('Não foi possível buscar turmas')).toBeTruthy();
    expect(view.queryByRole('button', { name: `Entrar: ${classroom.name}` })).toBeNull();
    expect(queryClient.getQueryState(classroomKeys.available())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(classroomKeys.available('his'))?.isInvalidated).toBe(true);

    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(view.getByText('Nenhuma turma encontrada para «mat»')).toBeTruthy());
    expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy();
    expect(joinClassroomMock).toHaveBeenCalledTimes(1);

    const historyRefresh = createDeferred<ClassroomSummary[]>();
    availableDeferredQueue.push(historyRefresh);
    await fireEvent.changeText(view.getByLabelText('Buscar turma pelo nome'), 'his');
    expect(view.getByText('Aguardando pesquisa')).toBeTruthy();
    await settleSearchPause();
    await waitFor(() =>
      expect(availableRequests.some((request) => request.deferred === historyRefresh)).toBe(true),
    );
    await waitFor(() => expect(view.getByText('Buscando turmas')).toBeTruthy());
    expect(view.queryByRole('button', { name: `Entrar: ${classroom.name}` })).toBeNull();
    expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy();
    await act(async () => historyRefresh.resolve([]));
    await waitFor(() => expect(view.getByText('Nenhuma turma encontrada para «his»')).toBeTruthy());

    view.unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('keeps membership through cancelled, pending, and failed leave, then restores the filtered result on success', async () => {
    isMember = true;
    const queryClient = createClassroomSearchQueryClient();
    cacheAvailableClassroomVariants(queryClient, [{ search: 'mat', data: [] }]);
    queryClient.setQueryData(classroomKeys.my(), [classroom]);
    const view = await renderClassrooms(queryClient);
    await fireEvent.changeText(view.getByLabelText('Buscar turma pelo nome'), 'mat');
    await settleSearchPause();
    await waitFor(() => expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy());

    await fireEvent.press(view.getByLabelText(`Sair: ${classroom.name}`));
    expect(view.getByText('Seu acesso e sua participação serão removidos.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(leaveClassroomMock).not.toHaveBeenCalled();
    expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy();

    const failedLeave = createDeferred<void>();
    leaveClassroomMock.mockReturnValueOnce(failedLeave.promise);
    await fireEvent.press(view.getByLabelText(`Sair: ${classroom.name}`));
    await fireEvent.press(view.getByRole('button', { name: 'Sair da turma' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Aguarde...' })).toBeTruthy());
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([classroom]);
    await act(async () => failedLeave.reject(new Error('leave request failed')));
    await waitFor(() => expect(view.getByRole('button', { name: 'Sair da turma' })).toBeTruthy());
    expect(isMember).toBe(true);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([classroom]);

    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(view.getByLabelText(`Sair: ${classroom.name}`)).toBeTruthy();

    await fireEvent.press(view.getByLabelText(`Sair: ${classroom.name}`));
    await fireEvent.press(view.getByRole('button', { name: 'Sair da turma' }));
    await waitFor(() =>
      expect(view.getByRole('button', { name: `Entrar: ${classroom.name}` })).toBeTruthy(),
    );
    expect(isMember).toBe(false);
    expect(view.queryByLabelText(`Sair: ${classroom.name}`)).toBeNull();
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([classroom]);

    view.unmount();
    await cleanupClassroomSearchState(queryClient);
  });

  it('preserves an owner classroom on cancelled or failed deletion, then removes it across the active search', async () => {
    isMember = true;
    const queryClient = createClassroomSearchQueryClient();
    cacheAvailableClassroomVariants(queryClient, [
      { search: 'mat', data: [] },
      { search: 'his', data: [classroom] },
    ]);
    queryClient.setQueryData(classroomKeys.my(), [classroom]);
    queryClient.setQueryData(announcementKeys.byClassroom(classroom.id), []);
    const view = await renderClassrooms(queryClient, 'PROFESSOR');
    await fireEvent.changeText(view.getByLabelText('Buscar turma pelo nome'), 'mat');
    await settleSearchPause();
    await waitFor(() =>
      expect(view.getByLabelText(`Excluir turma: ${classroom.name}`)).toBeTruthy(),
    );

    await fireEvent.press(view.getByLabelText(`Excluir turma: ${classroom.name}`));
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(deleteClassroomMock).not.toHaveBeenCalled();
    expect(view.getByLabelText(`Excluir turma: ${classroom.name}`)).toBeTruthy();

    deleteClassroomMock.mockRejectedValueOnce(new Error('delete request failed'));
    await fireEvent.press(view.getByLabelText(`Excluir turma: ${classroom.name}`));
    await fireEvent.press(view.getByRole('button', { name: /^Excluir turma$/ }));
    await waitFor(() => expect(view.getByRole('button', { name: /^Excluir turma$/ })).toBeTruthy());
    expect(isDeleted).toBe(false);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([classroom]);

    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(view.getByLabelText(`Excluir turma: ${classroom.name}`)).toBeTruthy();

    await fireEvent.press(view.getByLabelText(`Excluir turma: ${classroom.name}`));
    await fireEvent.press(view.getByRole('button', { name: /^Excluir turma$/ }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/classrooms'));
    expect(isDeleted).toBe(true);
    expect(queryClient.getQueryData(classroomKeys.my())).toEqual([]);
    expect(queryClient.getQueryData(classroomKeys.available('mat'))).toEqual([]);
    expect(queryClient.getQueryState(classroomKeys.available('his'))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(announcementKeys.byClassroom(classroom.id))?.isInvalidated,
    ).toBe(true);
    expect(view.queryByLabelText(`Excluir turma: ${classroom.name}`)).toBeNull();

    view.unmount();
    await cleanupClassroomSearchState(queryClient);
  });
});
