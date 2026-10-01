import { FormField } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

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
});
