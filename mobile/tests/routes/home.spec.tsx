import { fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import HomeScreen from '../../app/(app)/(tabs)/index';
import { useAuth } from '@/hooks/useAuth';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { renderWithProviders } from '../helpers/render';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);

const mockPush = jest.fn();
const mockRefetch = jest.fn();
const referenceNow = new Date(2026, 8, 29, 12, 0, 0, 0);

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

function expirationIso(dayOffset: number) {
  const date = new Date(referenceNow);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(23, 0, 0, 0);
  return date.toISOString();
}

function setHomeState({
  data = [],
  isLoading = false,
  isError = false,
}: {
  data?: ClassroomFixture[];
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  mockUseRouter.mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() } as never);
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      name: 'Nome Atualizado',
      email: 'atual@example.com',
      role: 'PARENT',
    },
  } as never);
  mockUseMyClassrooms.mockReturnValue({
    data,
    isLoading,
    isError,
    refetch: mockRefetch,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(referenceNow);
  setHomeState();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('home primary surface', () => {
  it('renders the current profile name and a smaller greeting before the main title', async () => {
    const view = await renderWithProviders(<HomeScreen />);

    const greeting = view.getByText('Olá, Nome Atualizado 👋');
    const title = view.getByText('Bem-vindo ao Avisa Aí Professor');

    expect(greeting).toBeTruthy();
    expect(title).toBeTruthy();
    expect(view.getByRole('header', { name: /Bem-vindo ao Avisa Aí Professor/ })).toBeTruthy();
    expect(StyleSheet.flatten(greeting.props.style).fontSize).toBeLessThan(
      StyleSheet.flatten(title.props.style).fontSize,
    );
  });

  it('renders classroom information and only shows the active announcement expiration label', async () => {
    setHomeState({
      data: [
        {
          id: 'classroom-1',
          name: 'História do Brasil',
          ownerId: 'owner-1',
          teacher: { id: 'teacher-1', name: 'Professora Ana' },
          lastAnnouncement: {
            id: 'announcement-1',
            title: 'Avaliação amanhã',
            createdAt: referenceNow.toISOString(),
            expiresAt: expirationIso(1),
          },
        },
        {
          id: 'classroom-2',
          name: 'Geografia',
          ownerId: 'owner-2',
          teacher: { id: 'teacher-2', name: 'Professor Bruno' },
          lastAnnouncement: {
            id: 'announcement-2',
            title: 'Trabalho em sala',
            createdAt: referenceNow.toISOString(),
            expiresAt: expirationIso(0),
          },
        },
        {
          id: 'classroom-3',
          name: 'Ciências',
          ownerId: 'owner-3',
          teacher: { id: 'teacher-3', name: 'Professora Carla' },
          lastAnnouncement: {
            id: 'announcement-3',
            title: 'Projeto final',
            createdAt: referenceNow.toISOString(),
            expiresAt: expirationIso(4),
          },
        },
        {
          id: 'classroom-4',
          name: 'Matemática',
          ownerId: 'owner-4',
          teacher: null,
          lastAnnouncement: null,
        },
      ],
    });

    const { getByText, queryAllByText } = await renderWithProviders(<HomeScreen />);

    expect(getByText('História do Brasil')).toBeTruthy();
    expect(getByText('Professora Ana', { exact: false })).toBeTruthy();
    expect(getByText('Avaliação amanhã')).toBeTruthy();
    expect(getByText('Expira em 1 dia')).toBeTruthy();
    expect(getByText('Expira hoje')).toBeTruthy();
    expect(getByText('Expira em 4 dias')).toBeTruthy();
    expect(getByText('Nenhum comunicado disponível.')).toBeTruthy();
    expect(queryAllByText(/Expira/)).toHaveLength(3);
    expect(queryAllByText(/Expira em -\d+ dias/)).toHaveLength(0);
  });

  it('renders a distinct loading state instead of the empty state', async () => {
    setHomeState({ isLoading: true });

    const view = await renderWithProviders(<HomeScreen />);

    expect(view.getByRole('header', { name: 'Carregando suas turmas' })).toBeTruthy();
    expect(view.queryByText('Você ainda não participa de nenhuma turma.')).toBeNull();
  });

  it('renders an accessible error retry without conflating it with an empty result', async () => {
    setHomeState({ isError: true });

    const view = await renderWithProviders(<HomeScreen />);

    expect(
      view.getByRole('header', { name: 'Não foi possível carregar suas turmas' }),
    ).toBeTruthy();
    expect(view.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    expect(view.queryByText('Você ainda não participa de nenhuma turma.')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders the empty CTA only after a successful empty response', async () => {
    const view = await renderWithProviders(<HomeScreen />);

    expect(view.getByText('Você ainda não participa de nenhuma turma.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Ver turmas' }));

    expect(mockPush).toHaveBeenCalledWith('/classrooms');
  });
});
