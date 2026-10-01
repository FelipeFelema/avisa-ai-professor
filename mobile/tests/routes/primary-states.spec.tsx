import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import ClassroomsScreen from '../../app/(app)/(tabs)/classrooms';
import { AnnouncementCard } from '@/components/announcements';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { renderWithProviders } from '../helpers/render';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAvailableClassrooms', () => ({ useAvailableClassrooms: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useDeleteClassroom', () => ({ useDeleteClassroom: jest.fn() }));
jest.mock('@/hooks/useJoinClassroom', () => ({ useJoinClassroom: jest.fn() }));
jest.mock('@/hooks/useLeaveClassroom', () => ({ useLeaveClassroom: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAvailableClassrooms = jest.mocked(useAvailableClassrooms);
const mockUseAuth = jest.mocked(useAuth);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);
const mockUseJoinClassroom = jest.mocked(useJoinClassroom);
const mockUseLeaveClassroom = jest.mocked(useLeaveClassroom);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);

const mockRefetchClassrooms = jest.fn();
const mockRefetchAvailableClassrooms = jest.fn();

type TreeNode = {
  props?: Record<string, unknown>;
  children?: Array<TreeNode | string>;
};

function getByAccessibilityRole(view: { root: unknown }, role: string) {
  function find(node: TreeNode | string): TreeNode | undefined {
    if (typeof node === 'string') {
      return undefined;
    }

    if (node.props?.accessibilityRole === role) {
      return node;
    }

    for (const child of node.children ?? []) {
      const match = find(child);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  const match = find(view.root as TreeNode);
  expect(match).toBeDefined();
  return match;
}

const classroom = {
  id: 'classroom-1',
  name: 'Historia do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Professora Ana' },
  lastAnnouncement: null,
};

const availableClassroom = {
  id: 'classroom-2',
  name: 'Matemática',
  ownerId: 'owner-2',
  teacher: { id: 'owner-2', name: 'Professora Beatriz' },
  lastAnnouncement: null,
};

function setClassroomsState({
  data = [],
  isLoading = false,
  isError = false,
  availableData = [],
  availableLoading = false,
  availableError = false,
}: {
  data?: (typeof classroom)[];
  isLoading?: boolean;
  isError?: boolean;
  availableData?: (typeof availableClassroom)[];
  availableLoading?: boolean;
  availableError?: boolean;
} = {}) {
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never);
  mockUseAuth.mockReturnValue({
    user: {
      id: 'owner-1',
      name: 'Professora Ana',
      email: 'ana@example.com',
      role: 'PROFESSOR',
    },
  } as never);
  mockUseMyClassrooms.mockReturnValue({
    data,
    isLoading,
    isError,
    refetch: mockRefetchClassrooms,
  } as never);
  mockUseAvailableClassrooms.mockReturnValue({
    data: availableData,
    isLoading: availableLoading,
    isError: availableError,
    refetch: mockRefetchAvailableClassrooms,
  } as never);
  mockUseJoinClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  mockUseLeaveClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  mockUseDeleteClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  setClassroomsState();
});

describe('primary route states and semantics', () => {
  it('keeps loading and error states independent for both classroom sections', async () => {
    setClassroomsState({ isLoading: true, availableData: [availableClassroom] });
    const myLoadingView = await renderWithProviders(<ClassroomsScreen />);
    expect(myLoadingView.getByRole('header', { name: 'Minhas turmas' })).toBeTruthy();
    expect(myLoadingView.getByRole('header', { name: 'Turmas disponíveis' })).toBeTruthy();
    expect(myLoadingView.getByRole('header', { name: 'Carregando suas turmas' })).toBeTruthy();
    expect(myLoadingView.getByRole('button', { name: 'Entrar: Matemática' })).toBeTruthy();

    setClassroomsState({ data: [classroom], availableLoading: true });
    const availableLoadingView = await renderWithProviders(<ClassroomsScreen />);
    expect(
      availableLoadingView.getByRole('button', { name: 'Abrir turma Historia do Brasil' }),
    ).toBeTruthy();
    expect(availableLoadingView.getByRole('header', { name: 'Buscando turmas' })).toBeTruthy();

    setClassroomsState({ isError: true, availableData: [availableClassroom] });
    const myErrorView = await renderWithProviders(<ClassroomsScreen />);
    expect(
      myErrorView.getByRole('header', { name: 'Não foi possível carregar suas turmas' }),
    ).toBeTruthy();
    expect(myErrorView.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    expect(myErrorView.getByRole('button', { name: 'Entrar: Matemática' })).toBeTruthy();
    expect(mockRefetchClassrooms).not.toHaveBeenCalled();

    setClassroomsState({ data: [classroom], availableError: true });
    const availableErrorView = await renderWithProviders(<ClassroomsScreen />);
    expect(
      availableErrorView.getByRole('header', { name: 'Não foi possível buscar turmas' }),
    ).toBeTruthy();
    expect(
      availableErrorView.getByRole('button', { name: 'Abrir turma Historia do Brasil' }),
    ).toBeTruthy();
    await fireEvent.press(availableErrorView.getByRole('button', { name: 'Tentar novamente' }));
    expect(mockRefetchAvailableClassrooms).toHaveBeenCalledTimes(1);
  });

  it('associates empty and populated results with their own accessible sections', async () => {
    setClassroomsState({ availableData: [availableClassroom] });
    const availableResultsView = await renderWithProviders(<ClassroomsScreen />);
    expect(getByAccessibilityRole(availableResultsView, 'summary')).toBeTruthy();
    expect(availableResultsView.getByText(/Você ainda não participa/)).toBeTruthy();
    expect(availableResultsView.getByRole('button', { name: 'Entrar: Matemática' })).toBeTruthy();
    expect(availableResultsView.queryByText('Nenhuma turma disponível')).toBeNull();

    setClassroomsState({ data: [classroom] });
    const myResultsView = await renderWithProviders(<ClassroomsScreen />);
    expect(myResultsView.getByRole('header', { name: 'Turmas' })).toBeTruthy();
    expect(
      myResultsView.getByRole('button', { name: 'Abrir turma Historia do Brasil' }),
    ).toBeTruthy();
    expect(myResultsView.getByText('Nenhuma turma disponível')).toBeTruthy();
    expect(myResultsView.queryByText(/Você ainda não participa/)).toBeNull();
  });

  it('gives announcement cards a discoverable button role and name', async () => {
    const view = await render(
      <AnnouncementCard
        title="Aviso importante"
        content="Leia este comunicado."
        author="Professora Ana"
        onPress={jest.fn()}
      />,
    );

    expect(view.getByRole('button', { name: /Aviso importante/ })).toBeTruthy();
  });
});
