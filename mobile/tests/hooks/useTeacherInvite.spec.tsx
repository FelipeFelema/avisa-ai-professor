import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect as mockUseEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setStringAsync } from 'expo-clipboard';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData, AuthUser } from '@/types/auth';
import { useTeacherInvite } from '@/hooks/useTeacherInvite';
import * as authService from '@/services/auth';
import * as inviteService from '@/services/admin/teacher-invite.service';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import { createDeferredRequest } from '../helpers/profile-password';

let mockFocusCallback: (() => (() => void) | void) | undefined;
let mockFocusCleanup: (() => void) | undefined;
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;
jest.mock('@/services/admin/teacher-invite.service', () => ({
  ...jest.requireActual('@/services/admin/teacher-invite.service'),
  createTeacherInvite: jest.fn(),
}));
jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  getProfile: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(),
}));
const mockSetClipboardStringAsync = jest.mocked(setStringAsync);
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => (() => void) | void) =>
    mockUseEffect(() => {
      mockFocusCallback = callback;
      const cleanup = callback();
      mockFocusCleanup = cleanup || undefined;
      return () => cleanup?.();
    }, [callback]),
}));
const create = jest.mocked(inviteService.createTeacherInvite);
const profile = jest.mocked(authService.getProfile);
const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' as const };
const invite = {
  id: 'e6a84760-64a8-4fe8-ae23-3a4e5b833c17',
  code: `PROF-${'A'.repeat(32)}`,
  role: 'PROFESSOR' as const,
  isActive: true as const,
  createdAt: '2026-10-04T12:00:00.000Z',
  expiresAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
function requireCopy(value: unknown) {
  expect(value).toEqual(expect.any(Function));
  return value as () => Promise<void>;
}
function setup(user: AuthUser | null = admin) {
  const client = new QueryClient();
  const auth: AuthContextData = {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    applyProfileUpdate: jest.fn(),
    expireSession: jest.fn(),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ ...auth }}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return { client, auth, wrapper };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSetClipboardStringAsync.mockReset();
  create.mockReset();
  profile.mockReset();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  mockFocusCallback = undefined;
  mockFocusCleanup = undefined;
  mockAppStateListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    mockAppStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
  profile.mockResolvedValue(admin);
  create.mockResolvedValue(invite);
});
afterEach(() => jest.restoreAllMocks());

describe('useTeacherInvite', () => {
  it('copies the exact displayed code immediately, reports success, and never generates from copy', async () => {
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());

    const copy = requireCopy((result.current as unknown as { copy?: unknown }).copy);
    const clipboard = createDeferredRequest<boolean>();
    mockSetClipboardStringAsync.mockReturnValue(clipboard.promise);
    const profileRequests = profile.mock.calls.length;
    let copyPromise!: Promise<void>;
    await act(async () => {
      copyPromise = copy();
    });

    expect(mockSetClipboardStringAsync).toHaveBeenCalledTimes(1);
    expect(mockSetClipboardStringAsync).toHaveBeenCalledWith(invite.code);
    expect(create).toHaveBeenCalledTimes(1);
    expect(profile).toHaveBeenCalledTimes(profileRequests);

    await act(async () => {
      clipboard.resolve(true);
      await copyPromise;
    });
    expect(result.current.state.feedback).toEqual({ kind: 'success', category: 'copied' });
    expect(result.current.state.result?.code).toBe(invite.code);
    await unmount();
  });

  it('guards duplicate copy taps synchronously before the clipboard promise settles', async () => {
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());

    const copy = requireCopy((result.current as unknown as { copy?: unknown }).copy);
    const clipboard = createDeferredRequest<boolean>();
    mockSetClipboardStringAsync.mockReturnValue(clipboard.promise);
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = copy();
      second = copy();
    });

    expect(mockSetClipboardStringAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      clipboard.resolve(true);
      await Promise.all([first, second]);
    });
    expect(result.current.state.feedback).toEqual({ kind: 'success', category: 'copied' });
    expect(create).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it.each([
    ['false', false],
    ['rejection', undefined],
  ] as const)(
    'keeps the code selectable and recoverable when clipboard returns %s',
    async (_label, outcome) => {
      const { wrapper } = setup();
      const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
      await waitFor(() => expect(result.current.state.access).toBe('authorized'));
      await act(async () => result.current.generate());

      const copy = requireCopy((result.current as unknown as { copy?: unknown }).copy);
      if (outcome === false) mockSetClipboardStringAsync.mockResolvedValue(false);
      else mockSetClipboardStringAsync.mockRejectedValue(new Error('synthetic clipboard failure'));
      await act(async () => copy());

      expect(result.current.state.result?.code).toBe(invite.code);
      expect(result.current.state.feedback).toEqual({ kind: 'error', category: 'copy-failed' });
      expect(create).toHaveBeenCalledTimes(1);
      await unmount();
    },
  );

  it.each([
    ['expired', { ...invite, expiresAt: '2026-10-03T12:00:00.000Z' }],
    ['pending', undefined],
    ['unauthorized', undefined],
  ] as const)('blocks copy while %s', async (condition, pendingResult) => {
    if (condition === 'unauthorized') profile.mockResolvedValue({ ...admin, role: 'PROFESSOR' });
    if (condition === 'expired') create.mockResolvedValueOnce(pendingResult!);
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    const copy = requireCopy((result.current as unknown as { copy?: unknown }).copy);
    if (condition === 'pending') {
      const deferred = createDeferredRequest<typeof invite>();
      create.mockReturnValueOnce(deferred.promise);
      await waitFor(() => expect(result.current.state.access).toBe('authorized'));
      let generation!: Promise<void>;
      await act(async () => {
        generation = result.current.generate();
      });
      await waitFor(() => expect(result.current.state.operation).toBe('generating'));
      await act(async () => copy());
      expect(mockSetClipboardStringAsync).not.toHaveBeenCalled();
      await act(async () => {
        deferred.resolve(invite);
        await generation;
      });
      expect(create).toHaveBeenCalledTimes(1);
      await unmount();
      return;
    } else if (condition === 'unauthorized') {
      await waitFor(() => expect(result.current.state.access).toBe('invalid'));
    } else {
      await waitFor(() => expect(result.current.state.access).toBe('authorized'));
      await act(async () => result.current.generate());
    }

    await act(async () => copy());
    expect(mockSetClipboardStringAsync).not.toHaveBeenCalled();
    if (condition === 'unauthorized') expect(create).not.toHaveBeenCalled();
    await unmount();
  });

  it.each(['visit', 'account change', 'role change'] as const)(
    'drops a late clipboard continuation after %s',
    async (change) => {
      const { auth, wrapper } = setup();
      const { result, rerender, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
      await waitFor(() => expect(result.current.state.access).toBe('authorized'));
      await act(async () => result.current.generate());
      const clipboard = createDeferredRequest<boolean>();
      mockSetClipboardStringAsync.mockReturnValue(clipboard.promise);
      const copy = requireCopy((result.current as unknown as { copy?: unknown }).copy);
      let copyPromise!: Promise<void>;
      await act(async () => {
        copyPromise = copy();
      });

      if (change === 'visit') {
        await act(async () => mockFocusCleanup?.());
      } else {
        auth.user =
          change === 'account change'
            ? { id: 'admin-2', name: 'Other admin', email: 'other@example.test', role: 'ADMIN' }
            : { ...admin, role: 'PROFESSOR' };
        if (change === 'account change') profile.mockResolvedValue({ ...admin, id: 'admin-2' });
        await rerender({});
      }
      await act(async () => {
        clipboard.resolve(true);
        await copyPromise;
      });

      expect(result.current.state.result).toBeUndefined();
      expect(result.current.state.feedback).toEqual({ kind: 'none' });
      expect(JSON.stringify(result.current.state)).not.toContain(invite.code);
      await unmount();
    },
  );

  it('retains the authorized previous result while a deliberate second generation is pending, then replaces it on success', async () => {
    const secondInvite = {
      ...invite,
      id: '3a852bfd-f55e-4cc8-9084-2e5a9f801bcb',
      code: `PROF-${'B'.repeat(32)}`,
    };
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());
    const second = createDeferredRequest<typeof secondInvite>();
    create.mockReturnValueOnce(second.promise);
    let next!: Promise<void>;
    await act(async () => {
      next = result.current.generate();
    });
    expect(result.current.state.operation).toBe('generating');
    expect(result.current.state.result?.code).toBe(invite.code);
    await act(async () => {
      second.resolve(secondInvite);
      await next;
    });
    expect(result.current.state.result?.code).toBe(secondInvite.code);
    await unmount();
  });

  it('preserves the authorized previous result after a failed deliberate second generation', async () => {
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());
    create.mockRejectedValueOnce(
      new inviteService.TeacherInviteError({
        category: 'unavailable',
        message: 'synthetic failure',
      }),
    );
    await act(async () => result.current.generate());
    expect(result.current.state.result?.code).toBe(invite.code);
    expect(result.current.state.feedback).toEqual({ kind: 'error', category: 'unavailable' });
    await unmount();
  });

  it('authorizes by current profile, locks synchronously, and keeps result out of query caches', async () => {
    const deferred = createDeferredRequest<typeof invite>();
    create.mockReturnValue(deferred.promise);
    const { client, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.generate();
      await result.current.generate();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionGeneration: expect.any(Number),
        signal: expect.any(AbortSignal),
      }),
    );
    await act(async () => {
      deferred.resolve(invite);
      await first;
    });
    expect(result.current.state.result).toEqual(invite);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    await unmount();
    client.clear();
  });

  it('expires only the matching session generation on 401 and clears/reconciles on 403', async () => {
    const { auth, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    const generation = getSessionGeneration();
    create.mockRejectedValueOnce(
      new inviteService.TeacherInviteError({
        status: 401,
        category: 'unauthorized',
        message: 'Entre novamente.',
      }),
    );
    await act(async () => {
      await result.current.generate();
    });
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
    expect(auth.expireSession).toHaveBeenCalledWith(generation);
    await unmount();
    create.mockRejectedValueOnce(
      new inviteService.TeacherInviteError({
        status: 403,
        category: 'forbidden',
        message: 'Acesso indisponível.',
      }),
    );
    const second = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(second.result.current.state.access).toBe('authorized'));
    await act(async () => {
      await second.result.current.generate();
    });
    expect(second.result.current.state.result).toBeUndefined();
    expect(authService.getProfile).toHaveBeenCalled();
    await second.unmount();
  });

  it('starts checking, blocks generation while checking, then stays blocked when authorization is indeterminate', async () => {
    const pendingProfile = createDeferredRequest<typeof admin>();
    profile.mockReturnValue(pendingProfile.promise);
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    expect(result.current.state.access).toBe('checking');
    await act(async () => result.current.generate());
    expect(create).not.toHaveBeenCalled();
    await act(async () => pendingProfile.reject(new Error('synthetic profile transport failure')));
    await waitFor(() => expect(result.current.state.access).toBe('indeterminate'));
    await act(async () => result.current.generate());
    expect(create).not.toHaveBeenCalled();
    expect(result.current.state.result).toBeUndefined();
    await unmount();
  });

  it('preserves the prior result after an uncertain deliberate generation and never retries it', async () => {
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());
    expect(result.current.state.result).toEqual(invite);
    create.mockRejectedValueOnce(
      new inviteService.TeacherInviteError({
        category: 'uncertain',
        uncertain: true,
        message: 'Não foi possível confirmar o resultado.',
      }),
    );
    await act(async () => result.current.generate());
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.current.state.result).toEqual(invite);
    expect(result.current.state.feedback).toEqual({
      kind: 'uncertain',
      category: 'delivery-unconfirmed',
    });
    await unmount();
  });

  it('clears on blur, rechecks on refocus, and rechecks on background/resume', async () => {
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await act(async () => result.current.generate());
    expect(result.current.state.result).toEqual(invite);
    const requestsBeforeBlur = profile.mock.calls.length;
    await act(async () => mockFocusCleanup?.());
    expect(result.current.state.result).toBeUndefined();
    expect(result.current.state.access).toBe('checking');
    await act(async () => {
      mockFocusCleanup = mockFocusCallback?.() || undefined;
    });
    await waitFor(() => expect(profile.mock.calls.length).toBeGreaterThan(requestsBeforeBlur));
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));

    const requestsBeforeBackground = profile.mock.calls.length;
    await act(async () => mockAppStateListener?.('background'));
    expect(result.current.state.result).toBeUndefined();
    expect(result.current.state.access).toBe('checking');
    await act(async () => mockAppStateListener?.('active'));
    await waitFor(() =>
      expect(profile.mock.calls.length).toBeGreaterThan(requestsBeforeBackground),
    );
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    await unmount();
  });

  it.each(['logout', 'account change', 'role change'] as const)(
    'ignores a late POST continuation after %s and never restores its secret',
    async (change) => {
      const pendingPost = createDeferredRequest<typeof invite>();
      create.mockReturnValue(pendingPost.promise);
      const { auth, wrapper } = setup();
      const { result, rerender, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
      await waitFor(() => expect(result.current.state.access).toBe('authorized'));
      let post!: Promise<void>;
      await act(async () => {
        post = result.current.generate();
      });
      if (change === 'logout') auth.user = null;
      else if (change === 'account change')
        auth.user = {
          id: 'admin-2',
          name: 'Other admin',
          email: 'other@example.test',
          role: 'ADMIN',
        };
      else auth.user = { ...admin, role: 'PROFESSOR' };
      if (change !== 'logout') profile.mockResolvedValue({ ...admin, id: 'admin-2' });
      await rerender({});
      expect(result.current.state.result).toBeUndefined();
      await act(async () => {
        pendingPost.resolve(invite);
        await post;
      });
      expect(result.current.state.result).toBeUndefined();
      expect(JSON.stringify(result.current.state)).not.toContain(invite.code);
      await unmount();
    },
  );

  it('ignores a late profile response after the account changes', async () => {
    const pendingProfile = createDeferredRequest<typeof admin>();
    profile.mockReturnValue(pendingProfile.promise);
    const { auth, wrapper } = setup();
    const { result, rerender, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    expect(result.current.state.access).toBe('checking');
    auth.user = { id: 'admin-2', name: 'Other admin', email: 'other@example.test', role: 'ADMIN' };
    profile.mockResolvedValue({ ...admin, id: 'admin-2' });
    await rerender({});
    await act(async () => pendingProfile.resolve(admin));
    expect(auth.applyProfileUpdate).not.toHaveBeenCalledWith(admin, expect.any(Number));
    expect(result.current.state.result).toBeUndefined();
    expect(auth.applyProfileUpdate).toHaveBeenCalledTimes(1);
    expect(auth.applyProfileUpdate).toHaveBeenCalledWith(
      { ...admin, id: 'admin-2' },
      expect.any(Number),
    );
    await unmount();
  });

  it('does not expire a newer session when an old generation returns 401', async () => {
    const pendingPost = createDeferredRequest<typeof invite>();
    create.mockReturnValue(pendingPost.promise);
    const { auth, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    let post!: Promise<void>;
    await act(async () => {
      post = result.current.generate();
    });
    invalidateSessionGeneration();
    await act(async () => {
      pendingPost.reject(
        new inviteService.TeacherInviteError({
          status: 401,
          category: 'unauthorized',
          message: 'Entre novamente.',
        }),
      );
      await post;
    });
    expect(auth.expireSession).not.toHaveBeenCalled();
    expect(result.current.state.result).toBeUndefined();
    await unmount();
  });

  it('does not restore a late result after the visit unmounts', async () => {
    const deferred = createDeferredRequest<typeof invite>();
    create.mockReturnValue(deferred.promise);
    const { wrapper } = setup();
    const { result, unmount } = await renderHook(() => useTeacherInvite(), { wrapper });
    await waitFor(() => expect(result.current.state.access).toBe('authorized'));
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.generate();
    });
    await unmount();
    await act(async () => {
      deferred.resolve(invite);
      await pending;
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
