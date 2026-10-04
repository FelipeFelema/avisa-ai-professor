import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import { clearTokens, getTokens, saveTokens } from '@/storage/auth.storage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secure = jest.mocked(SecureStore);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('serialized authentication token storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secure.setItemAsync.mockResolvedValue(undefined);
    secure.getItemAsync.mockImplementation(async (key) =>
      key === STORAGE_KEYS.accessToken ? 'access' : 'refresh',
    );
    secure.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('invalidates queued writes before either token key can be restored', async () => {
    const accessWrite = deferred<void>();
    const refreshWrite = deferred<void>();
    secure.setItemAsync.mockImplementation((key) =>
      key === STORAGE_KEYS.accessToken ? accessWrite.promise : refreshWrite.promise,
    );

    const saveGeneration = getSessionGeneration();
    const write = saveTokens(
      { accessToken: 'old-access', refreshToken: 'old-refresh' },
      saveGeneration,
    );
    await Promise.resolve();
    expect(secure.setItemAsync).toHaveBeenCalledTimes(2);

    const cleanupGeneration = invalidateSessionGeneration();
    const cleanup = clearTokens(cleanupGeneration);
    accessWrite.resolve(undefined);
    refreshWrite.resolve(undefined);

    await expect(write).resolves.toBe(false);
    await expect(cleanup).resolves.toEqual({
      accessTokenRemoved: true,
      refreshTokenRemoved: true,
      complete: true,
    });
    expect(secure.deleteItemAsync).toHaveBeenCalledTimes(2);
    expect(secure.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.accessToken);
    expect(secure.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
  });

  it('attempts both removals after a SecureStore failure and leaves theme storage alone', async () => {
    secure.deleteItemAsync.mockImplementation(async (key) => {
      if (key === STORAGE_KEYS.accessToken) throw new Error('local-only failure');
    });

    const outcome = await clearTokens();

    expect(outcome).toEqual({
      accessTokenRemoved: false,
      refreshTokenRemoved: true,
      complete: false,
    });
    expect(secure.deleteItemAsync).toHaveBeenCalledTimes(2);
    expect(secure.deleteItemAsync).not.toHaveBeenCalledWith(STORAGE_KEYS.themePreference);
  });

  it('does not return a token pair read across an invalidation boundary', async () => {
    const accessRead = deferred<string | null>();
    const refreshRead = deferred<string | null>();
    secure.getItemAsync.mockImplementation((key) =>
      key === STORAGE_KEYS.accessToken ? accessRead.promise : refreshRead.promise,
    );
    const generation = getSessionGeneration();
    const read = getTokens(generation);
    invalidateSessionGeneration();
    accessRead.resolve('stale-access');
    refreshRead.resolve('stale-refresh');

    await expect(read).resolves.toBeNull();
  });

  it('rejects an old-generation token write and retains no account data', async () => {
    const generation = getSessionGeneration();
    invalidateSessionGeneration();

    await expect(
      saveTokens({ accessToken: 'late-access', refreshToken: 'late-refresh' }, generation),
    ).resolves.toBe(false);
    expect(secure.setItemAsync).not.toHaveBeenCalled();
    expect(secure.getItemAsync).not.toHaveBeenCalled();
  });
});
