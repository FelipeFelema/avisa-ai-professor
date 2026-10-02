import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FormField } from '@/components/ui';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement(Text, props),
  };
});

describe('FormField', () => {
  it('connects its label and error message to the input', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(
      <FormField label="E-mail" error="E-mail inválido" />,
    );
    expect(getByLabelText('E-mail')).toBeTruthy();
    expect(getByText('E-mail inválido')).toBeTruthy();
  });

  it('renders one decorative search icon without changing the input contract', async () => {
    const onChangeText = jest.fn();
    const { getAllByTestId, getByLabelText, getByText } = await renderWithProviders(
      <FormField
        label="Buscar turmas"
        leadingIcon="search-outline"
        value="História"
        onChangeText={onChangeText}
        editable={false}
        error="Busca indisponível"
      />,
    );

    const input = getByLabelText('Buscar turmas');
    const icons = getAllByTestId('form-field-leading-icon');
    expect(icons).toHaveLength(1);
    const [icon] = icons;

    expect(icon.props.name).toBe('search-outline');
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.accessibilityRole).toBeUndefined();
    expect(input.props.value).toBe('História');
    expect(input.props.onChangeText).toBe(onChangeText);
    expect(input.props.accessibilityState).toEqual({ disabled: true });
    expect(getByText('Busca indisponível')).toBeTruthy();
  });

  it('keeps helper text semantics when no error is present', async () => {
    const { getByText, queryByRole } = await renderWithProviders(
      <FormField
        label="Buscar turmas"
        leadingIcon="search-outline"
        helperText="Use parte do nome da turma."
      />,
    );

    expect(getByText('Use parte do nome da turma.')).toBeTruthy();
    expect(queryByRole('alert')).toBeNull();
  });

  it('updates empty, focused, and invalid field colors with the active palette', async () => {
    const view = await renderWithProviders(
      <>
        <FormField label="Nome" placeholder="Seu nome" />
        <FormField label="E-mail" error="E-mail inválido" />
        <ThemeSwitcher />
      </>,
    );
    const nameInput = view.getByLabelText('Nome');
    const getContainerStyle = (label: string) =>
      StyleSheet.flatten(view.getByLabelText(label).parent?.props.style);

    expect(nameInput.props.placeholderTextColor).toBe(lightTheme.colors.textMuted);
    expect(getContainerStyle('Nome').backgroundColor).toBe(lightTheme.colors.surface);
    expect(getContainerStyle('E-mail').backgroundColor).toBe(lightTheme.colors.dangerSubtle);
    await fireEvent(nameInput, 'focus');
    expect(getContainerStyle('Nome').borderColor).toBe(lightTheme.colors.primary);

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(view.getByLabelText('Nome').props.placeholderTextColor).toBe(darkTheme.colors.textMuted);
    expect(getContainerStyle('Nome').backgroundColor).toBe(darkTheme.colors.surface);
    expect(getContainerStyle('Nome').borderColor).toBe(darkTheme.colors.primary);
    expect(getContainerStyle('E-mail').backgroundColor).toBe(darkTheme.colors.dangerSubtle);
    expect(getContainerStyle('E-mail').borderColor).toBe(darkTheme.colors.danger);
  });
});
