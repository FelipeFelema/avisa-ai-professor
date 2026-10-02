import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import ProfileScreen from '../../app/(app)/(tabs)/profile';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '../helpers/render';

const push = jest.fn();
const replace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, replace, back: jest.fn() } as never);
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
  it('keeps header, avatar, identity values, and actions in reading order', async () => {
    const view = await renderWithProviders(<ProfileScreen />);
    const text = collectText(view.toJSON());

    expect(text.indexOf('Meu perfil')).toBeLessThan(text.indexOf('N'));
    expect(text.indexOf('N')).toBeLessThan(text.indexOf('Nome'));
    expect(text.indexOf('Nome')).toBeLessThan(text.indexOf('Nome Atual'));
    expect(text.indexOf('Nome Atual')).toBeLessThan(text.indexOf('E-mail'));
    expect(text.indexOf('E-mail')).toBeLessThan(text.indexOf('atual@example.com'));
    expect(text.indexOf('atual@example.com')).toBeLessThan(text.indexOf('Perfil'));
    expect(text.indexOf('Perfil')).toBeLessThan(text.indexOf('PROFESSOR'));
    expect(text.indexOf('PROFESSOR')).toBeLessThan(text.indexOf('Editar perfil'));
    expect(text.indexOf('Editar perfil')).toBeLessThan(text.indexOf('Sair da conta'));

    expect(view.getByText('Nome Atual')).toBeTruthy();
    expect(view.getByText('atual@example.com')).toBeTruthy();
    expect(view.getByText('PROFESSOR')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Editar perfil' }));
    expect(push).toHaveBeenCalledWith('/profile/edit');
  });

  it('wraps long identity values without replacing the current data', async () => {
    const longName = 'Nome muito extenso para uma pessoa que usa o aplicativo';
    const longEmail = 'pessoa.comunicados+texto-longo@example.com';
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: longName, email: longEmail, role: 'ADMIN' },
      logout: jest.fn(),
      isLoading: false,
    } as never);

    const view = await renderWithProviders(<ProfileScreen />);

    expect(view.getByText(longName).props.numberOfLines).toBeUndefined();
    expect(view.getByText(longEmail).props.numberOfLines).toBeUndefined();
    expect(view.getByText('ADMIN')).toBeTruthy();
  });

  it('keeps destructive logout pending and returns to login after success', async () => {
    let resolveLogout!: () => void;
    const logout = jest.fn(() => new Promise<void>((resolve) => (resolveLogout = resolve)));
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Nome Atual',
        email: 'atual@example.com',
        role: 'PROFESSOR',
      },
      logout,
      isLoading: false,
    } as never);

    const view = await renderWithProviders(<ProfileScreen />);
    const pressPromise = fireEvent.press(view.getByRole('button', { name: 'Sair da conta' }));

    await waitFor(() => expect(view.getByRole('button', { name: 'Aguarde...' })).toBeTruthy());
    expect(logout).toHaveBeenCalledTimes(1);
    expect(view.getByRole('button', { name: 'Aguarde...' }).props.accessibilityState.disabled).toBe(
      true,
    );

    await act(async () => {
      resolveLogout();
      await pressPromise;
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('keeps loading and unavailable-user states distinct, with a safe login action', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true } as never);
    let view = await renderWithProviders(<ProfileScreen />);
    expect(view.getByText('Carregando perfil')).toBeTruthy();
    await view.unmount();

    mockUseAuth.mockReturnValue({ user: null, isLoading: false } as never);
    view = await renderWithProviders(<ProfileScreen />);
    expect(view.getByText('Perfil não disponível')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));
    expect(replace).toHaveBeenCalledWith('/login');
  });
});

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
