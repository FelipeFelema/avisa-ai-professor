import * as pushConfig from '@/config/push-config';
import * as pushStorage from '@/storage/push.storage';
import * as pushDevice from '@/services/push/push-device.service';
import * as pushService from '@/services/push/push.service';
import {
  completePushLogoutCleanup,
  enablePushNotifications,
  flushPendingPushRevocation,
  preparePushLogout,
  reconcilePushNotifications,
} from '@/services/push/push-lifecycle';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import type { PushRuntimeConfig } from '@/config/push-config';
import type {
  PushBindingView,
  PushInstallationIdentity,
  PushInstallationView,
  PushPendingRevocation,
} from '@/types/push';

jest.mock('@/config/push-config', () => ({ getPushRuntimeConfig: jest.fn() }));
jest.mock('@/storage/push.storage', () => ({
  getOrCreatePushIdentity: jest.fn(),
  getPushOptIn: jest.fn(),
  readCurrentBinding: jest.fn(),
  readPendingRevocation: jest.fn(),
  saveCurrentBinding: jest.fn(),
  clearCurrentBinding: jest.fn(),
  clearCurrentBindingIfMatches: jest.fn(),
  savePendingRevocation: jest.fn(),
  clearPendingRevocation: jest.fn(),
  setPushOptIn: jest.fn(),
}));
jest.mock('@/services/push/push-device.service', () => ({
  getExpoPushToken: jest.fn(),
  readPushPermission: jest.fn(),
  requestPushPermission: jest.fn(),
}));
jest.mock('@/services/push/push.service', () => ({
  activatePushRegistration: jest.fn(),
  getPushInstallationState: jest.fn(),
  reservePushInstallation: jest.fn(),
  revokePushInstallation: jest.fn(),
  PushServiceError: class PushServiceError extends Error {
    status?: number;
    constructor(message: string, options: { status?: number } = {}) {
      super(message);
      this.status = options.status;
    }
  },
}));

const config = jest.mocked(pushConfig);
const storage = jest.mocked(pushStorage);
const device = jest.mocked(pushDevice);
const service = jest.mocked(pushService);
const PushServiceError = pushService.PushServiceError;

const runtimeConfig: PushRuntimeConfig = {
  available: true,
  platform: 'ANDROID',
  projectId: '00000000-0000-4000-8000-000000000010',
  reason: null,
};
const identity: PushInstallationIdentity = {
  installationId: '00000000-0000-4000-8000-000000000111',
  capability: 'A'.repeat(43),
};
const binding: PushBindingView = {
  bindingId: '00000000-0000-4000-8000-000000000112',
  lifecycleVersion: 2,
  tokenRevision: 1,
  state: 'ACTIVE',
};
const currentBinding = {
  bindingId: binding.bindingId,
  lifecycleVersion: binding.lifecycleVersion,
};
const activeView: PushInstallationView = {
  available: true,
  state: 'ACTIVE',
  binding,
  reason: null,
  testAvailableAt: null,
};
const pending: PushPendingRevocation = {
  ...identity,
  bindingId: '00000000-0000-4000-8000-000000000113',
  lifecycleVersion: 1,
  reason: 'LOGOUT',
};

jest.mocked(pushConfig.getPushRuntimeConfig);

describe('push lifecycle (US2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getPushRuntimeConfig.mockReturnValue(runtimeConfig);
    storage.getOrCreatePushIdentity.mockResolvedValue(identity);
    storage.getPushOptIn.mockResolvedValue(true);
    storage.readCurrentBinding.mockResolvedValue(null);
    storage.readPendingRevocation.mockResolvedValue(null);
    storage.saveCurrentBinding.mockResolvedValue(undefined);
    storage.clearCurrentBinding.mockResolvedValue(undefined);
    storage.clearCurrentBindingIfMatches.mockResolvedValue(true);
    storage.savePendingRevocation.mockResolvedValue(undefined);
    storage.clearPendingRevocation.mockResolvedValue(true);
    storage.setPushOptIn.mockResolvedValue(undefined);
    device.getExpoPushToken.mockResolvedValue('ExpoPushToken[synthetic-token-12345678]');
    device.readPushPermission.mockResolvedValue('GRANTED');
    device.requestPushPermission.mockResolvedValue('GRANTED');
    service.activatePushRegistration.mockResolvedValue(binding);
    service.getPushInstallationState.mockResolvedValue(activeView);
    service.reservePushInstallation.mockResolvedValue(binding);
    service.revokePushInstallation.mockResolvedValue(undefined);
  });

  it('flushes an offline logout with capability-only DELETE before starting a new binding', async () => {
    storage.readPendingRevocation.mockResolvedValueOnce(pending);

    await expect(reconcilePushNotifications(getSessionGeneration())).resolves.toEqual({
      status: 'ACTIVE',
      message: null,
    });

    expect(service.revokePushInstallation).toHaveBeenCalledWith(pending);
    expect(service.revokePushInstallation.mock.invocationCallOrder[0]).toBeLessThan(
      service.reservePushInstallation.mock.invocationCallOrder[0],
    );
    expect(service.activatePushRegistration).toHaveBeenCalledWith(
      currentBinding,
      'ANDROID',
      'ExpoPushToken[synthetic-token-12345678]',
      { sessionGeneration: expect.any(Number), expectedTokenRevision: 1 },
    );
    expect(JSON.stringify(service.revokePushInstallation.mock.calls[0]?.[0])).not.toMatch(
      /accessToken|refreshToken|userId|sid/,
    );
  });

  it('keeps a newer logout intent when an older callback cannot persist its pending reference', async () => {
    const newer = {
      ...pending,
      bindingId: '00000000-0000-4000-8000-000000000114',
      lifecycleVersion: 3,
    } satisfies PushPendingRevocation;
    storage.readPendingRevocation.mockResolvedValueOnce(null).mockResolvedValueOnce(newer);
    storage.readCurrentBinding.mockResolvedValue(currentBinding);
    storage.savePendingRevocation.mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(preparePushLogout()).resolves.toMatchObject({
      bindingId: binding.bindingId,
      lifecycleVersion: binding.lifecycleVersion,
      reason: 'LOGOUT',
    });
    await completePushLogoutCleanup({ ...identity, ...currentBinding, reason: 'LOGOUT' });

    expect(service.revokePushInstallation).toHaveBeenCalledWith({
      ...identity,
      ...currentBinding,
      reason: 'LOGOUT',
    });
    expect(storage.clearCurrentBindingIfMatches).toHaveBeenCalledWith(currentBinding);
    expect(service.reservePushInstallation).not.toHaveBeenCalled();
  });

  it('re-reads state and the Expo token before retrying a 409 with the current CAS revision', async () => {
    await enablePushNotifications();
    jest.clearAllMocks();
    device.getExpoPushToken
      .mockResolvedValueOnce('ExpoPushToken[synthetic-token-stale01]')
      .mockResolvedValueOnce('ExpoPushToken[synthetic-token-fresh02]');
    service.activatePushRegistration
      .mockRejectedValueOnce(new PushServiceError('conflict', { status: 409 }))
      .mockResolvedValueOnce({ ...binding, tokenRevision: 4 });
    service.getPushInstallationState.mockResolvedValueOnce({
      ...activeView,
      binding: { ...binding, tokenRevision: 3 },
    });

    await expect(reconcilePushNotifications(getSessionGeneration())).resolves.toEqual({
      status: 'ACTIVE',
      message: null,
    });

    expect(service.getPushInstallationState).toHaveBeenCalledWith({
      sessionGeneration: expect.any(Number),
    });
    expect(device.getExpoPushToken).toHaveBeenCalledTimes(2);
    expect(service.activatePushRegistration.mock.calls[0]?.[3]).toMatchObject({
      expectedTokenRevision: 1,
    });
    expect(service.activatePushRegistration.mock.calls[1]?.[2]).toBe(
      'ExpoPushToken[synthetic-token-fresh02]',
    );
    expect(service.activatePushRegistration.mock.calls[1]?.[3]).toMatchObject({
      expectedTokenRevision: 3,
    });
  });

  it('discards a delayed permission/token result after logout invalidates its generation', async () => {
    await enablePushNotifications();
    jest.clearAllMocks();
    let resolveToken!: (token: string) => void;
    device.getExpoPushToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );
    const oldGeneration = getSessionGeneration();
    const activation = reconcilePushNotifications(oldGeneration);
    await Promise.resolve();
    await Promise.resolve();
    invalidateSessionGeneration();
    resolveToken('ExpoPushToken[synthetic-late-token-03]');

    await expect(activation).resolves.toMatchObject({ status: 'ERROR' });
    expect(service.reservePushInstallation).not.toHaveBeenCalled();
    expect(service.activatePushRegistration).not.toHaveBeenCalled();
  });

  it('revokes after permission is removed and keeps foreground reconciliation opted out', async () => {
    await enablePushNotifications();
    jest.clearAllMocks();
    storage.readCurrentBinding.mockResolvedValue(currentBinding);
    device.readPushPermission.mockResolvedValue('DENIED');

    await expect(reconcilePushNotifications(getSessionGeneration())).resolves.toMatchObject({
      status: 'DENIED',
    });
    expect(storage.setPushOptIn).toHaveBeenCalledWith(false);
    expect(storage.savePendingRevocation).toHaveBeenCalledWith({
      ...identity,
      ...currentBinding,
      reason: 'PERMISSION_REVOKED',
    });
    expect(service.revokePushInstallation).toHaveBeenCalledTimes(1);
    expect(service.reservePushInstallation).not.toHaveBeenCalled();

    await reconcilePushNotifications(getSessionGeneration());
    expect(service.reservePushInstallation).not.toHaveBeenCalled();
    expect(service.activatePushRegistration).not.toHaveBeenCalled();
  });
});
