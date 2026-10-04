import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { AppState, BackHandler, StyleSheet, type AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib';
import * as service from '@/services/auth';
import DeleteAccountScreen from '../../app/(app)/profile/delete-account';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import { renderWithProviders, createTestQueryClient } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';
import { darkTheme } from '@/theme';

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockCleanups = new Set<() => void>();
const mockPreventRemove = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => (() => void) | void) => {
    mockUseEffect(() => {
      const cleanup = callback();
      if (cleanup) mockCleanups.add(cleanup);
      return () => {
        if (cleanup) {
          mockCleanups.delete(cleanup);
          cleanup();
        }
      };
    }, [callback]);
  },
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  getAccountDeletionImpact: jest.fn(),
  deleteOwnAccount: jest.fn(),
  verifyAccountDeletionSession: jest.fn(),
}));
const auth = {
  user: { id: 'self', name: 'Nome', email: 'fixture@example.com', role: 'PARENT' },
  expireSession: jest.fn(),
  logout: jest.fn(),
};
const impact = {
  role: 'PARENT',
  canDelete: true,
  blockReason: null,
  ownedClassroomsCount: 2,
  announcementsInOwnedClassroomsCount: 3,
  externalMembershipsCount: 1,
  authoredAnnouncementsInOtherClassroomsCount: 1,
} as const;
const read = jest.mocked(service.getAccountDeletionImpact);
const removeAccount = jest.mocked(service.deleteOwnAccount);
const verifySession = jest.mocked(service.verifyAccountDeletionSession);
beforeEach(() => {
  jest.clearAllMocks();
  mockCleanups.clear();
  mockPreventRemove.mockClear();
  jest.mocked(useAuth).mockReturnValue(auth as never);
  read.mockResolvedValue(impact);
  removeAccount.mockResolvedValue(undefined);
  verifySession.mockResolvedValue('valid');
});
afterEach(() => jest.restoreAllMocks());
async function screen() {
  const queryClient = createTestQueryClient();
  const view = await renderWithProviders(
    <>
      <DeleteAccountScreen />
      <ThemeSwitcher />
    </>,
    { queryClient },
  );
  await waitFor(() => expect(view.getByText('Turmas próprias: 2')).toBeTruthy());
  return { ...view, queryClient };
}
async function fill(view: Awaited<ReturnType<typeof screen>>) {
  await fireEvent.changeText(view.getByLabelText('Senha atual'), 'Synthetic fixture password');
  await fireEvent.changeText(view.getByLabelText('Frase de confirmação'), 'EXCLUIR MINHA CONTA');
}
describe('read-only account confirmation route', () => {
  it('opens separately from Profile, preserving profile/password/logout actions', async () => {
    const view = await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Excluir minha conta' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/delete-account');
    expect(view.getByText('Editar perfil')).toBeTruthy();
    expect(view.getByText('Alterar senha')).toBeTruthy();
    expect(view.getByText('Sair da conta')).toBeTruthy();
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it.each(['PARENT', 'PROFESSOR', 'ADMIN'] as const)(
    'shows server %s graph/copy including historical relations',
    async (role) => {
      read.mockResolvedValue({ ...impact, role });
      const view = await screen();
      expect(view.getByText('A exclusão é permanente e não pode ser desfeita.')).toBeTruthy();
      expect(view.getByText('Comunicados nas suas turmas: 3')).toBeTruthy();
      expect(view.getByText('Participações em turmas de outras pessoas: 1')).toBeTruthy();
      expect(view.getByText('Seus comunicados em turmas de outras pessoas: 1')).toBeTruthy();
      if (role === 'ADMIN')
        expect(view.getByText('Você perderá também seu acesso administrativo.')).toBeTruthy();
      expect(view.getByText(/Códigos de convite/)).toBeTruthy();
      expect(view.queryClient.getQueryCache().getAll()).toEqual([]);
      expect(view.queryClient.getMutationCache().getAll()).toEqual([]);
    },
  );
  it('protects fields, disables autofill and validates exactly without a destructive request', async () => {
    const destructiveRequest = jest.spyOn(api, 'delete');
    const view = await screen();
    expect(view.getByLabelText('Senha atual').props.secureTextEntry).toBe(true);
    for (const label of ['Senha atual', 'Frase de confirmação']) {
      const props = view.getByLabelText(label).props;
      expect(props.autoComplete).toBe('off');
      expect(props.textContentType).toBe('none');
      expect(props.autoCapitalize).toBe('none');
      expect(props.autoCorrect).toBe(false);
    }
    expect(view.getByTestId('deletion-scroll').props.keyboardShouldPersistTaps).toBe('handled');
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    await waitFor(() => expect(view.getByText('Informe a senha atual.')).toBeTruthy());
    await fill(view);
    await fireEvent.changeText(view.getByLabelText('Frase de confirmação'), 'EXCLUIR MINHA CONTA ');
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    await waitFor(() =>
      expect(view.getByText('Digite exatamente EXCLUIR MINHA CONTA.')).toBeTruthy(),
    );
    await fill(view);
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    await waitFor(() => expect(view.getByText(/Confirma.*revisada/)).toBeTruthy());
    expect(
      view.getByRole('button', { name: 'Excluir minha conta' }).props.accessibilityState.disabled,
    ).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole('button', { name: 'Excluir minha conta' }));
    await waitFor(() => expect(removeAccount).toHaveBeenCalledTimes(1));
    expect(removeAccount).toHaveBeenCalledWith(
      { currentPassword: 'Synthetic fixture password', confirmationPhrase: 'EXCLUIR MINHA CONTA' },
      expect.any(Number),
    );
    expect(destructiveRequest).not.toHaveBeenCalled();
    expect(view.getByLabelText('Senha atual').props.value).toBe('');
    expect(view.getByLabelText('Frase de confirmação').props.value).toBe('');
    expect(view.queryClient.getMutationCache().getAll()).toEqual([]);
  });
  it('blocks cancel, hardware back and gestures while the one DELETE is pending', async () => {
    let resolveDelete!: (value: void) => void;
    removeAccount.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    let hardwareBack!: Parameters<typeof BackHandler.addEventListener>[1];
    const backListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName, handler) => {
        hardwareBack = handler;
        return { remove: jest.fn() } as never;
      });
    const view = await screen();
    await fill(view);
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    void fireEvent.press(view.getByRole('button', { name: 'Excluir minha conta' }));
    await waitFor(() => expect(removeAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hardwareBack).toEqual(expect.any(Function)));

    const latestGuard = mockPreventRemove.mock.calls[mockPreventRemove.mock.calls.length - 1];
    expect(latestGuard?.[0]).toBe(true);
    (latestGuard?.[1] as (() => void) | undefined)?.();
    expect(hardwareBack({} as Parameters<typeof hardwareBack>[0])).toBe(true);
    expect(backListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    expect(view.getByRole('button', { name: 'Cancelar' }).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(view.getByLabelText('Senha atual').props.value).toBe('');
    expect(view.getByLabelText('Frase de confirmação').props.value).toBe('');

    await act(async () => resolveDelete(undefined));
    await waitFor(() => expect(view.queryByText('Exclusão em andamento')).toBeNull());
  });
  it('verifies a lost response read-only and requests a fresh summary for manual confirmation', async () => {
    removeAccount.mockRejectedValueOnce(new Error('transport lost'));
    verifySession.mockResolvedValueOnce('indeterminate').mockResolvedValueOnce('valid');
    const view = await screen();
    await fill(view);
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    await fireEvent.press(view.getByRole('button', { name: 'Excluir minha conta' }));

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Verificar sessão' })).toBeTruthy(),
    );
    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText('Senha atual').props.value).toBe('');
    await fireEvent.press(view.getByRole('button', { name: 'Verificar sessão' }));
    await waitFor(() => expect(verifySession).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(view.getByText(/resultado da solicita/)).toBeTruthy();
    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText('Senha atual').props.value).toBe('');
  });
  it('disarms pending route protection after session expiration', async () => {
    let resolveDelete!: (value: void) => void;
    removeAccount.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const view = await screen();
    await fill(view);
    await fireEvent.press(view.getByRole('button', { name: /Revisar confirma/ }));
    void fireEvent.press(view.getByRole('button', { name: 'Excluir minha conta' }));
    await waitFor(() => expect(removeAccount).toHaveBeenCalledTimes(1));

    jest.mocked(useAuth).mockReturnValue({ ...auth, user: null } as never);
    await view.rerender(<DeleteAccountScreen />);
    const latestGuard = mockPreventRemove.mock.calls[mockPreventRemove.mock.calls.length - 1];
    expect(latestGuard?.[0]).toBe(false);
    expect(view.queryByLabelText('Senha atual')).toBeNull();
    await act(async () => resolveDelete(undefined));
  });
  it('blocks the last ADMIN, keeping cancel and read retry available', async () => {
    read.mockResolvedValue({
      ...impact,
      role: 'ADMIN',
      canDelete: false,
      blockReason: 'LAST_ADMIN_REQUIRED',
    });
    const view = await screen();
    expect(
      view.getByText(
        'Sua conta é a última ADMIN. A exclusão está bloqueada para preservar o acesso administrativo.',
      ),
    ).toBeTruthy();
    expect(
      view.getByRole('button', { name: /Revisar confirma/ }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(view.getByLabelText('Senha atual').props.editable).toBe(false);
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
  it('treats zero relations as ready', async () => {
    read.mockResolvedValue({
      ...impact,
      ownedClassroomsCount: 0,
      announcementsInOwnedClassroomsCount: 0,
      externalMembershipsCount: 0,
      authoredAnnouncementsInOtherClassroomsCount: 0,
    });
    const view = await renderWithProviders(<DeleteAccountScreen />);
    await waitFor(() => expect(view.getByText('Turmas próprias: 0')).toBeTruthy());
    expect(
      view.getByRole('button', { name: /Revisar confirma/ }).props.accessibilityState.disabled,
    ).toBe(false);
  });
  it('shows loading and safe read errors, then retries a fresh summary', async () => {
    read.mockRejectedValueOnce(
      new service.AccountDeletionError({
        message: 'Não foi possível consultar o impacto. Tente novamente.',
      }),
    );
    const view = await renderWithProviders(<DeleteAccountScreen />);
    await waitFor(() =>
      expect(view.getByText('Não foi possível consultar o impacto. Tente novamente.')).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(view.getByText('Turmas próprias: 2')).toBeTruthy());
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('clears on cancel/back/blur and reentry; never stores confirmation', async () => {
    const view = await screen();
    await fill(view);
    await act(async () => {
      mockCleanups.forEach((cleanup) => cleanup());
    });
    expect(view.getByLabelText('Senha atual').props.value).toBe('');
    expect(view.getByLabelText('Frase de confirmação').props.value).toBe('');
    await view.unmount();
    const reopened = await screen();
    expect(reopened.getByLabelText('Senha atual').props.value).toBe('');
    await fill(reopened);
    await fireEvent.press(reopened.getByRole('button', { name: 'Cancelar' }));
    expect(reopened.getByLabelText('Senha atual').props.value).toBe('');
  });
  it('clears fields and refreshes on application resume', async () => {
    let listener!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler;
      return { remove: jest.fn() };
    });
    const view = await screen();
    await fill(view);
    await act(async () => {
      listener('background');
    });
    expect(view.queryByLabelText('Senha atual')).toBeNull();
    await act(async () => {
      listener('active');
    });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.getByLabelText('Senha atual').props.value).toBe(''));
  });
  it('uses both palettes and clears on session expiration', async () => {
    const view = await screen();
    await fill(view);
    await fireEvent.press(view.getByText('Select Escuro'));
    expect(
      StyleSheet.flatten(view.getByTestId('deletion-keyboard').props.style).backgroundColor,
    ).toBe(darkTheme.colors.background);
    jest.mocked(useAuth).mockReturnValue({ ...auth, user: null } as never);
    await view.rerender(<DeleteAccountScreen />);
    expect(view.queryByLabelText('Senha atual')).toBeNull();
  });
});
