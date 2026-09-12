import { useRouter } from 'expo-router';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: jest.fn(), replace: jest.fn(), back: jest.fn() } as never);
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      name: 'Nome Atualizado',
      email: 'atual@example.com',
      role: 'PARENT',
    },
  } as never);
  mockUseMyClassrooms.mockReturnValue({ data: [], isLoading: false } as never);
});

describe('home identity display', () => {
  it('renders the current profile name in the greeting without restarting the app', async () => {
    const { getByText } = await renderWithProviders(<HomeScreen />);

    expect(getByText('Olá, Nome Atualizado 👋')).toBeTruthy();
  });
});
