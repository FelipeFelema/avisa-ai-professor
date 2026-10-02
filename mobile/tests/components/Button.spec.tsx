import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/ui';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';

describe('Button', () => {
  it('exposes button semantics and busy disabled state', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <Button label="Salvar" onPress={onPress} loading />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses the active palette for primary, secondary, pressed, and destructive actions', async () => {
    const view = await renderWithProviders(
      <>
        <Button label="Salvar" />
        <Button label="Voltar" variant="secondary" />
        <Button label="Excluir" variant="destructive" />
        <ThemeSwitcher />
      </>,
    );
    const styleFor = (label: string, pressed = false) => {
      const button = view.getByRole('button', { name: label });
      const style = button.props.style;
      return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style);
    };

    expect(styleFor('Salvar').backgroundColor).toBe(lightTheme.colors.primary);
    expect(styleFor('Voltar').borderColor).toBe(lightTheme.colors.primary);
    expect(styleFor('Excluir').backgroundColor).toBe(lightTheme.colors.danger);

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(styleFor('Salvar').backgroundColor).toBe(darkTheme.colors.primary);
    expect(styleFor('Voltar').backgroundColor).toBe(darkTheme.colors.surface);
    expect(styleFor('Voltar').borderColor).toBe(darkTheme.colors.primary);
    expect(styleFor('Excluir').backgroundColor).toBe(darkTheme.colors.danger);
  });
});
