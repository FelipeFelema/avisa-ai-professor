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
const mockJoinClassroom = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

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

type ClassroomFixture = {
  id: string;
  name: string;
  ownerId: string;
  teacher: { id: string; name: string } | null;
  lastAnnouncement: {
    id: string;
    title: string;
    createdAt: string;
    expiresAt: string;
  } | null;
};

const classroom: ClassroomFixture = {
  id: 'classroom-1',
  name: 'História do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

const availableClassroom: ClassroomFixture = {
  id: 'classroom-2',
  name: 'Matemática',
  ownerId: 'owner-2',
  teacher: { id: 'owner-2', name: 'Prof. Bruno' },
  lastAnnouncement: null,
};

type Role = 'PARENT' | 'PROFESSOR';

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

function setClassroomContext(
  userId: string,
  role: Role = 'PROFESSOR',
  availableData: ClassroomFixture[] = [],
  myData: ClassroomFixture[] = [classroom],
) {
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  mockUseAuth.mockReturnValue({
    user: {
      id: userId,
      name: 'Usuário de teste',
      email: 'teste@example.com',
      role,
    },
  } as unknown as ReturnType<typeof useAuth>);
  mockUseMyClassrooms.mockReturnValue({
    data: myData,
    isLoading: false,
  } as unknown as ReturnType<typeof useMyClassrooms>);
  mockUseAvailableClassrooms.mockReturnValue({
    data: availableData,
    isLoading: false,
  } as unknown as ReturnType<typeof useAvailableClassrooms>);
  mockUseJoinClassroom.mockReturnValue({
    mutate: mockJoinClassroom,
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
  it('keeps the introduction, search, and section order', async () => {
    const view = await renderWithProviders(<ClassroomsScreen />);
    const text = collectText(view.toJSON());

    expect(text.indexOf('Turmas')).toBeLessThan(text.indexOf('Buscar turmas'));
    expect(text.indexOf('Buscar turmas')).toBeLessThan(text.indexOf('Minhas turmas'));
    expect(text.indexOf('Minhas turmas')).toBeLessThan(text.indexOf('Turmas disponíveis'));
    expect(view.getByLabelText('Buscar turmas')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Minhas turmas' })).toBeTruthy();
    expect(view.getByRole('header', { name: 'Turmas disponíveis' })).toBeTruthy();
  });

  it('shows Criar turma only for Professor without reserving parent action space', async () => {
    const professorView = await renderWithProviders(<ClassroomsScreen />);
    expect(professorView.getByRole('button', { name: 'Criar turma' })).toBeTruthy();

    setClassroomContext('parent-1', 'PARENT');
    const parentView = await renderWithProviders(<ClassroomsScreen />);
    expect(parentView.queryByRole('button', { name: 'Criar turma' })).toBeNull();
    expect(parentView.queryByText('Criar turma')).toBeNull();
  });

  it('preserves the search value and forwards the unchanged search parameter', async () => {
    const view = await renderWithProviders(<ClassroomsScreen />);
    const input = view.getByLabelText('Buscar turmas');

    await fireEvent.changeText(input, 'matemática');

    expect(mockUseAvailableClassrooms).toHaveBeenLastCalledWith('matemática');
    expect(input.props.value).toBe('matemática');
  });

  it('keeps shared card order and contextual empty meaning with variable content', async () => {
    const longName = 'Turma de Ciências com um nome muito comprido para uma tela estreita';
    const longAnnouncement =
      'Comunicado com um título longo que precisa continuar legível sem deslocar a ação';

    setClassroomContext(
      'owner-1',
      'PROFESSOR',
      [],
      [
        {
          id: 'classroom-long',
          name: longName,
          ownerId: 'owner-1',
          teacher: null,
          lastAnnouncement: {
            id: 'announcement-long',
            title: longAnnouncement,
            createdAt: '2026-09-29T12:00:00.000Z',
            expiresAt: '2026-10-02T23:59:59.000Z',
          },
        },
      ],
    );

    const populatedView = await renderWithProviders(<ClassroomsScreen />);
    const text = collectText(populatedView.toJSON());
    const nameIndex = text.indexOf(longName);
    const teacherIndex = text.findIndex((value) => value.startsWith('Professor:'));
    const labelIndex = text.indexOf('Último comunicado');
    const announcementIndex = text.indexOf(longAnnouncement);

    expect(populatedView.getByText(longName)).toBeTruthy();
    expect(populatedView.getByText(longAnnouncement)).toBeTruthy();
    expect(populatedView.getByText('Professor: Professor não informado')).toBeTruthy();
    expect(nameIndex).toBeGreaterThanOrEqual(0);
    expect(nameIndex).toBeLessThan(teacherIndex);
    expect(teacherIndex).toBeLessThan(labelIndex);
    expect(labelIndex).toBeLessThan(announcementIndex);
    expect(populatedView.getByRole('button', { name: `Abrir turma ${longName}` })).toBeTruthy();

    setClassroomContext('owner-1', 'PROFESSOR', [], []);
    const emptyView = await renderWithProviders(<ClassroomsScreen />);

    expect(emptyView.getByText(/Você ainda não participa/)).toBeTruthy();
    expect(emptyView.getByText(/Entre em uma turma/)).toBeTruthy();
    expect(emptyView.getByText('Nenhuma turma disponível')).toBeTruthy();
    expect(emptyView.getByText(/Quando houver novas turmas/)).toBeTruthy();
  });

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

  it('keeps opening, joining, leaving, and deleting as separate actions', async () => {
    const ownerView = await renderWithProviders(<ClassroomsScreen />);

    await fireEvent.press(
      ownerView.getByRole('button', { name: 'Abrir turma História do Brasil' }),
    );
    expect(mockPush).toHaveBeenCalledWith('/classrooms/classroom-1');
    expect(mockDeleteClassroom).not.toHaveBeenCalled();
    expect(mockLeaveClassroom).not.toHaveBeenCalled();

    setClassroomContext('member-1', 'PARENT', [availableClassroom]);
    const memberView = await renderWithProviders(<ClassroomsScreen />);

    await fireEvent.press(memberView.getByRole('button', { name: 'Entrar: Matemática' }));
    expect(mockJoinClassroom).toHaveBeenCalledWith('classroom-2');

    await fireEvent.press(memberView.getByRole('button', { name: 'Sair: História do Brasil' }));
    await fireEvent.press(memberView.getByRole('button', { name: 'Sair da turma' }));
    expect(mockLeaveClassroom).toHaveBeenCalledWith('classroom-1', expect.anything());

    setClassroomContext('owner-1');
    const ownerActionView = await renderWithProviders(<ClassroomsScreen />);
    await fireEvent.press(
      ownerActionView.getByRole('button', { name: 'Excluir turma: História do Brasil' }),
    );
    await fireEvent.press(ownerActionView.getByRole('button', { name: /^Excluir turma$/ }));
    expect(mockDeleteClassroom).toHaveBeenCalledWith('classroom-1', expect.anything());
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
