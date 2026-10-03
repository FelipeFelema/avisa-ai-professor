import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import ProfileScreen from '../../app/(app)/(tabs)/profile';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '../helpers/render';

const push = jest.fn();
const replace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);
const mockSetItem = jest.mocked(AsyncStorage.setItem);

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
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
  it.each(['PARENT', 'PROFESSOR', 'ADMIN'] as const)(
    'offers a separate password action for %s preserving profile and theme',
    async (role) => {
      mockUseAuth.mockReturnValue({
        user: { id: 'u', name: 'Nome Atual', email: 'atual@example.com', role },
        logout: jest.fn(),
      } as never);
      const view = await renderProfile();
      await fireEvent.press(view.getByRole('button', { name: 'Alterar senha' }));
      expect(push).toHaveBeenCalledWith('/profile/change-password');
      expect(view.getByText(role)).toBeTruthy();
      expect(view.getByTestId('theme-selector')).toBeTruthy();
      expect(view.getByRole('button', { name: 'Editar perfil' })).toBeTruthy();
      expect(view.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();
    },
  );
  it('keeps header, avatar, identity values, and actions in reading order', async () => {
    const view = await renderProfile();
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

    const view = await renderProfile();

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

    const view = await renderProfile();
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
    let view = await renderProfile();
    expect(view.getByText('Carregando perfil')).toBeTruthy();
    await view.unmount();

    mockUseAuth.mockReturnValue({ user: null, isLoading: false } as never);
    view = await renderProfile();
    expect(view.getByText('Perfil não disponível')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('offers accessible Claro and Escuro choices and restyles without remounting the profile scroll', async () => {
    const view = await renderProfile();
    const scrollView = view.getByTestId('profile-scroll-view');

    expect(view.getByTestId('theme-selector')).toBeTruthy();
    expect(view.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
    expect(view.getAllByLabelText(/^(Claro|Escuro)$/)).toHaveLength(2);
    expect(view.getByLabelText('Claro').props.accessibilityState.selected).toBe(true);
    expect(view.getByText('Tema atual: Claro')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('profile-screen').props.style).backgroundColor).toBe(
      '#F4F1EC',
    );

    await fireEvent.press(view.getByLabelText('Escuro'));
    await fireEvent.press(view.getByLabelText('Escuro'));

    expect(view.getByLabelText('Escuro').props.accessibilityState.selected).toBe(true);
    expect(view.getByText('Tema atual: Escuro')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('profile-screen').props.style).backgroundColor).toBe(
      '#111918',
    );
    expect(view.getByTestId('profile-scroll-view')).toBe(scrollView);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(view.getByRole('button', { name: 'Editar perfil' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the selected theme active and warns if saving the choice fails', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('storage unavailable'));
    const view = await renderProfile();

    await fireEvent.press(view.getByLabelText('Escuro'));

    expect(view.getByLabelText('Escuro').props.accessibilityState.selected).toBe(true);
    await waitFor(() => {
      expect(
        view.getByText(
          'A aparência mudou, mas a preferência pode não permanecer após fechar o aplicativo.',
        ),
      ).toBeTruthy();
    });
    expect(StyleSheet.flatten(view.getByTestId('profile-screen').props.style).backgroundColor).toBe(
      '#111918',
    );
  });
});

function renderProfile() {
  return renderWithProviders(<ProfileScreen />);
}

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
