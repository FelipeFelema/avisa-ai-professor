import { fireEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import ClassroomDetailsScreen from '../../app/(app)/classrooms/[id]';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { darkTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDeleteClassroom = jest.fn();
const mockLeaveClassroom = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));
jest.mock('@/hooks/useClassroomAnnouncements', () => ({
  useClassroomAnnouncements: jest.fn(),
}));
jest.mock('@/hooks/useDeleteClassroom', () => ({ useDeleteClassroom: jest.fn() }));
jest.mock('@/hooks/useLeaveClassroom', () => ({ useLeaveClassroom: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockUseAuth = jest.mocked(useAuth);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);
const mockUseClassroomAnnouncements = jest.mocked(useClassroomAnnouncements);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);
const mockUseLeaveClassroom = jest.mocked(useLeaveClassroom);

const classroom = {
  id: 'classroom-1',
  name: 'História do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

const announcement = {
  id: 'announcement-1',
  classroomId: classroom.id,
  title: 'Primeiro aviso',
  content: 'Conteúdo do primeiro aviso',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-10-04T00:00:00.000Z',
  author: { id: 'teacher-1', name: 'Prof. Ana' },
};

function collectText(node: unknown, result: string[] = []): string[] {
  if (typeof node === 'string') {
    result.push(node);
    return result;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, result));
    return result;
  }

  if (node && typeof node === 'object' && 'children' in node) {
    collectText((node as { children?: unknown }).children, result);
  }

  return result;
}

function setDetailsContext(
  userId: string | null,
  classrooms = [classroom],
  announcements: (typeof announcement)[] = [],
  role: 'PARENT' | 'PROFESSOR' | 'ADMIN' = 'PROFESSOR',
) {
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  mockUseLocalSearchParams.mockReturnValue({ id: classroom.id });
  mockUseAuth.mockReturnValue({
    user: userId
      ? {
          id: userId,
          name: 'Usuário de teste',
          email: 'teste@example.com',
          role,
        }
      : null,
  } as unknown as ReturnType<typeof useAuth>);
  mockUseMyClassrooms.mockReturnValue({
    data: classrooms,
    isLoading: false,
  } as unknown as ReturnType<typeof useMyClassrooms>);
  mockUseClassroomAnnouncements.mockReturnValue({
    data: announcements,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useClassroomAnnouncements>);
  mockUseDeleteClassroom.mockReturnValue({
    mutate: mockDeleteClassroom,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteClassroom>);
  mockUseLeaveClassroom.mockReturnValue({
    mutate: mockLeaveClassroom,
    isPending: false,
  } as unknown as ReturnType<typeof useLeaveClassroom>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setDetailsContext('owner-1');
});

describe('classroom details route', () => {
  it('orders classroom context, announcement section, cards, and final contextual action', async () => {
    setDetailsContext('owner-1', [classroom], [announcement]);

    const view = await renderWithProviders(
      <>
        <ClassroomDetailsScreen />
        <ThemeSwitcher />
      </>,
    );
    const text = collectText(view.toJSON());

    expect(text.indexOf(classroom.name)).toBeLessThan(text.indexOf('Comunicados'));
    expect(text.indexOf('Comunicados')).toBeLessThan(text.indexOf('+ Novo'));
    expect(text.indexOf('+ Novo')).toBeLessThan(text.indexOf(announcement.title));
    expect(text.indexOf(announcement.title)).toBeLessThan(text.indexOf('Excluir turma'));
    expect(view.getByRole('button', { name: 'Criar comunicado' })).toBeTruthy();

    await fireEvent.press(view.getByText('Select Escuro'));
    expect(StyleSheet.flatten(view.getByText(classroom.name).props.style).color).toBe(
      darkTheme.colors.text,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Criar comunicado' }));

    expect(mockPush).toHaveBeenCalledWith('/classrooms/classroom-1/new-announcement');
  });

  it('keeps member visibility and suppresses contextual actions for an unidentified user', async () => {
    setDetailsContext('member-1', [classroom], [], 'PARENT');
    const memberView = await renderWithProviders(<ClassroomDetailsScreen />);

    expect(memberView.getByRole('button', { name: 'Sair da turma' })).toBeTruthy();
    expect(memberView.queryByRole('button', { name: 'Excluir turma' })).toBeNull();
    expect(memberView.queryByRole('button', { name: 'Criar comunicado' })).toBeNull();
    await memberView.unmount();

    setDetailsContext(null);
    const unknownUserView = await renderWithProviders(<ClassroomDetailsScreen />);

    expect(unknownUserView.queryByRole('button', { name: 'Sair da turma' })).toBeNull();
    expect(unknownUserView.queryByRole('button', { name: 'Excluir turma' })).toBeNull();
  });

  it('keeps retry and safe return for classroom loading, error, and absence', async () => {
    const refetch = jest.fn();
    mockUseMyClassrooms.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch,
    } as never);
    let view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByText('Carregando turma')).toBeTruthy();
    await view.unmount();

    mockUseMyClassrooms.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    await view.unmount();

    mockUseMyClassrooms.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch,
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByText('Turma não encontrada')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Ver turmas' }));
    expect(mockReplace).toHaveBeenCalledWith('/classrooms');
  });

  it('keeps valid classroom actions after announcement loading or retryable error and removes them for 404', async () => {
    const refetchAnnouncements = jest.fn();
    setDetailsContext('owner-1');
    mockUseClassroomAnnouncements.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: refetchAnnouncements,
    } as never);
    let view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByText('Carregando comunicados')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Excluir turma' })).toBeTruthy();
    await view.unmount();

    mockUseClassroomAnnouncements.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network timeout'),
      refetch: refetchAnnouncements,
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByText('Não foi possível carregar os comunicados')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Excluir turma' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetchAnnouncements).toHaveBeenCalledTimes(1);
    await view.unmount();

    mockUseClassroomAnnouncements.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 404 } },
      refetch: refetchAnnouncements,
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByText('Turma não encontrada')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Excluir turma' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Ver turmas' }));
    expect(mockReplace).toHaveBeenCalledWith('/classrooms');
  });

  it('replaces the route with the classroom list only after successful owner deletion', async () => {
    mockDeleteClassroom.mockImplementation(
      (_classroomId: string, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    const { getByText, getAllByText } = await renderWithProviders(<ClassroomDetailsScreen />);

    await fireEvent.press(getByText('Excluir turma'));
    const confirmButtons = getAllByText('Excluir turma');
    await fireEvent.press(confirmButtons[confirmButtons.length - 1]);

    expect(mockDeleteClassroom).toHaveBeenCalledWith('classroom-1', expect.anything());
    expect(mockReplace).toHaveBeenCalledWith('/classrooms');
  });

  it('renders accessible not-found state with safe navigation after refresh removes the classroom', async () => {
    setDetailsContext('owner-1', []);

    const { getByText, getByRole } = await renderWithProviders(<ClassroomDetailsScreen />);

    expect(getByText('Turma não encontrada')).toBeTruthy();
    expect(getByText('Esta turma não está mais disponível.')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Ver turmas' }));

    expect(mockReplace).toHaveBeenCalledWith('/classrooms');
  });
});
