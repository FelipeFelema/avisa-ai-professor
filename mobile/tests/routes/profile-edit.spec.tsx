import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Pressable as MockPressable, Text as MockText } from 'react-native';

import ProfileEditScreen from '../../app/(app)/profile/edit';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { renderWithProviders } from '../helpers/render';

const replace = jest.fn();
const mutateAsync = jest.fn();

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useUpdateProfile', () => ({ useUpdateProfile: jest.fn() }));
jest.mock('@/components/ui', () => ({
  ConfirmationDialog: ({
    visible,
    summary = [],
    onCancel,
    onConfirm,
  }: {
    visible: boolean;
    summary?: Array<{ label: string; value: string }>;
    onCancel: () => void;
    onConfirm: () => void;
  }) =>
    visible ? (
      <>
        {summary.map((row) => (
          <MockText key={row.label}>{`${row.label}: ${row.value}`}</MockText>
        ))}
        <MockPressable onPress={onCancel}>
          <MockText>Cancelar</MockText>
        </MockPressable>
        <MockPressable onPress={onConfirm}>
          <MockText>Salvar alterações</MockText>
        </MockPressable>
      </>
    ) : null,
}));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);
const mockUseUpdateProfile = jest.mocked(useUpdateProfile);

const currentUser = {
  id: 'user-1',
  name: 'Nome Atual',
  email: 'atual@example.com',
  role: 'PARENT' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: jest.fn(), replace, back: jest.fn() } as never);
  mockUseAuth.mockReturnValue({ user: currentUser } as never);
  mockUseUpdateProfile.mockReturnValue({
    mutateAsync,
    isPending: false,
  } as never);
  mutateAsync.mockResolvedValue({ ...currentUser, name: 'Nome Novo' });
});

describe('profile edit route', () => {
  it('shows only changed values, keeps the form on cancel and submits after confirmation', async () => {
    const { getByDisplayValue, getByText, getAllByText, getByRole, queryByText } =
      await renderWithProviders(<ProfileEditScreen />);

    await act(async () => {
      fireEvent.changeText(getByDisplayValue('Nome Atual'), 'Nome Novo');
    });
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Salvar alterações' }));
    });

    await waitFor(() => expect(getByText('Nome: Nome Atual → Nome Novo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Cancelar'));
    });
    await waitFor(() => expect(queryByText('Confirmar alterações')).toBeNull());
    expect(getByDisplayValue('Nome Novo')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Salvar alterações' }));
    });
    await waitFor(() => expect(getByText('Nome: Nome Atual → Nome Novo')).toBeTruthy());
    const confirmationButtons = getAllByText('Salvar alterações');
    await act(async () => {
      fireEvent.press(confirmationButtons[confirmationButtons.length - 1]);
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'Nome Novo' }));
    expect(replace).toHaveBeenCalledWith('/profile');
  });
});
