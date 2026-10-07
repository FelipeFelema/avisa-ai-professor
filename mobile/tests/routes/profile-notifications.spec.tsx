import { fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getPushTestActionEnabled } from '@/config/push-config';
import NotificationsScreen from '../../app/(app)/profile/notifications';
import { renderWithProviders } from '../helpers/render';
import { StyleSheet } from 'react-native';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));
jest.mock('@/config/push-config', () => ({ getPushTestActionEnabled: jest.fn() }));

const pushRoute = jest.fn();
const backRoute = jest.fn();
const useRouterMock = jest.mocked(useRouter);
const useAuthMock = jest.mocked(useAuth);
const usePushMock = jest.mocked(usePushNotifications);
const diagnosticsMock = jest.mocked(getPushTestActionEnabled);

function pushState(
  status: string,
  overrides: Record<string, unknown> = {},
): ReturnType<typeof usePushNotifications> {
  return {
    status,
    message: null,
    isBusy: false,
    isTestBusy: false,
    testMessage: null,
    testAvailableAt: null,
    testCooldownActive: false,
    refresh: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
    sendTest: jest.fn(),
    openSettings: jest.fn(),
    ...overrides,
  } as ReturnType<typeof usePushNotifications>;
}

beforeEach(() => {
  jest.clearAllMocks();
  diagnosticsMock.mockReturnValue(true);
  useRouterMock.mockReturnValue({ push: pushRoute, replace: jest.fn(), back: backRoute } as never);
  useAuthMock.mockReturnValue({
    user: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test', role: 'PARENT' },
  } as never);
  usePushMock.mockReturnValue(pushState('NOT_REQUESTED'));
});

describe('profile notifications route', () => {
  it.each(['PARENT', 'PROFESSOR', 'ADMIN'] as const)(
    'shows the explicit activation action for %s without prompting on mount',
    async (role) => {
      useAuthMock.mockReturnValue({
        user: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test', role },
      } as never);
      const state = pushState('NOT_REQUESTED');
      usePushMock.mockReturnValue(state);
      const view = await renderWithProviders(<NotificationsScreen />);

      expect(view.getByText('Notificações neste dispositivo')).toBeTruthy();
      expect(view.getByText(/A ativação só começa quando você escolher/)).toBeTruthy();
      expect(view.getByRole('button', { name: 'Ativar notificações' })).toBeTruthy();
      expect(state.activate).not.toHaveBeenCalled();
      expect(usePushMock).toHaveBeenCalled();
    },
  );

  it('runs activation only from the explicit action and preserves other Profile navigation', async () => {
    const state = pushState('NOT_REQUESTED');
    usePushMock.mockReturnValue(state);
    const view = await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Ativar notificações' }));
    expect(state.activate).toHaveBeenCalledTimes(1);
    expect(pushRoute).not.toHaveBeenCalled();
  });

  it('shows the neutral test action only after activation and reports ticket acceptance exactly', async () => {
    const state = pushState('ACTIVE', {
      testMessage: 'Solicitação aceita para envio. O recebimento depende do dispositivo.',
    });
    usePushMock.mockReturnValue(state);
    const view = await renderWithProviders(<NotificationsScreen />);

    expect(view.getByRole('button', { name: 'Enviar teste de notificação' })).toBeTruthy();
    expect(view.getByText(state.testMessage ?? '')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Enviar teste de notificação' }));
    expect(state.sendTest).toHaveBeenCalledTimes(1);
    expect(view.getByRole('button', { name: 'Desativar notificações' })).toBeTruthy();
  });

  it('blocks repeat requests while sending and throughout the server cooldown', async () => {
    usePushMock.mockReturnValue(pushState('ACTIVE', { isTestBusy: true }));
    let view = await renderWithProviders(<NotificationsScreen />);
    expect(view.getByRole('button', { name: 'Aguarde...' }).props.accessibilityState.disabled).toBe(
      true,
    );
    await view.unmount();

    usePushMock.mockReturnValue(
      pushState('ACTIVE', {
        testAvailableAt: '2026-10-05T12:00:30.000Z',
        testCooldownActive: true,
      }),
    );
    view = await renderWithProviders(<NotificationsScreen />);
    expect(
      view.getByRole('button', { name: 'Aguarde para enviar teste' }).props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  it('hides the diagnostic action and feedback in production while preserving opt-out', async () => {
    diagnosticsMock.mockReturnValue(false);
    const state = pushState('ACTIVE', { testMessage: 'Diagnostic feedback' });
    usePushMock.mockReturnValue(state);
    const view = await renderWithProviders(<NotificationsScreen />);
    expect(view.queryByRole('button', { name: 'Enviar teste de notificação' })).toBeNull();
    expect(view.queryByText('Diagnostic feedback')).toBeNull();
    expect(state.sendTest).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Desativar notificações' }));
    expect(state.deactivate).toHaveBeenCalledTimes(1);
  });

  it('shows distinct status, safe feedback, and system settings action for denial', async () => {
    const state = pushState('DENIED', {
      message: 'A permissão foi recusada. Você pode alterá-la nas configurações do dispositivo.',
    });
    usePushMock.mockReturnValue(state);
    const view = await renderWithProviders(<NotificationsScreen />);

    expect(view.getByText('Permissão recusada')).toBeTruthy();
    expect(view.getByText(state.message ?? '')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Abrir configurações do dispositivo' }));
    expect(state.openSettings).toHaveBeenCalledTimes(1);
  });

  it('explains app opt-out separately from system permission and offers a safe conflict retry', async () => {
    const disabled = pushState('AUTHORIZED_APP_DISABLED', {
      message: 'A permissÃ£o do dispositivo permanece separada da sua escolha no aplicativo.',
    });
    usePushMock.mockReturnValue(disabled);
    let view = await renderWithProviders(<NotificationsScreen />);
    expect(view.getByText('Notificações desativadas no aplicativo')).toBeTruthy();
    expect(view.getByText(disabled.message ?? '')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Abrir configuraÃ§Ãµes do dispositivo' })).toBeNull();
    expect(view.getByRole('button', { name: 'Ativar notificações' })).toBeTruthy();
    await view.unmount();

    const conflict = pushState('ERROR', {
      message: 'O registro mudou. Atualize o estado e tente novamente.',
    });
    usePushMock.mockReturnValue(conflict);
    view = await renderWithProviders(<NotificationsScreen />);
    expect(view.getByText(conflict.message ?? '')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(conflict.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows unavailable and pending cleanup as text and disables repeated actions', async () => {
    usePushMock.mockReturnValue(pushState('UNAVAILABLE'));
    let view = await renderWithProviders(<NotificationsScreen />);
    expect(view.getByText('Notificações indisponíveis neste dispositivo')).toBeTruthy();
    expect(
      view.getByRole('button', { name: 'Ativar notificações' }).props.accessibilityState.disabled,
    ).toBe(true);
    await view.unmount();

    usePushMock.mockReturnValue(pushState('PENDING_CLEANUP', { isBusy: true }));
    view = await renderWithProviders(<NotificationsScreen />);
    expect(view.getByText('Desativação pendente')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Aguarde...' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('wraps long recovery messages and uses the current theme palette', async () => {
    const message = 'Recuperação necessária. '.repeat(12);
    const state = pushState('RECOVERY', { message });
    usePushMock.mockReturnValue(state);
    const view = await renderWithProviders(<NotificationsScreen />);
    const feedback = view.getByText(message);
    expect(feedback.props.numberOfLines).toBeUndefined();
    expect(view.getByText('Recuperação necessária')).toBeTruthy();
    expect(
      StyleSheet.flatten(view.getByTestId('push-notifications-screen').props.style).backgroundColor,
    ).toBe('#FFFFFF');

    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
  });
});
