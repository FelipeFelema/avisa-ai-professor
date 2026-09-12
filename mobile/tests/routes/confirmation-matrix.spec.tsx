import { fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import AnnouncementDetailsScreen from '../../app/(app)/announcements/[id]';
import EditAnnouncementScreen from '../../app/(app)/announcements/[id]/edit';
import ClassroomsScreen from '../../app/(app)/(tabs)/classrooms';
import ClassroomDetailsScreen from '../../app/(app)/classrooms/[id]';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useUpdateAnnouncement } from '@/hooks/useUpdateAnnouncement';
import { renderWithProviders } from '../helpers/render';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useAnnouncement', () => ({ useAnnouncement: jest.fn() }));
jest.mock('@/hooks/useAvailableClassrooms', () => ({ useAvailableClassrooms: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useClassroomAnnouncements', () => ({
  useClassroomAnnouncements: jest.fn(),
}));
jest.mock('@/hooks/useDeleteAnnouncement', () => ({ useDeleteAnnouncement: jest.fn() }));
jest.mock('@/hooks/useDeleteClassroom', () => ({ useDeleteClassroom: jest.fn() }));
jest.mock('@/hooks/useJoinClassroom', () => ({ useJoinClassroom: jest.fn() }));
jest.mock('@/hooks/useLeaveClassroom', () => ({ useLeaveClassroom: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));
jest.mock('@/hooks/useUpdateAnnouncement', () => ({ useUpdateAnnouncement: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockUseAnnouncement = jest.mocked(useAnnouncement);
const mockUseAvailableClassrooms = jest.mocked(useAvailableClassrooms);
const mockUseAuth = jest.mocked(useAuth);
const mockUseClassroomAnnouncements = jest.mocked(useClassroomAnnouncements);
const mockUseDeleteAnnouncement = jest.mocked(useDeleteAnnouncement);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);
const mockUseJoinClassroom = jest.mocked(useJoinClassroom);
const mockUseLeaveClassroom = jest.mocked(useLeaveClassroom);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);
const mockUseUpdateAnnouncement = jest.mocked(useUpdateAnnouncement);

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const announcement = {
  id: 'announcement-1',
  classroomId: 'classroom-1',
  title: 'Aviso atual',
  content: 'Conteudo atual',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-09-08T00:00:00.000Z',
  author: { id: 'teacher-1', name: 'Prof. Ana' },
};

const classroom = {
  id: 'classroom-1',
  name: 'Historia do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

function setAnnouncementContext() {
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  mockUseLocalSearchParams.mockReturnValue({ id: announcement.id });
  mockUseAnnouncement.mockReturnValue({
    data: announcement,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useAnnouncement>);
  mockUseAuth.mockReturnValue({
    user: {
      id: 'teacher-1',
      name: 'Prof. Ana',
      email: 'ana@example.com',
      role: 'PROFESSOR',
    },
  } as unknown as ReturnType<typeof useAuth>);
}

function setClassroomContext({
  userId = 'member-1',
  role = 'PARENT',
  myClassrooms = [classroom],
  availableClassrooms = [],
}: {
  userId?: string;
  role?: 'PARENT' | 'PROFESSOR' | 'ADMIN';
  myClassrooms?: (typeof classroom)[];
  availableClassrooms?: (typeof classroom)[];
} = {}) {
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  mockUseLocalSearchParams.mockReturnValue({ id: classroom.id });
  mockUseAuth.mockReturnValue({
    user: {
      id: userId,
      name: 'Usuario de teste',
      email: 'teste@example.com',
      role,
    },
  } as unknown as ReturnType<typeof useAuth>);
  mockUseMyClassrooms.mockReturnValue({
    data: myClassrooms,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useMyClassrooms>);
  mockUseAvailableClassrooms.mockReturnValue({
    data: availableClassrooms,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useAvailableClassrooms>);
  mockUseClassroomAnnouncements.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useClassroomAnnouncements>);
  mockUseJoinClassroom.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useJoinClassroom>);
  mockUseDeleteClassroom.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteClassroom>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setAnnouncementContext();
  setClassroomContext();
  mockUseUpdateAnnouncement.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(announcement),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateAnnouncement>);
  mockUseDeleteAnnouncement.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteAnnouncement>);
  mockUseLeaveClassroom.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useLeaveClassroom>);
});

describe('confirmation matrix', () => {
  it('confirms announcement updates with a diff, preserves values on cancel, and blocks a double tap', async () => {
    setAnnouncementContext();
    let resolveUpdate!: (value: typeof announcement) => void;
    const mutateAsync = jest.fn(
      () => new Promise<typeof announcement>((resolve) => (resolveUpdate = resolve)),
    );
    mockUseUpdateAnnouncement.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateAnnouncement>);

    const view = await renderWithProviders(<EditAnnouncementScreen />);
    await fireEvent.changeText(view.getByDisplayValue('Aviso atual'), 'Novo aviso');
    await fireEvent.press(view.getByRole('button', { name: 'Atualizar comunicado' }));

    expect(view.getAllByText(/Novo aviso/).length).toBeGreaterThan(0);
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(view.getByPlaceholderText('Digite o título').props.value).toBe('Novo aviso');

    await fireEvent.press(view.getByRole('button', { name: 'Atualizar comunicado' }));
    const confirmButton = view.getAllByRole('button', { name: 'Atualizar comunicado' }).at(-1);
    if (!confirmButton) throw new Error('Botão de confirmação da atualização não encontrado');
    await fireEvent.press(confirmButton);
    await fireEvent.press(confirmButton);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      announcementId: announcement.id,
      classroomId: announcement.classroomId,
      data: {
        title: 'Novo aviso',
        content: announcement.content,
        durationInDays: 7,
      },
    });

    resolveUpdate(announcement);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('keeps the announcement editor and confirmation open after an update failure', async () => {
    setAnnouncementContext();
    const failure = new Error('network timeout');
    const mutateAsync = jest.fn().mockRejectedValue(failure);
    mockUseUpdateAnnouncement.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateAnnouncement>);

    const view = await renderWithProviders(<EditAnnouncementScreen />);
    await fireEvent.changeText(view.getByDisplayValue('Conteudo atual'), 'Conteudo novo');
    await fireEvent.press(view.getByRole('button', { name: 'Atualizar comunicado' }));
    await fireEvent.press(view.getByRole('button', { name: 'Atualizar comunicado' }));

    await waitFor(() =>
      expect(
        view.getByText('Não foi possível concluir. Verifique sua conexão e tente novamente.'),
      ).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(view.getByPlaceholderText('Digite o comunicado...').props.value).toBe('Conteudo novo');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('confirms announcement deletion, sends no request on cancel, and blocks a double tap', async () => {
    setAnnouncementContext();
    let resolveDelete!: () => void;
    const mutateAsync = jest.fn(() => new Promise<void>((resolve) => (resolveDelete = resolve)));
    mockUseDeleteAnnouncement.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteAnnouncement>);

    const view = await renderWithProviders(<AnnouncementDetailsScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Excluir comunicado' }));
    expect(view.getAllByText('Aviso atual').length).toBeGreaterThan(0);
    expect(view.getByText('Esta ação é irreversível.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(mutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Excluir comunicado' }));
    const confirmButton = view.getAllByRole('button', { name: 'Excluir comunicado' }).at(-1);
    if (!confirmButton) throw new Error('Botão de confirmação da exclusão não encontrado');
    await fireEvent.press(confirmButton);
    await fireEvent.press(confirmButton);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      announcementId: announcement.id,
      classroomId: announcement.classroomId,
    });

    resolveDelete();
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('keeps announcement detail context after a failed deletion', async () => {
    setAnnouncementContext();
    const failure = new Error('network timeout');
    const mutateAsync = jest.fn().mockRejectedValue(failure);
    mockUseDeleteAnnouncement.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteAnnouncement>);

    const view = await renderWithProviders(<AnnouncementDetailsScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Excluir comunicado' }));
    await fireEvent.press(view.getByRole('button', { name: 'Excluir comunicado' }));

    await waitFor(() =>
      expect(
        view.getByText('Não foi possível concluir. Verifique sua conexão e tente novamente.'),
      ).toBeTruthy(),
    );
    expect(view.getAllByText('Aviso atual').length).toBeGreaterThan(0);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('confirms non-owner leave while join and classroom creation remain direct actions', async () => {
    const leaveMutation = jest.fn();
    const joinMutation = jest.fn();
    mockUseLeaveClassroom.mockReturnValue({
      mutate: leaveMutation,
      isPending: false,
    } as unknown as ReturnType<typeof useLeaveClassroom>);
    mockUseJoinClassroom.mockReturnValue({
      mutate: joinMutation,
      isPending: false,
    } as unknown as ReturnType<typeof useJoinClassroom>);

    const view = await renderWithProviders(<ClassroomsScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Sair: Historia do Brasil' }));
    expect(view.getByRole('button', { name: 'Sair da turma' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(leaveMutation).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Sair: Historia do Brasil' }));
    const leaveConfirm = view.getByRole('button', { name: 'Sair da turma' });
    await fireEvent.press(leaveConfirm);
    await fireEvent.press(leaveConfirm);
    expect(leaveMutation).toHaveBeenCalledTimes(1);

    const available = { ...classroom, id: 'classroom-2', name: 'Quimica' };
    setClassroomContext({
      userId: 'teacher-1',
      role: 'PROFESSOR',
      myClassrooms: [],
      availableClassrooms: [available],
    });
    mockUseJoinClassroom.mockReturnValue({
      mutate: joinMutation,
      isPending: false,
    } as unknown as ReturnType<typeof useJoinClassroom>);
    const availableView = await renderWithProviders(<ClassroomsScreen />);
    await fireEvent.press(availableView.getByRole('button', { name: 'Entrar: Quimica' }));
    await fireEvent.press(availableView.getByRole('button', { name: 'Criar turma' }));

    expect(joinMutation).toHaveBeenCalledWith('classroom-2');
    expect(router.push).toHaveBeenCalledWith('/classrooms/new');
    expect(availableView.queryByText('Confirmar')).toBeNull();
  });

  it('offers leave rather than delete on classroom details for a non-owner', async () => {
    setClassroomContext({ userId: 'member-1', role: 'PARENT' });
    const leaveMutation = jest.fn();
    mockUseLeaveClassroom.mockReturnValue({
      mutate: leaveMutation,
      isPending: false,
    } as unknown as ReturnType<typeof useLeaveClassroom>);

    const view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByRole('button', { name: 'Sair da turma' })).toBeTruthy();
    expect(view.queryByText('Excluir turma')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Sair da turma' }));
    expect(view.getByText('Seu acesso e sua participação serão removidos.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(leaveMutation).not.toHaveBeenCalled();
  });
});
