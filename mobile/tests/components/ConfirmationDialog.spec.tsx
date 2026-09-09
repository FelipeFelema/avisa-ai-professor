import { fireEvent } from '@testing-library/react-native';
import { ConfirmationDialog } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

let mockOnRequestClose: (() => void) | undefined;

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const React = jest.requireActual('react');

  const MockModal = ({ children, onRequestClose, ...props }: Record<string, unknown>) => {
    mockOnRequestClose = onRequestClose as (() => void) | undefined;
    return React.createElement(actual.View, props, children);
  };

  return new Proxy(actual, {
    get(target, property, receiver) {
      return property === 'Modal' ? MockModal : Reflect.get(target, property, receiver);
    },
  });
});

describe('ConfirmationDialog', () => {
  it('renders a neutral dialog and invokes the confirm and cancel callbacks', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByText } = await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Excluir turma"
        targetLabel="Historia"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(getByText('Excluir turma')).toBeTruthy();
    expect(getByText('Historia')).toBeTruthy();

    await fireEvent.press(getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders destructive content with summary, consequence, error and custom labels', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByText } = await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Excluir turma?"
        targetLabel="Historia"
        summary={[
          { label: 'Professor', value: 'Ana' },
          { label: 'Alunos', value: '24' },
        ]}
        consequence="Esta ação não pode ser desfeita."
        variant="destructive"
        cancelLabel="Voltar"
        confirmLabel="Apagar"
        errorMessage="Não foi possível excluir."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(getByText(/Professor: Ana/)).toBeTruthy();
    expect(getByText(/Alunos: 24/)).toBeTruthy();
    expect(getByText('Esta ação não pode ser desfeita.')).toBeTruthy();
    expect(getByText('Não foi possível excluir.')).toBeTruthy();

    await fireEvent.press(getByText('Apagar'));
    await fireEvent.press(getByText('Voltar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('maps a non-pending native close to cancel', async () => {
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Confirmar"
        targetLabel="Historia"
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );

    expect(mockOnRequestClose).toEqual(expect.any(Function));
    await mockOnRequestClose?.();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both controls and exposes busy semantics while pending', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByText } = await renderWithProviders(
      <ConfirmationDialog
        visible
        title="Excluir"
        targetLabel="Turma"
        onCancel={onCancel}
        onConfirm={onConfirm}
        pending
      />,
    );

    expect(getByText(/Aguarde/)).toBeTruthy();
    await fireEvent.press(getByText('Cancelar'));
    await fireEvent.press(getByText(/Aguarde/));
    expect(mockOnRequestClose).toEqual(expect.any(Function));
    await mockOnRequestClose?.();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
