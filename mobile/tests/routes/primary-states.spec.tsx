import { render } from '@testing-library/react-native';
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

function setClassroomsState({
  data = [],
  isLoading = false,
  isError = false,
}: {
  data?: (typeof classroom)[];
  isLoading?: boolean;
  isError?: boolean;
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
    refetch: jest.fn(),
  } as never);
  mockUseAvailableClassrooms.mockReturnValue({
    data: [],
    isLoading: false,
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
  it('exposes accessible loading and error states with a next action', async () => {
    setClassroomsState({ isLoading: true });
    const loadingView = await renderWithProviders(<ClassroomsScreen />);
    expect(getByAccessibilityRole(loadingView, 'summary')).toBeTruthy();
    expect(loadingView.getByRole('header', { name: 'Carregando turmas' })).toBeTruthy();

    setClassroomsState({ isError: true });
    const errorView = await renderWithProviders(<ClassroomsScreen />);
    expect(getByAccessibilityRole(errorView, 'summary')).toBeTruthy();
    expect(errorView.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });

  it('exposes an accessible empty state and a named success heading', async () => {
    setClassroomsState();
    const emptyView = await renderWithProviders(<ClassroomsScreen />);
    expect(getByAccessibilityRole(emptyView, 'summary')).toBeTruthy();
    expect(emptyView.getByText(/Voc/)).toBeTruthy();

    setClassroomsState({ data: [classroom] });
    const successView = await renderWithProviders(<ClassroomsScreen />);
    expect(successView.getByRole('header', { name: 'Turmas' })).toBeTruthy();
    expect(
      successView.getByRole('button', { name: 'Abrir turma Historia do Brasil' }),
    ).toBeTruthy();
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
