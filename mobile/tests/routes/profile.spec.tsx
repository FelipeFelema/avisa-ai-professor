import { fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import ProfileScreen from '../../app/(app)/(tabs)/profile';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '../helpers/render';

const push = jest.fn();

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, replace: jest.fn(), back: jest.fn() } as never);
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      name: 'Nome Atual',
      email: 'atual@example.com',
      role: 'PROFESSOR',
    },
    logout: jest.fn(),
  } as never);
});

describe('profile route', () => {
  it('shows the current identity and offers self-service profile editing', async () => {
    const { getByText } = await renderWithProviders(<ProfileScreen />);

    expect(getByText('Nome Atual')).toBeTruthy();
    expect(getByText('atual@example.com')).toBeTruthy();
    expect(getByText('PROFESSOR')).toBeTruthy();

    await fireEvent.press(getByText('Editar perfil'));
    expect(push).toHaveBeenCalledWith('/profile/edit');
  });
});
