import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import * as service from '@/services/auth';
import { usePreventRemove } from 'expo-router/react-navigation';
import ProfileChangePassword from '../../app/(app)/profile/change-password';
import { renderWithProviders } from '../helpers/render';
import { createDeferredRequest } from '../helpers/profile-password';
import { ThemeSwitcher } from '../helpers/theme';
import { darkTheme } from '@/theme';

const mockRouter = {
  canGoBack: jest.fn(() => false),
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
};
let mockBlur: (() => void) | undefined;
let mockSubmit!: () => Promise<void>;
jest.mock('@/components/auth', () => {
  const actual = jest.requireActual('@/components/auth');
  return {
    ...actual,
    AuthButton: (props: { onPress: () => Promise<void> }) => {
      mockSubmit = props.onPress;
      return <actual.AuthButton {...props} />;
    },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => (() => void) | void) => {
    mockUseEffect(() => {
      const cleanup = callback();
      mockBlur = cleanup || undefined;
      return cleanup;
    }, [callback]);
  },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  changePassword: jest.fn(),
}));
const auth = {
  user: { id: 'u', name: 'Nome', email: 'p@example.com', role: 'PARENT' },
  expireSession: jest.fn(),
  logout: jest.fn(),
  applyProfileUpdate: jest.fn(),
};
const change = jest.mocked(service.changePassword);
const fields = ['Senha atual', 'Nova senha', 'Confirmar nova senha'];
const passwords = ['Synthetic old password', 'Synthetic new password', 'Synthetic new password'];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(auth as never);
  change.mockResolvedValue(undefined);
});
async function renderScreen() {
  return renderWithProviders(
    <>
      <ProfileChangePassword />
      <ThemeSwitcher />
    </>,
  );
}
async function fill(view: Awaited<ReturnType<typeof renderScreen>>) {
  for (let i = 0; i < fields.length; i++)
    await fireEvent.changeText(view.getByLabelText(fields[i]), passwords[i]);
}
describe('separate password route', () => {
  it('renders three protected fields, keyboard/scroll and local validation without a request', async () => {
    const view = await renderScreen();
    for (const field of fields) {
      const props = view.getByLabelText(field).props;
      expect(props.secureTextEntry).toBe(true);
      expect(props.autoCapitalize).toBe('none');
      expect(props.autoCorrect).toBe(false);
      expect(props.value === '').toBe(true);
    }
    expect(view.getByLabelText('Nova senha').props.textContentType).toBe('newPassword');
    expect(view.getByTestId('password-keyboard-avoidance')).toBeTruthy();
    expect(view.getByTestId('password-scroll').props.keyboardShouldPersistTaps).toBe('handled');
    await fireEvent.press(view.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() => expect(view.getByText('Informe a senha atual.')).toBeTruthy());
    expect(change).not.toHaveBeenCalled();
  });
  it('blocks repeated taps/voluntary removal and clears after success without logout', async () => {
    const deferred = createDeferredRequest<void>();
    change.mockReturnValue(deferred.promise);
    const view = await renderScreen();
    await fill(view);
    let submission!: Promise<void>;
    await act(async () => {
      submission = mockSubmit();
    });
    await waitFor(() => expect(view.getByLabelText('Senha atual').props.editable).toBe(false));
    await fireEvent.press(view.getByRole('button', { name: 'Alterando...' }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true);
    expect(view.getByRole('button', { name: 'Voltar' }).props.accessibilityState.disabled).toBe(
      true,
    );
    await act(async () => {
      deferred.resolve();
      await submission;
    });
    await waitFor(() => expect(view.getByText('Senha alterada com sucesso.')).toBeTruthy());
    for (const field of fields) expect(view.getByLabelText(field).props.value === '').toBe(true);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.applyProfileUpdate).not.toHaveBeenCalled();
  });
  it('keeps recoverable field errors and theme, reports indeterminate transport result safely', async () => {
    change.mockRejectedValue(
      new service.ChangePasswordError({
        status: 400,
        message: 'A senha atual está incorreta.',
        field: 'currentPassword',
      }),
    );
    const view = await renderScreen();
    await fill(view);
    await fireEvent.press(view.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() =>
      expect(view.getAllByText('A senha atual está incorreta.').length).toBeGreaterThan(0),
    );
    await fireEvent.press(view.getByText('Select Escuro'));
    expect(view.getByLabelText('Senha atual').props.value === passwords[0]).toBe(true);
    expect(
      StyleSheet.flatten(view.getByRole('header', { name: 'Alterar senha' }).props.style).color,
    ).toBe(darkTheme.colors.text);
    change.mockRejectedValue(
      new service.ChangePasswordError({
        message:
          'Não foi possível confirmar o resultado. Verifique sua conexão e tente entrar com a nova senha antes de repetir a troca.',
        indeterminate: true,
      }),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() =>
      expect(view.getByText(/Não foi possível confirmar o resultado/)).toBeTruthy(),
    );
    expect(change).toHaveBeenCalledTimes(2);
  });
  it('clears on blur/abandonment and starts a new entry empty', async () => {
    const view = await renderScreen();
    await fill(view);
    await act(async () => mockBlur?.());
    for (const field of fields) expect(view.getByLabelText(field).props.value === '').toBe(true);
    await view.unmount();
    const reentry = await renderScreen();
    for (const field of fields) expect(reentry.getByLabelText(field).props.value === '').toBe(true);
  });
  it('clears on expiry and releases removal guard during an in-flight operation', async () => {
    const deferred = createDeferredRequest<void>();
    change.mockReturnValue(deferred.promise);
    const view = await renderScreen();
    await fill(view);
    let sending!: Promise<void>;
    await act(async () => {
      sending = mockSubmit();
    });
    await waitFor(() => expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true));
    jest.mocked(useAuth).mockReturnValue({ ...auth, user: null } as never);
    await view.rerender(<ProfileChangePassword />);
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    expect(view.queryByLabelText('Senha atual')).toBeNull();
    await act(async () => {
      deferred.resolve();
      await sending;
    });
    expect(view.queryByText('Senha alterada com sucesso.')).toBeNull();
  });
});
