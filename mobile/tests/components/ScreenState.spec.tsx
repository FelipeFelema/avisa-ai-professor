import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ScreenState } from '@/components/ui';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';

describe('ScreenState', () => {
  it('renders a meaningful state and next action', async () => {
    const onAction = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <ScreenState
        kind="not-found"
        title="Turma não encontrada"
        message="Volte para sua lista."
        actionLabel="Ver turmas"
        onAction={onAction}
      />,
    );
    expect(getByText('Turma não encontrada')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('updates empty, error, and loading presentation colors without losing its action', async () => {
    const onAction = jest.fn();
    const view = await renderWithProviders(
      <>
        <ScreenState
          kind="error"
          title="Falha ao carregar"
          message="Tente novamente."
          actionLabel="Tentar novamente"
          onAction={onAction}
        />
        <ThemeSwitcher />
      </>,
    );

    expect(StyleSheet.flatten(view.getByText('Falha ao carregar').props.style).color).toBe(
      lightTheme.colors.text,
    );
    expect(StyleSheet.flatten(view.getByText('Tente novamente.').props.style).color).toBe(
      lightTheme.colors.textMuted,
    );

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(StyleSheet.flatten(view.getByText('Falha ao carregar').props.style).color).toBe(
      darkTheme.colors.text,
    );
    expect(StyleSheet.flatten(view.getByText('Tente novamente.').props.style).color).toBe(
      darkTheme.colors.textMuted,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
