import { fireEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ClassroomDetailsScreen from '../../app/(app)/classrooms/[id]';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { renderWithProviders } from '../helpers/render';

const mockReplace = jest.fn();
const mockDeleteClassroom = jest.fn();

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

const mockUseRouter = jest.mocked(useRouter);
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockUseAuth = jest.mocked(useAuth);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);
const mockUseClassroomAnnouncements = jest.mocked(useClassroomAnnouncements);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);

const classroom = {
  id: 'classroom-1',
  name: 'História do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

function setDetailsContext(userId: string, classrooms = [classroom]) {
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  mockUseLocalSearchParams.mockReturnValue({ id: classroom.id });
  mockUseAuth.mockReturnValue({
    user: {
      id: userId,
      name: 'Usuário de teste',
      email: 'teste@example.com',
      role: 'PROFESSOR',
    },
  } as unknown as ReturnType<typeof useAuth>);
  mockUseMyClassrooms.mockReturnValue({
    data: classrooms,
    isLoading: false,
  } as unknown as ReturnType<typeof useMyClassrooms>);
  mockUseClassroomAnnouncements.mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useClassroomAnnouncements>);
  mockUseDeleteClassroom.mockReturnValue({
    mutate: mockDeleteClassroom,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteClassroom>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setDetailsContext('owner-1');
});

describe('classroom details route', () => {
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
