import { fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import ClassroomsScreen from '../../app/(app)/(tabs)/classrooms';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { renderWithProviders } from '../helpers/render';

const mockDeleteClassroom = jest.fn();
const mockLeaveClassroom = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));
jest.mock('@/hooks/useAvailableClassrooms', () => ({
  useAvailableClassrooms: jest.fn(),
}));
jest.mock('@/hooks/useJoinClassroom', () => ({ useJoinClassroom: jest.fn() }));
jest.mock('@/hooks/useLeaveClassroom', () => ({ useLeaveClassroom: jest.fn() }));
jest.mock('@/hooks/useDeleteClassroom', () => ({ useDeleteClassroom: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);
const mockUseAvailableClassrooms = jest.mocked(useAvailableClassrooms);
const mockUseJoinClassroom = jest.mocked(useJoinClassroom);
const mockUseLeaveClassroom = jest.mocked(useLeaveClassroom);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);

const classroom = {
  id: 'classroom-1',
  name: 'História do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

function setClassroomContext(userId: string) {
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  mockUseAuth.mockReturnValue({
    user: {
      id: userId,
      name: 'Usuário de teste',
      email: 'teste@example.com',
      role: 'PROFESSOR',
    },
  } as unknown as ReturnType<typeof useAuth>);
  mockUseMyClassrooms.mockReturnValue({
    data: [classroom],
    isLoading: false,
  } as unknown as ReturnType<typeof useMyClassrooms>);
  mockUseAvailableClassrooms.mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useAvailableClassrooms>);
  mockUseJoinClassroom.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useJoinClassroom>);
  mockUseLeaveClassroom.mockReturnValue({
    mutate: mockLeaveClassroom,
    isPending: false,
  } as unknown as ReturnType<typeof useLeaveClassroom>);
  mockUseDeleteClassroom.mockReturnValue({
    mutate: mockDeleteClassroom,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteClassroom>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setClassroomContext('owner-1');
});

describe('classrooms list route', () => {
  it('uses ownerId so the owner sees Excluir turma and never Sair', async () => {
    const { getByText, queryByText } = await renderWithProviders(<ClassroomsScreen />);

    expect(getByText('Excluir turma')).toBeTruthy();
    expect(queryByText('Sair')).toBeNull();
  });

  it('shows Sair for a non-owner and does not expose classroom deletion', async () => {
    setClassroomContext('member-1');

    const { getByText, queryByText } = await renderWithProviders(<ClassroomsScreen />);

    expect(getByText('Sair')).toBeTruthy();
    expect(queryByText('Excluir turma')).toBeNull();
  });

  it('shows the destructive summary and cancel performs zero delete mutations', async () => {
    const { getByText, getByRole } = await renderWithProviders(<ClassroomsScreen />);

    await fireEvent.press(getByRole('button', { name: 'Excluir turma: História do Brasil' }));

    expect(getByText('História do Brasil')).toBeTruthy();
    expect(getByText('Participantes e comunicados serão removidos permanentemente.')).toBeTruthy();

    await fireEvent.press(getByText('Cancelar'));

    expect(mockDeleteClassroom).not.toHaveBeenCalled();
  });
});
