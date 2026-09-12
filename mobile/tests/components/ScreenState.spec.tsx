import { fireEvent } from '@testing-library/react-native';
import { ScreenState } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

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
});
