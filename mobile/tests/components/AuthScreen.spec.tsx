import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { darkTheme, theme } from '@/theme';
import { ThemeSwitcher } from '../helpers/theme';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUseRouter = jest.mocked(useRouter);

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
};

async function renderAuthScreen(backButton?: { fallbackHref: '/login' }) {
  return render(
    <ThemeProvider>
      <AuthScreen
        eyebrow="Avisa Aí Professor"
        title="Título"
        subtitle="Subtítulo"
        backButton={backButton}
        footer={<Text>Rodapé</Text>}
      >
        <Text>Conteúdo</Text>
      </AuthScreen>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AuthScreen', () => {
  it('keeps the form scrollable with handled keyboard taps and platform behavior', async () => {
    const view = await renderAuthScreen();
    const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
    const keyboardView = view.getByTestId(`auth-screen-keyboard-avoiding-view-${keyboardBehavior}`);
    const scrollView = view.getByTestId('auth-screen-scroll-view');
    const contentStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);

    expect(keyboardView.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flex: 1 })]),
    );
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(JSON.stringify(contentStyle)).toContain('flexGrow');
    expect(JSON.stringify(contentStyle)).toContain(String(theme.spacing.xxxl));
  });

  it('uses padding behavior on iOS when the keyboard is open', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    const view = await renderAuthScreen();

    expect(view.getByTestId('auth-screen-keyboard-avoiding-view-padding')).toBeTruthy();
  });

  it('renders the optional registration back button outside the scroll view', async () => {
    router.canGoBack.mockReturnValue(false);
    const view = await renderAuthScreen({ fallbackHref: '/login' });
    const scrollView = view.getByTestId('auth-screen-scroll-view');
    const backButton = view.getByRole('button', { name: 'Voltar' });
    let ancestor = backButton.parent;
    let isInsideScrollView = false;

    while (ancestor) {
      if (ancestor === scrollView) {
        isInsideScrollView = true;
        break;
      }
      ancestor = ancestor.parent;
    }

    expect(isInsideScrollView).toBe(false);

    await fireEvent.press(backButton);

    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not render a back button for the login variant', async () => {
    const view = await renderAuthScreen();

    expect(view.queryByRole('button', { name: 'Voltar' })).toBeNull();
  });

  it('updates the public auth surface colors when the active theme changes', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeSwitcher />
        <AuthScreen eyebrow="Avisa" title="Entrar" subtitle="Acesse sua conta">
          <Text>Campos</Text>
        </AuthScreen>
      </ThemeProvider>,
    );

    expect(StyleSheet.flatten(view.getByText('Entrar').props.style).color).toBe(theme.colors.text);
    await fireEvent.press(view.getByText('Select Escuro'));
    expect(view.getByTestId('active-theme').props.children).toBe('dark');
    expect(StyleSheet.flatten(view.getByText('Entrar').props.style).color).toBe(
      darkTheme.colors.text,
    );
  });
});
