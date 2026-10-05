import { fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useEffect as mockUseEffect } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import InviteScreen from '../../app/(app)/admin/teacher-invites';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherInvite } from '@/hooks/useTeacherInvite';
import { useTheme } from '@/hooks/useTheme';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';

const replace = jest.fn();
const push = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (callback: () => (() => void) | void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useTeacherInvite', () => ({ useTeacherInvite: jest.fn() }));
const router = jest.mocked(useRouter);
const auth = jest.mocked(useAuth);
const hook = jest.mocked(useTeacherInvite);
const generate = jest.fn();
const copy = jest.fn();
function ThemeActions() {
  const { setTheme } = useTheme();
  return (
    <>
      <Button label="Choose light theme" onPress={() => setTheme('light')} />
      <Button label="Choose dark theme" onPress={() => setTheme('dark')} />
    </>
  );
}
async function renderInviteScreen(ui = <InviteScreen />) {
  const view = await renderWithProviders(ui);
  await waitFor(() => expect(view.getByText('Convites de professores')).toBeTruthy());
  return view;
}
const invite = {
  id: 'e6a84760-64a8-4fe8-ae23-3a4e5b833c17',
  code: `PROF-${'A'.repeat(32)}`,
  role: 'PROFESSOR' as const,
  isActive: true as const,
  createdAt: '2026-10-04T12:00:00.000Z',
  expiresAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
beforeEach(() => {
  jest.clearAllMocks();
  router.mockReturnValue({ replace, push, back: jest.fn() } as never);
  auth.mockReturnValue({
    user: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' },
    isLoading: false,
  } as never);
  hook.mockReturnValue({
    state: { access: 'authorized', operation: 'idle', feedback: { kind: 'none' } },
    generate,
    copy,
    clear: jest.fn(),
  } as never);
});
describe('admin teacher invite route', () => {
  it('shows the fixed professor purpose, selectable result, copy action, and non-revocation notice', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: invite,
        feedback: { kind: 'success', category: 'generated' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    expect(view.getAllByText(/PROFESSOR/).length).toBeGreaterThan(0);
    expect(view.getByText(/sete dias/i)).toBeTruthy();
    expect(view.getByText(/uso único/i)).toBeTruthy();
    expect(view.getByText('Ativo na geração')).toBeTruthy();
    expect(view.getByText(invite.code).props.selectable).toBe(true);
    expect(view.getByText(/04\/10\/2026/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Gerar convite de professor' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Copiar código' })).toBeTruthy();
    expect(view.getByText('Gerar outro código não revoga o anterior.')).toBeTruthy();
    expect(view.getByText(invite.code).props.accessibilityLiveRegion).toBe('none');
  });

  it('requests an explicit copy and exposes accessible success feedback without announcing the secret', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: invite,
        feedback: { kind: 'success', category: 'copied' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Copiar código' }));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(view.getByText('Código copiado.').props.accessibilityLiveRegion).toBe('polite');
    expect(view.queryByText(invite.code)?.props.accessibilityLiveRegion).toBe('none');
  });

  it('keeps a selectable fallback and retry action after a failed copy', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: invite,
        feedback: { kind: 'error', category: 'copy-failed' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    expect(view.getByText(invite.code).props.selectable).toBe(true);
    expect(view.getByText(/Não foi possível copiar/i)).toBeTruthy();
    expect(view.getByText(/Selecione o código ou tente copiar novamente/i)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Copiar código' }));
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing result visible when a subsequent generation is uncertain', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: invite,
        feedback: { kind: 'uncertain', category: 'delivery-unconfirmed' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    expect(view.getByText(invite.code).props.selectable).toBe(true);
    expect(view.getByText(/Não foi possível confirmar se o convite foi criado/i)).toBeTruthy();
    expect(view.getByText(/Nenhuma repetição automática foi feita/i)).toBeTruthy();
  });

  it('disables copy for an expired result while retaining readable fallback text', async () => {
    const expired = { ...invite, expiresAt: '2026-10-03T12:00:00.000Z' };
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: expired,
        feedback: { kind: 'none' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    const button = view.getByRole('button', { name: 'Copiar código' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByText('Prazo encerrado')).toBeTruthy();
    expect(view.getByText(expired.code).props.selectable).toBe(true);
  });

  it('exposes copy as busy and disabled while the clipboard is pending', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'copying',
        result: invite,
        feedback: { kind: 'none' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    const button = view.getByRole('button', { name: /Copiando/ });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(copy).not.toHaveBeenCalled();
  });

  it('keeps the previous result visible while generating another and renders the new result after success', async () => {
    const second = {
      ...invite,
      id: '3a852bfd-f55e-4cc8-9084-2e5a9f801bcb',
      code: `PROF-${'B'.repeat(32)}`,
    };
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'generating',
        result: invite,
        feedback: { kind: 'none' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const pending = await renderInviteScreen();
    expect(pending.getByText(invite.code)).toBeTruthy();
    expect(pending.getByRole('button', { name: /Gerando/ }).props.accessibilityState).toMatchObject(
      {
        disabled: true,
        busy: true,
      },
    );
    expect(pending.getByText('Gerar outro código não revoga o anterior.')).toBeTruthy();
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: second,
        feedback: { kind: 'success', category: 'generated' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    await pending.rerender(<InviteScreen />);
    await waitFor(() => expect(pending.getByText(second.code)).toBeTruthy());
    expect(pending.queryByText(invite.code)).toBeNull();
  });
  it('requests one generation and exposes fixed busy semantics', async () => {
    hook.mockReturnValue({
      state: { access: 'authorized', operation: 'generating', feedback: { kind: 'none' } },
      generate,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen();
    const button = view.getByRole('button', { name: /Gerando/ });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each([
    [
      'PARENT',
      { access: 'authorized', operation: 'idle', feedback: { kind: 'none' } },
      '/(app)/(tabs)/profile',
    ],
    [
      'ADMIN',
      { access: 'indeterminate', operation: 'idle', feedback: { kind: 'none' } },
      undefined,
    ],
  ] as const)(
    'guards role %s or hides an indeterminate authorization check',
    async (role, state, expectedRoute) => {
      auth.mockReturnValue({
        user: { id: 'user-1', name: 'Pessoa', email: 'p@example.test', role },
        isLoading: false,
      } as never);
      hook.mockReturnValue({ state, generate, clear: jest.fn() } as never);
      const view = await renderWithProviders(<InviteScreen />);
      if (expectedRoute) await waitFor(() => expect(replace).toHaveBeenCalledWith(expectedRoute));
      else expect(view.queryByText(invite.code)).toBeNull();
    },
  );
  it('redirects an unauthenticated deep link to login', async () => {
    auth.mockReturnValue({ user: null, isLoading: false } as never);
    await renderWithProviders(<InviteScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('keeps the selected code legible in Claro and Escuro with text scaling enabled', async () => {
    hook.mockReturnValue({
      state: {
        access: 'authorized',
        operation: 'idle',
        result: invite,
        feedback: { kind: 'none' },
      },
      generate,
      copy,
      clear: jest.fn(),
    } as never);
    const view = await renderInviteScreen(
      <>
        <InviteScreen />
        <ThemeActions />
      </>,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Choose light theme' }));
    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByText(invite.code).props.style).color).toBe(
        lightTheme.colors.text,
      );
    });
    expect(view.getByText(invite.code).props.selectable).toBe(true);
    expect(view.getByText(invite.code).props.allowFontScaling).not.toBe(false);
    await fireEvent.press(view.getByRole('button', { name: 'Choose dark theme' }));
    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByText(invite.code).props.style).color).toBe(
        darkTheme.colors.text,
      );
    });
  });
});
