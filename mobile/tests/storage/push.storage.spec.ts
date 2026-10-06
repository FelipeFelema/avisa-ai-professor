import { jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { pushMocks } from '../helpers/push';
import {
  PushStorageRecoveryError,
  clearCurrentBindingIfMatches,
  clearPendingRevocation,
  getOrCreatePushIdentity,
  getPushOptIn,
  readPendingRevocation,
  saveCurrentBinding,
  savePendingRevocation,
  setPushOptIn,
} from '../../src/storage/push.storage';

describe('push storage', () => {
  const keychainOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  it('creates a cryptographic installation identity and writes it before its marker', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    const identity = await getOrCreatePushIdentity();
    const secureWrite = jest.mocked(SecureStore.setItemAsync).mock;
    const markerWrite = jest.mocked(AsyncStorage.setItem).mock;

    expect(identity.installationId).toBe('00000000-0000-4000-8000-000000000011');
    expect(identity.capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pushMocks.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(pushMocks.crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(identity.installationId),
      keychainOptions,
    );
    expect(secureWrite.invocationCallOrder[0]).toBeLessThan(markerWrite.invocationCallOrder[0]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.any(String), 'v1');
  });

  it('defaults opt-in to false and stores an explicit choice outside SecureStore', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    await expect(getPushOptIn()).resolves.toBe(false);
    await setPushOptIn(true);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.any(String), 'true');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('persists the binding reference before a caller can activate it', async () => {
    const binding = {
      bindingId: '00000000-0000-4000-8000-000000000012',
      lifecycleVersion: 1,
    };

    await expect(saveCurrentBinding(binding)).resolves.toBeUndefined();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(binding),
      keychainOptions,
    );
  });

  it('keeps pending revocation limited to the installation proof and binding reference', async () => {
    const pending = {
      installationId: '00000000-0000-4000-8000-000000000013',
      capability: 'A'.repeat(43),
      bindingId: '00000000-0000-4000-8000-000000000014',
      lifecycleVersion: 2,
      reason: 'LOGOUT' as const,
    };
    let persistedPending: string | null = null;
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => persistedPending);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
      persistedPending = value;
    });

    await savePendingRevocation(pending);
    await expect(readPendingRevocation()).resolves.toEqual(pending);

    const savedValue = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1];
    const serialized = String(savedValue);
    expect(Object.keys(JSON.parse(serialized))).toEqual([
      'installationId',
      'capability',
      'bindingId',
      'lifecycleVersion',
      'reason',
    ]);
    for (const forbidden of ['JWT', 'expoToken', 'userId', 'password', 'refreshToken']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('removes only the matching pending revocation after a 204 response', async () => {
    const pending = {
      installationId: '00000000-0000-4000-8000-000000000013',
      capability: 'A'.repeat(43),
      bindingId: '00000000-0000-4000-8000-000000000014',
      lifecycleVersion: 2,
      reason: 'LOGOUT' as const,
    };
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(pending));

    await expect(clearPendingRevocation(pending, 503)).resolves.toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    await expect(clearPendingRevocation({ ...pending, lifecycleVersion: 3 }, 204)).resolves.toBe(
      false,
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    await expect(clearPendingRevocation(pending, 204)).resolves.toBe(true);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });

  it('preserves a newer pending intent and ignores an older successful acknowledgement', async () => {
    const older = {
      installationId: '00000000-0000-4000-8000-000000000013',
      capability: 'A'.repeat(43),
      bindingId: '00000000-0000-4000-8000-000000000014',
      lifecycleVersion: 2,
      reason: 'LOGOUT' as const,
    };
    const newer = {
      ...older,
      bindingId: '00000000-0000-4000-8000-000000000015',
      lifecycleVersion: 3,
      reason: 'USER_DISABLED' as const,
    };
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(newer));

    await savePendingRevocation(older);
    await expect(clearPendingRevocation(older, 204)).resolves.toBe(false);

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears a current binding only when it is still the expected lifecycle', async () => {
    const current = {
      bindingId: '00000000-0000-4000-8000-000000000016',
      lifecycleVersion: 4,
    };
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(current));

    await expect(clearCurrentBindingIfMatches({ ...current, lifecycleVersion: 3 })).resolves.toBe(
      false,
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();

    await expect(clearCurrentBindingIfMatches(current)).resolves.toBe(true);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });

  it('distinguishes marker read failure from a confirmed new installation', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage read failed'));

    await expect(getOrCreatePushIdentity()).rejects.toBeInstanceOf(PushStorageRecoveryError);
    expect(pushMocks.crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('does not regenerate an identity when a marker exists but SecureStore cannot read it', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('v1');
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(getOrCreatePushIdentity()).rejects.toBeInstanceOf(PushStorageRecoveryError);
    expect(pushMocks.crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('requires a canonical 32-byte capability in an existing stored identity', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('v1');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify({
        installationId: '00000000-0000-4000-8000-000000000015',
        capability: `${'A'.repeat(42)}B`,
      }),
    );

    await expect(getOrCreatePushIdentity()).rejects.toBeInstanceOf(PushStorageRecoveryError);
    expect(pushMocks.crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('blocks push when identity persistence fails without touching account storage or transport', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    jest
      .mocked(SecureStore.setItemAsync)
      .mockRejectedValueOnce(new Error('secure store write failed'));

    await expect(getOrCreatePushIdentity()).rejects.toBeInstanceOf(PushStorageRecoveryError);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(pushMocks.fetch).not.toHaveBeenCalled();
  });
});
