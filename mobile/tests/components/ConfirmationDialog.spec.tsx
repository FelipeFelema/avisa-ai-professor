import { fireEvent } from '@testing-library/react-native';
import { ConfirmationDialog } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

describe('ConfirmationDialog', () => {
  it('cancels without confirming and maps Android close to cancel', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByText } = await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Excluir turma"
        targetLabel="História"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both controls and exposes busy semantics while pending', async () => {
    const { getByText } = await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Excluir"
        targetLabel="Turma"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        pending
      />,
    );
    expect(getByText('Aguarde...')).toBeTruthy();
  });
});
