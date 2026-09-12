import { fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

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
});
