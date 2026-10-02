import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import LoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import AppLayout from '../../app/(app)/_layout';
import AuthLayout from '../../app/(auth)/_layout';
import { STORAGE_KEYS } from '@/constants/storage';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '../helpers/render';
import { ThemeController, ThemeSwitcher } from '../helpers/theme';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: NativeText, View: NativeView } = require('react-native');

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(NativeText, { testID: 'redirect' }, href),
    Stack: ({ screenOptions }: { screenOptions: Record<string, unknown> }) =>
      React.createElement(
        NativeView,
        { testID: 'stack' },
        React.createElement(NativeText, { testID: 'stack-options' }, JSON.stringify(screenOptions)),
      ),
    Tabs: ({ screenOptions }: { screenOptions: Record<string, unknown> }) =>
      React.createElement(
        NativeView,
        { testID: 'tabs' },
        React.createElement(NativeText, { testID: 'tabs-options' }, JSON.stringify(screenOptions)),
      ),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('expo-status-bar', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');
  return {
    StatusBar: (props: Record<string, unknown>) =>
      React.createElement(NativeView, { ...props, testID: 'status-bar' }),
  };
});

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/providers/AppProvider', () => {
  const React = require('react');
  const { ThemeProvider } = require('@/providers/ThemeProvider');
  const { ThemeSwitcher: Switcher } = require('../helpers/theme');

  return {
    AppProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(React.Fragment, null, children, React.createElement(Switcher)),
      ),
  };
});

const mockUseAuth = jest.mocked(useAuth);
const mockGetItem = jest.mocked(AsyncStorage.getItem);
const mockSetItem = jest.mocked(AsyncStorage.setItem);
const login = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  login.mockReset();
  login.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login,
    register: jest.fn(),
  } as never);
});

describe('theme-aware app surfaces and navigation', () => {
  it('keeps Login input state and feedback styling across both themes', async () => {
    const view = await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(view.getByLabelText('E-mail'), 'ana@example.com');
    await fireEvent.changeText(view.getByLabelText('Senha'), 'senha-segura');

    await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));

    expect(view.getByLabelText('E-mail').props.value).toBe('ana@example.com');
    expect(view.getByLabelText('Senha').props.value).toBe('senha-segura');
    expect(view.getByLabelText('E-mail').props.placeholderTextColor).toBe('#B5C2BE');
    expect(view.getByText('Tema atual: Escuro')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('keeps Login form values and one pending authentication request through a theme change', async () => {
    let changeTheme!: (preference: 'light' | 'dark') => void;
    let pendingWasVisible = false;
    let view: Awaited<ReturnType<typeof renderWithProviders>>;
    login.mockImplementation(async () => {
      changeTheme('dark');
      await new Promise((resolve) => setTimeout(resolve, 0));
      pendingWasVisible =
        view.getByRole('button', { name: 'Entrando...' }).props.accessibilityState.busy === true;
    });

    view = await renderWithProviders(
      <>
        <LoginScreen />
        <ThemeController onReady={(setTheme) => (changeTheme = setTheme)} />
      </>,
    );
    await fireEvent.changeText(view.getByLabelText('E-mail'), 'ana@example.com');
    await fireEvent.changeText(view.getByLabelText('Senha'), 'senha-segura');

    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));

    expect(pendingWasVisible).toBe(true);
    expect(view.getByRole('radio', { name: 'Escuro' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(view.getByLabelText('E-mail').props.value).toBe('ana@example.com');
    expect(view.getByLabelText('Senha').props.value).toBe('senha-segura');
    expect(login).toHaveBeenCalledTimes(1);
    expect(login.mock.calls[0]?.[0]).toEqual({
      email: 'ana@example.com',
      password: 'senha-segura',
    });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('keeps Login errors and entered values after a theme change', async () => {
    login.mockRejectedValueOnce(new Error('request failed'));
    const view = await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(view.getByLabelText('E-mail'), 'ana@example.com');
    await fireEvent.changeText(view.getByLabelText('Senha'), 'senha-segura');
    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(view.getByText('Não foi possível realizar o login.')).toBeTruthy());
    await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));

    expect(view.getByLabelText('E-mail').props.value).toBe('ana@example.com');
    expect(view.getByLabelText('Senha').props.value).toBe('senha-segura');
    expect(view.getByText('Não foi possível realizar o login.')).toBeTruthy();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('restores the Login theme in Profile after remount and keeps it after logout', async () => {
    const loginView = await renderWithProviders(<LoginScreen />);
    await fireEvent.press(loginView.getByRole('radio', { name: 'Escuro' }));
    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.themePreference, 'dark');
    });
    await loginView.unmount();

    mockGetItem.mockResolvedValue('dark');
    const logout = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-theme-remount',
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'PROFESSOR',
      },
      isAuthenticated: true,
      isLoading: false,
      logout,
    } as never);

    const profileView = await renderWithProviders(<ProfileScreen />);
    await waitFor(() => expect(profileView.getByText('Tema atual: Escuro')).toBeTruthy());
    expect(
      profileView.getByRole('radio', { name: 'Escuro' }).props.accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(profileView.getByRole('button', { name: 'Sair da conta' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('keeps Cadastro form values and role controls while switching themes', async () => {
    const view = await renderWithProviders(
      <>
        <RegisterScreen />
        <ThemeSwitcher />
      </>,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Professor' }));
    await fireEvent.changeText(view.getByLabelText('Nome completo'), 'Ana Silva');

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(view.getByLabelText('Nome completo').props.value).toBe('Ana Silva');
    expect(view.getByRole('button', { name: 'Professor' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(view.getByRole('button', { name: 'Cadastrar' })).toBeTruthy();
  });

  it('keeps profile theme choices and long identity text accessible in both palettes', async () => {
    const longName = 'Ana Silva com um nome extenso para conferir a leitura em telas menores';
    const longEmail = 'ana.silva.comunicados+nome-longo@example.com';
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-long-profile',
        name: longName,
        email: longEmail,
        role: 'PROFESSOR',
      },
      isAuthenticated: true,
      isLoading: false,
      logout: jest.fn(),
    } as never);

    const view = await renderWithProviders(
      <>
        <ProfileScreen />
        <ThemeSwitcher />
      </>,
    );

    const expectProfileAccessibility = (selected: 'Claro' | 'Escuro') => {
      expect(view.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
      expect(view.getAllByRole('radio')).toHaveLength(2);
      expect(view.getByRole('radio', { name: selected }).props.accessibilityState.selected).toBe(
        true,
      );
      expect(
        view.getByRole('radio', { name: selected === 'Claro' ? 'Escuro' : 'Claro' }).props
          .accessibilityState.selected,
      ).toBe(false);
      expect(view.getByText(`Tema atual: ${selected}`)).toBeTruthy();

      for (const name of ['Editar perfil', 'Sair da conta']) {
        const action = view.getByRole('button', { name });
        expect(action.props.accessibilityRole).toBe('button');
        expect(view.getByText(name)).toBeTruthy();
      }
    };

    for (const value of [longName, longEmail]) {
      const identity = view.getByText(value);
      expect(identity.props.numberOfLines).toBeUndefined();
      expect(identity.props.allowFontScaling ?? true).toBe(true);
      expect(identity.props.maxFontSizeMultiplier).toBeUndefined();
    }

    expectProfileAccessibility('Claro');
    await fireEvent.press(view.getByText('Select Escuro'));
    expectProfileAccessibility('Escuro');
    await fireEvent.press(view.getByText('Select Claro'));
    expectProfileAccessibility('Claro');
  });

  it('matches public and authenticated stack backgrounds to the active palette', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false } as never);
    const publicView = await renderWithProviders(
      <>
        <AuthLayout />
        <ThemeSwitcher />
      </>,
    );
    const readPublicOptions = () =>
      JSON.parse(publicView.getByTestId('stack-options').props.children);
    expect(readPublicOptions().contentStyle.backgroundColor).toBe('#F4F1EC');
    await fireEvent.press(publicView.getByText('Select Escuro'));
    expect(readPublicOptions().contentStyle.backgroundColor).toBe('#111918');

    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false } as never);
    const privateView = await renderWithProviders(
      <>
        <AppLayout />
        <ThemeSwitcher />
      </>,
    );
    const readPrivateOptions = () =>
      JSON.parse(privateView.getByTestId('stack-options').props.children);
    expect(readPrivateOptions().contentStyle.backgroundColor).toBe('#F4F1EC');
    await fireEvent.press(privateView.getByText('Select Escuro'));
    expect(readPrivateOptions().contentStyle.backgroundColor).toBe('#111918');
  });

  it('updates tab colors while leaving the tab navigator mounted', async () => {
    const view = await renderWithProviders(
      <>
        <TabsLayout />
        <ThemeSwitcher />
      </>,
    );
    const readOptions = () => JSON.parse(view.getByTestId('tabs-options').props.children);

    expect(readOptions().tabBarActiveTintColor).toBe('#205B57');
    expect(readOptions().tabBarInactiveTintColor).toBe('#667085');
    const tabs = view.getByTestId('tabs');

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(readOptions().tabBarActiveTintColor).toBe('#71C7B8');
    expect(readOptions().tabBarInactiveTintColor).toBe('#A4B4B0');
    expect(readOptions().tabBarStyle.backgroundColor).toBe('#1A2523');
    expect(view.getByTestId('tabs')).toBe(tabs);
  });

  it('sets explicit status bar and navigation backgrounds for each root theme', async () => {
    const view = await render(<RootLayout />);
    const statusBar = () => view.getByTestId('status-bar');
    const rootSurface = () => view.getByTestId('root-theme-surface');
    const rootOptions = () => JSON.parse(view.getByTestId('stack-options').props.children);

    expect(statusBar().props.style).toBe('dark');
    expect(statusBar().props.backgroundColor).toBeUndefined();
    expect(rootSurface().props.style.backgroundColor).toBe('#F4F1EC');
    expect(rootOptions().contentStyle.backgroundColor).toBe('#F4F1EC');

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(statusBar().props.style).toBe('light');
    expect(rootSurface().props.style.backgroundColor).toBe('#111918');
    expect(rootOptions().contentStyle.backgroundColor).toBe('#111918');
  });
});
