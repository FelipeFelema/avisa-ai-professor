import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { STORAGE_KEYS } from '@/constants/storage';
import { darkTheme, lightTheme } from '@/theme';
import type { Theme } from '@/theme';
import { renderWithProviders } from '../helpers/render';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text: NativeText } = require('react-native');

  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement(NativeText, props),
  };
});

const mockGetItem = jest.mocked(AsyncStorage.getItem);
const mockSetItem = jest.mocked(AsyncStorage.setItem);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('ThemeSelector', () => {
  it('exposes the same two named radio options in both palettes with a non-color selection mark', async () => {
    const view = await renderWithProviders(<ThemeSelector />);

    for (const palette of [lightTheme, darkTheme]) {
      const selectedLabel = palette === lightTheme ? 'Claro' : 'Escuro';
      const unselectedLabel = palette === lightTheme ? 'Escuro' : 'Claro';
      const selectedPreference = palette === lightTheme ? 'light' : 'dark';

      if (palette === darkTheme) {
        await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));
      }

      expect(view.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
      expect(view.getAllByRole('radio')).toHaveLength(2);
      expect(
        view.getByRole('radio', { name: selectedLabel }).props.accessibilityState.selected,
      ).toBe(true);
      expect(
        view.getByRole('radio', { name: unselectedLabel }).props.accessibilityState.selected,
      ).toBe(false);
      expect(view.getByText(`Tema atual: ${selectedLabel}`)).toBeTruthy();
      expect(findNodeByTestId(view.toJSON(), 'theme-selected-indicator')).toBeTruthy();

      const selectedIcon = findNodeByTestId(
        view.toJSON(),
        `theme-option-icon-${selectedPreference}`,
      );
      expect(selectedIcon).toBeTruthy();
      if (!selectedIcon) throw new Error('Expected the selected theme icon to render.');
      expect(selectedIcon.props.accessible).toBe(false);
      expect(selectedIcon.props.accessibilityElementsHidden).toBe(true);
      expect(selectedIcon.props.importantForAccessibility).toBe('no');
      expect(
        view
          .getAllByRole('radio')
          .map((choice) => choice.props.accessibilityLabel)
          .sort(),
      ).toEqual(['Claro', 'Escuro']);
    }
  });

  it('updates the shared preference immediately, ignores idempotent taps, and warns on a failed save', async () => {
    const view = await renderWithProviders(<ThemeSelector />);

    await fireEvent.press(view.getByRole('radio', { name: 'Claro' }));
    expect(mockSetItem).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));
    expect(view.getByRole('radio', { name: 'Escuro' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(view.getByText('Tema atual: Escuro')).toBeTruthy();
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.themePreference, 'dark');
    expect(mockSetItem).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));
    expect(mockSetItem).toHaveBeenCalledTimes(1);

    mockSetItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await fireEvent.press(view.getByRole('radio', { name: 'Claro' }));

    expect(view.getByRole('radio', { name: 'Claro' }).props.accessibilityState.selected).toBe(true);
    await waitFor(() => {
      expect(view.getByRole('alert').props.children).toBe(
        'A aparência mudou, mas a preferência pode não permanecer após fechar o aplicativo.',
      );
    });
  });

  it('keeps selected and unselected choices readable and at least 48 dp in both palettes', async () => {
    const view = await renderWithProviders(<ThemeSelector />);

    const checkChoice = (label: 'Claro' | 'Escuro', selected: boolean, palette: Theme) => {
      const choice = view.getByRole('radio', { name: label });
      const style = StyleSheet.flatten(choice.props.style);
      const text = view.getByText(label);
      const textStyle = StyleSheet.flatten(text.props.style);

      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
      expect(style.opacity).toBeUndefined();
      expect(style.backgroundColor).toBe(
        selected ? palette.colors.primarySubtle : palette.colors.surfaceMuted,
      );
      expect(textStyle.color).toBe(palette.colors.text);
    };

    checkChoice('Claro', true, lightTheme);
    checkChoice('Escuro', false, lightTheme);
    await fireEvent.press(view.getByRole('radio', { name: 'Escuro' }));
    checkChoice('Claro', false, darkTheme);
    checkChoice('Escuro', true, darkTheme);
  });
});

function findNodeByTestId(
  node: unknown,
  testID: string,
): { props: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findNodeByTestId(child, testID);
      if (result) return result;
    }
    return null;
  }

  if (!node || typeof node !== 'object') return null;

  const record = node as { props?: Record<string, unknown>; children?: unknown };
  if (record.props?.testID === testID) return record as { props: Record<string, unknown> };
  return findNodeByTestId(record.children, testID);
}
