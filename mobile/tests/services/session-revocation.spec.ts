import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';
import { api, authApi, addConnectivityListener } from '@/lib/api';
import { saveTokens, clearTokens } from '@/storage/auth.storage';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import {
  ensureSessionRevocation,
  queueCurrentSessionRevocation,
  flushPendingSessionRevocations,
  startSessionRevocationRecovery,
} from '@/services/auth/session-revocation.service';
import { STORAGE_KEYS } from '@/constants';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  authApi: { post: jest.fn() },
  addConnectivityListener: jest.fn(),
}));
const secure = jest.mocked(SecureStore);
const A = { sid: '00000000-0000-4000-8000-000000000001', capability: 'A'.repeat(43) };
const B = { sid: '00000000-0000-4000-8000-000000000002', capability: 'B'.repeat(43) };

describe('Session revocation recovery without authentication tokens', () => {
  const disk = new Map<string, string>();
  beforeEach(() => {
    jest.clearAllMocks();
    disk.clear();
    invalidateSessionGeneration();
    secure.getItemAsync.mockImplementation(async (key) => disk.get(key) ?? null);
    secure.setItemAsync.mockImplementation(async (key, value) => {
      disk.set(key, value);
    });
    secure.deleteItemAsync.mockImplementation(async (key) => {
      disk.delete(key);
    });
    jest.mocked(api.get).mockResolvedValue({ data: A });
    jest.mocked(authApi.post).mockResolvedValue({ status: 204 });
    jest.mocked(addConnectivityListener).mockReturnValue(jest.fn());
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function login(ticket = A) {
    const generation = getSessionGeneration();
    await saveTokens(
      { accessToken: 'PRIVATE_ACCESS', refreshToken: 'PRIVATE_REFRESH' },
      generation,
    );
    jest.mocked(api.get).mockResolvedValueOnce({ data: ticket });
    await ensureSessionRevocation(generation);
  }
  async function localLogout() {
    const queued = queueCurrentSessionRevocation(getSessionGeneration());
    const generation = invalidateSessionGeneration();
    await queued;
    await clearTokens(generation);
  }

  it('online revocation sends only sid/capability and removes exactly the acknowledged entry', async () => {
    await login();
    await localLogout();
    await expect(flushPendingSessionRevocations()).resolves.toBe(true);
    expect(authApi.post).toHaveBeenCalledWith('/auth/logout', A);
    expect(disk.has(STORAGE_KEYS.accessToken)).toBe(false);
    expect(disk.has(STORAGE_KEYS.refreshToken)).toBe(false);
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
  });

  it('offline leaves a minimal durable entry; restart and later connectivity drain it', async () => {
    await login();
    await localLogout();
    jest.mocked(authApi.post).mockRejectedValueOnce(new Error('offline'));
    await expect(flushPendingSessionRevocations()).resolves.toBe(false);
    const persisted = disk.get(STORAGE_KEYS.pendingSessionRevocations)!;
    expect(JSON.parse(persisted)).toEqual([A]);
    expect(persisted).not.toMatch(
      /PRIVATE_ACCESS|PRIVATE_REFRESH|password|email|userId|accessToken|refreshToken/,
    );
    invalidateSessionGeneration();
    // Fresh module state simulates a process restart; only SecureStore survives.
    let restarted!: typeof import('@/services/auth/session-revocation.service');
    jest.isolateModules(() => {
      restarted = jest.requireActual('@/services/auth/session-revocation.service');
    });
    let connectivity!: () => void | Promise<void>;
    jest.mocked(addConnectivityListener).mockImplementation((callback) => {
      connectivity = callback;
      return jest.fn();
    });
    jest.mocked(authApi.post).mockRejectedValueOnce(new Error('still offline'));
    const stop = restarted.startSessionRevocationRecovery();
    await restarted.flushPendingSessionRevocations();
    expect(disk.get(STORAGE_KEYS.pendingSessionRevocations)).toBe(persisted);
    await connectivity();
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
    stop();
  });

  it('account B never sends JWTs or replaces the old session pending entry', async () => {
    await login();
    await localLogout();
    await login(B);
    jest.mocked(authApi.post).mockRejectedValueOnce(new Error('offline'));
    await flushPendingSessionRevocations();
    expect(JSON.parse(disk.get(STORAGE_KEYS.pendingSessionRevocations)!)).toEqual([A]);
    expect(JSON.parse(disk.get(STORAGE_KEYS.sessionRevocation)!)).toEqual(B);
    await localLogout();
    expect(JSON.parse(disk.get(STORAGE_KEYS.pendingSessionRevocations)!)).toEqual([A, B]);
    await flushPendingSessionRevocations();
    expect(authApi.post).toHaveBeenLastCalledWith('/auth/logout', B);
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
  });

  it('concurrent drains share one request and do not delete a newer pending entry', async () => {
    await login();
    await localLogout();
    let finish!: (value: { status: number }) => void;
    jest.mocked(authApi.post).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = flushPendingSessionRevocations();
    const second = flushPendingSessionRevocations();
    await login(B);
    await localLogout();
    finish({ status: 204 });
    await Promise.all([first, second]);
    // B added during the drain is retained for the next opportunity.
    expect(JSON.parse(disk.get(STORAGE_KEYS.pendingSessionRevocations)!)).toEqual([B]);
    expect(authApi.post).toHaveBeenCalledTimes(1);
    await flushPendingSessionRevocations();
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
  });

  it('late account A cleanup cannot remove account B tokens or queue its capability', async () => {
    await login();
    const queued = queueCurrentSessionRevocation(getSessionGeneration());
    const cleanupGeneration = invalidateSessionGeneration();
    invalidateSessionGeneration();
    await login(B);
    await queued;
    await clearTokens(cleanupGeneration);
    expect(disk.get(STORAGE_KEYS.accessToken)).toBe('PRIVATE_ACCESS');
    expect(JSON.parse(disk.get(STORAGE_KEYS.sessionRevocation)!)).toEqual(B);
    expect(JSON.parse(disk.get(STORAGE_KEYS.pendingSessionRevocations)!)).toEqual([A]);
    await flushPendingSessionRevocations();
    expect(authApi.post).toHaveBeenCalledWith('/auth/logout', A);
    expect(authApi.post).not.toHaveBeenCalledWith('/auth/logout', B);
    expect(JSON.parse(disk.get(STORAGE_KEYS.sessionRevocation)!)).toEqual(B);
  });

  it('storage failure keeps the capability recoverable while local token cleanup completes', async () => {
    await login();
    secure.setItemAsync.mockImplementationOnce(async () => {
      throw new Error('storage failed');
    });
    const queued = queueCurrentSessionRevocation(getSessionGeneration());
    const generation = invalidateSessionGeneration();
    await expect(queued).rejects.toThrow();
    await clearTokens(generation);
    expect(disk.has(STORAGE_KEYS.sessionRevocation)).toBe(true);
    await flushPendingSessionRevocations();
    expect(authApi.post).toHaveBeenCalledWith('/auth/logout', A);
    expect(disk.has(STORAGE_KEYS.sessionRevocation)).toBe(false);
  });

  it('retries in foreground and cleans timers/listeners on unmount', async () => {
    jest.useFakeTimers();
    await login();
    await localLogout();
    jest.mocked(authApi.post).mockRejectedValue(new Error('offline'));
    const remove = jest.fn();
    let foreground!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove };
    });
    const stop = startSessionRevocationRecovery();
    await flushPendingSessionRevocations();
    jest.mocked(authApi.post).mockResolvedValue({ status: 204 });
    foreground('active');
    await flushPendingSessionRevocations();
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
    stop();
    expect(remove).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries while signed out and already active after offline connectivity returns', async () => {
    jest.useFakeTimers();
    await login();
    await localLogout();
    jest.mocked(authApi.post).mockRejectedValue(new Error('offline'));
    const stop = startSessionRevocationRecovery();
    await flushPendingSessionRevocations();
    jest.mocked(authApi.post).mockResolvedValue({ status: 204 });
    await jest.advanceTimersByTimeAsync(30_000);
    await flushPendingSessionRevocations();
    expect(disk.has(STORAGE_KEYS.pendingSessionRevocations)).toBe(false);
    expect(disk.has(STORAGE_KEYS.accessToken)).toBe(false);
    stop();
  });

  it('a stale capability response is queued for cleanup and never bound to a new generation', async () => {
    await saveTokens({ accessToken: 'PRIVATE_ACCESS', refreshToken: 'PRIVATE_REFRESH' });
    let resolve!: (value: { data: typeof A }) => void;
    jest.mocked(api.get).mockReturnValueOnce(
      new Promise((accept) => {
        resolve = accept;
      }),
    );
    const restoring = ensureSessionRevocation(getSessionGeneration());
    invalidateSessionGeneration();
    resolve({ data: A });
    await expect(restoring).rejects.toThrow();
    await flushPendingSessionRevocations();
    expect(disk.has(STORAGE_KEYS.sessionRevocation)).toBe(false);
  });
});
