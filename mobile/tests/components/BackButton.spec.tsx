import { Ionicons } from '@expo/vector-icons';
import { fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { darkTheme, theme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
});

describe('BackButton', () => {
  it('exposes accessible text and the Android minimum touch target', async () => {
    const view = await renderWithProviders(<BackButton fallbackHref="/login" />);
    const button = view.getByRole('button', { name: 'Voltar' });
    const style =
      typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;
    const flattenedStyle = StyleSheet.flatten(style);

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Voltar');
    expect(view.getByText('Voltar')).toBeTruthy();
    expect(flattenedStyle.minHeight).toBeGreaterThanOrEqual(theme.targets.android);
    expect(flattenedStyle.minWidth).toBeGreaterThanOrEqual(theme.targets.android);
  });

  it('uses history when available and never calls the fallback', async () => {
    router.canGoBack.mockReturnValue(true);
    const view = await renderWithProviders(<BackButton fallbackHref="/login" />);

    await fireEvent.press(view.getByRole('button', { name: 'Voltar' }));

    expect(router.canGoBack).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the fallback when history is unavailable', async () => {
    router.canGoBack.mockReturnValue(false);
    const view = await renderWithProviders(<BackButton fallbackHref="/classrooms" />);

    await fireEvent.press(view.getByRole('button', { name: 'Voltar' }));

    expect(router.canGoBack).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/classrooms');
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('allows only one transition during consecutive taps', async () => {
    router.canGoBack.mockReturnValue(true);
    const view = await renderWithProviders(<BackButton fallbackHref="/login" />);
    const button = view.getByRole('button', { name: 'Voltar' });

    await fireEvent.press(button);
    await fireEvent.press(button);

    const lockedButton = view.getByRole('button', { name: 'Voltar' });

    expect(view.getByRole('button', { name: 'Voltar', disabled: true })).toBeTruthy();
    expect(lockedButton.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(router.canGoBack).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not depend on a native listener or network request', async () => {
    const view = await renderWithProviders(<BackButton fallbackHref="/login" />);
    const button = view.getByRole('button', { name: 'Voltar' });

    expect(button).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('updates the icon and label colors when the theme changes', async () => {
    const view = await renderWithProviders(
      <>
        <BackButton fallbackHref="/login" />
        <ThemeSwitcher />
      </>,
    );
    const button = view.getByRole('button', { name: 'Voltar' });

    const icon = view.getByTestId('back-button-icon', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icon.props.style).color).toBe(theme.colors.primary);
    expect(StyleSheet.flatten(view.getByText('Voltar').props.style).color).toBe(
      theme.colors.primary,
    );

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(
      StyleSheet.flatten(
        view.getByTestId('back-button-icon', { includeHiddenElements: true }).props.style,
      ).color,
    ).toBe(darkTheme.colors.primary);
    expect(StyleSheet.flatten(view.getByText('Voltar').props.style).color).toBe(
      darkTheme.colors.primary,
    );
  });
});
