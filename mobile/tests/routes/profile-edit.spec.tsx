import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { Pressable as MockPressable, StyleSheet, Text as MockText } from 'react-native';

import ProfileEditScreen from '../../app/(app)/profile/edit';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { darkTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { createDeferredRequest } from '../helpers/profile-password';
import { ThemeSwitcher } from '../helpers/theme';

const replace = jest.fn();
const mutateAsync = jest.fn();
const mockUsePreventRemove = jest.mocked(usePreventRemove);
const mockSecondaryScreen = jest.fn();

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useUpdateProfile', () => ({ useUpdateProfile: jest.fn() }));
jest.mock('@/components/ui', () => ({
  ScreenState: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  SecondaryScreen: (props: {
    children?: ReactNode;
    backPending?: boolean;
    backDisabled?: boolean;
  }) => {
    mockSecondaryScreen(props);
    return <>{props.children}</>;
  },
  ConfirmationDialog: ({
    visible,
    summary = [],
    onCancel,
    onConfirm,
    pending = false,
    errorMessage,
  }: {
    visible: boolean;
    summary?: { label: string; value: string }[];
    onCancel: () => void;
    onConfirm: () => void;
    pending?: boolean;
    errorMessage?: string;
  }) =>
    visible ? (
      <>
        <MockText>{'Confirmar altera\u00e7\u00f5es'}</MockText>
        {summary.map((row) => (
          <MockText key={row.label}>{`${row.label}: ${row.value}`}</MockText>
        ))}
        {errorMessage ? <MockText accessibilityRole="alert">{errorMessage}</MockText> : null}
        <MockPressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={onCancel}
        >
          <MockText>Cancelar</MockText>
        </MockPressable>
        <MockPressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending, busy: pending }}
          disabled={pending}
          onPress={onConfirm}
        >
          <MockText>Confirmar e salvar</MockText>
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

async function renderScreen() {
  return renderWithProviders(
    <>
      <ProfileEditScreen />
      <ThemeSwitcher />
    </>,
  );
}

async function invokePress(element: Parameters<typeof fireEvent>[0]) {
  await fireEvent(element, 'press');
}

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
  it.each(['PARENT', 'PROFESSOR', 'ADMIN'] as const)(
    'shows only editable identity fields for %s without a role field',
    async (role) => {
      mockUseAuth.mockReturnValue({ user: { ...currentUser, role } } as never);
      const { getByLabelText, queryByLabelText, queryByText } = await renderScreen();

      expect(getByLabelText('Nome')).toBeTruthy();
      expect(getByLabelText('E-mail')).toBeTruthy();
      expect(queryByLabelText('Perfil')).toBeNull();
      expect(queryByText(role)).toBeNull();
    },
  );

  it('shows only changed values, keeps the form on cancel and submits after confirmation', async () => {
    const { getByDisplayValue, getByText, getByRole, queryByText } = await renderScreen();

    await fireEvent.changeText(getByDisplayValue('Nome Atual'), 'Nome Novo');

    await fireEvent.press(getByText('Select Escuro'));
    expect(getByDisplayValue('Nome Novo')).toBeTruthy();
    expect(StyleSheet.flatten(getByText('Editar perfil').props.style).color).toBe(
      darkTheme.colors.text,
    );
    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));

    await waitFor(() => expect(getByText('Nome: Nome Atual \u2192 Nome Novo')).toBeTruthy());

    await fireEvent.press(getByText('Cancelar'));
    await waitFor(() => expect(queryByText('Confirmar altera\u00e7\u00f5es')).toBeNull());
    expect(getByDisplayValue('Nome Novo')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();

    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));
    await waitFor(() => expect(getByText('Nome: Nome Atual \u2192 Nome Novo')).toBeTruthy());
    await invokePress(getByRole('button', { name: 'Confirmar e salvar' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'Nome Novo' }));
    expect(replace).toHaveBeenCalledWith('/profile');
  });

  it('reports a normalized no-op without opening confirmation or making a request', async () => {
    const { getByLabelText, getByRole, getByText, queryByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Nome'), '  Nome Atual  ');
    await fireEvent.changeText(getByLabelText('E-mail'), '  ATUAL@EXAMPLE.COM ');
    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));

    await waitFor(() => expect(getByText('Nenhuma altera\u00e7\u00e3o para salvar.')).toBeTruthy());
    expect(queryByText('Confirmar altera\u00e7\u00f5es')).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('keeps a recoverable occupied-email error on the form', async () => {
    const conflict = Object.assign(new Error('conflict'), {
      isAxiosError: true,
      response: { status: 409, data: { message: 'Email already occupied.' } },
    });
    mutateAsync.mockRejectedValue(conflict);
    const { getAllByText, getByLabelText, getByRole, getByText } = await renderScreen();

    await fireEvent.changeText(getByLabelText('E-mail'), 'ocupado@example.com');
    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));
    await waitFor(() => expect(getByText('Confirmar altera\u00e7\u00f5es')).toBeTruthy());
    await invokePress(getByRole('button', { name: 'Confirmar e salvar' }));

    await waitFor(() =>
      expect(getAllByText('Este e-mail j\u00e1 est\u00e1 em uso.').length).toBe(2),
    );
    expect(getByLabelText('E-mail').props.value).toBe('ocupado@example.com');
    expect(replace).not.toHaveBeenCalled();
  });

  it('blocks duplicate submission and voluntary navigation while pending', async () => {
    const pendingRequest = createDeferredRequest<typeof currentUser>();
    mutateAsync.mockReturnValue(pendingRequest.promise);
    const { getByLabelText, getByRole, unmount } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Nome'), 'Nome Novo');
    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));
    await waitFor(() => expect(getByRole('button', { name: 'Confirmar e salvar' })).toBeTruthy());

    const confirmationButton = getByRole('button', { name: 'Confirmar e salvar' });
    const submission = fireEvent(confirmationButton, 'press');
    await waitFor(() => expect(getByLabelText('Nome').props.editable).toBe(false));
    await fireEvent(confirmationButton, 'press');

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUsePreventRemove.mock.calls.some(([prevent]) => prevent)).toBe(true);
    expect(mockSecondaryScreen.mock.calls.some(([props]) => props.backPending)).toBe(true);

    expect(replace).not.toHaveBeenCalled();
    await unmount();
    void submission;
  });

  it('releases the route guard when authentication expires during a pending request', async () => {
    const pendingRequest = createDeferredRequest<typeof currentUser>();
    mutateAsync.mockReturnValue(pendingRequest.promise);
    const { getByLabelText, getByRole, getByText, rerender } = await renderScreen();

    await fireEvent.changeText(getByLabelText('Nome'), 'Nome Novo');
    await invokePress(getByRole('button', { name: 'Salvar altera\u00e7\u00f5es' }));
    await waitFor(() => expect(getByText('Confirmar altera\u00e7\u00f5es')).toBeTruthy());
    const submission = fireEvent(getByRole('button', { name: 'Confirmar e salvar' }), 'press');
    await waitFor(() => expect(mockUsePreventRemove.mock.calls.at(-1)?.[0]).toBe(true));

    mockUseAuth.mockReturnValue({ user: null, isLoading: false } as never);
    await rerender(<ProfileEditScreen />);

    expect(mockUsePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
    await act(async () => {
      pendingRequest.reject(new Error('session expired'));
      await submission;
    });
  });
});
