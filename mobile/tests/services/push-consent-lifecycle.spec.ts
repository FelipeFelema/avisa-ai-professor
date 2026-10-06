import * as pushConfig from '@/config/push-config';
import * as pushStorage from '@/storage/push.storage';
import * as pushDevice from '@/services/push/push-device.service';
import * as pushService from '@/services/push/push.service';
import {
  disablePushNotifications,
  enablePushNotifications,
  preparePushLogout,
  reconcilePushNotifications,
} from '@/services/push/push-lifecycle';
import { invalidateSessionGeneration } from '@/lib/session-generation';
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
const reserved: PushBindingView = {
  bindingId: '00000000-0000-4000-8000-000000000112',
  lifecycleVersion: 1,
  tokenRevision: 0,
  state: 'RESERVED',
};
const activeView: PushInstallationView = {
  available: true,
  state: 'ACTIVE',
  binding: { ...reserved, state: 'ACTIVE', tokenRevision: 1 },
  reason: null,
  testAvailableAt: null,
};

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe('push consent lifecycle (US1)', () => {
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
    device.getExpoPushToken.mockResolvedValue('ExpoPushToken[synthetic-12345678]');
    device.readPushPermission.mockResolvedValue('GRANTED');
    device.requestPushPermission.mockResolvedValue('GRANTED');
    service.activatePushRegistration.mockResolvedValue({
      ...reserved,
      state: 'ACTIVE',
      tokenRevision: 1,
    });
    service.getPushInstallationState.mockResolvedValue(activeView);
    service.reservePushInstallation.mockResolvedValue(reserved);
    service.revokePushInstallation.mockResolvedValue(undefined);
  });

  it('persists the reserved binding before activation and reports ACTIVE only afterward', async () => {
    await expect(enablePushNotifications()).resolves.toEqual({ status: 'ACTIVE', message: null });

    expect(storage.setPushOptIn).toHaveBeenCalledWith(true);
    expect(device.requestPushPermission).toHaveBeenCalledTimes(1);
    expect(device.getExpoPushToken).toHaveBeenCalledTimes(1);
    expect(service.reservePushInstallation).toHaveBeenCalledTimes(1);
    expect(storage.saveCurrentBinding).toHaveBeenCalledWith({
      bindingId: reserved.bindingId,
      lifecycleVersion: reserved.lifecycleVersion,
    });
    expect(service.activatePushRegistration).toHaveBeenCalledWith(
      { bindingId: reserved.bindingId, lifecycleVersion: reserved.lifecycleVersion },
      'ANDROID',
      'ExpoPushToken[synthetic-12345678]',
      { sessionGeneration: expect.any(Number), expectedTokenRevision: 0 },
    );
    expect(storage.saveCurrentBinding.mock.invocationCallOrder[0]).toBeLessThan(
      service.activatePushRegistration.mock.invocationCallOrder[0],
    );
  });

  it('does not prompt, reserve, or activate while the persisted opt-in is false', async () => {
    storage.getPushOptIn.mockResolvedValue(false);
    device.readPushPermission.mockResolvedValue('NOT_REQUESTED');

    await expect(reconcilePushNotifications()).resolves.toEqual({
      status: 'NOT_REQUESTED',
      message: null,
    });

    expect(device.requestPushPermission).not.toHaveBeenCalled();
    expect(device.getExpoPushToken).not.toHaveBeenCalled();
    expect(service.reservePushInstallation).not.toHaveBeenCalled();
    expect(service.activatePushRegistration).not.toHaveBeenCalled();
  });

  it('checks the installation state after an uncertain activation response', async () => {
    service.activatePushRegistration.mockRejectedValueOnce(new Error('connection lost'));

    await expect(enablePushNotifications()).resolves.toEqual({ status: 'ACTIVE', message: null });

    expect(service.getPushInstallationState).toHaveBeenCalledWith({
      sessionGeneration: expect.any(Number),
    });
    expect(service.reservePushInstallation).toHaveBeenCalledTimes(1);
  });

  it('does not activate if binding persistence fails and attempts capability-only cleanup', async () => {
    storage.saveCurrentBinding.mockRejectedValueOnce(new Error('secure store unavailable'));

    await expect(enablePushNotifications()).resolves.toEqual({
      status: 'RECOVERY',
      message: expect.any(String),
    });

    expect(service.activatePushRegistration).not.toHaveBeenCalled();
    expect(storage.savePendingRevocation).toHaveBeenCalledWith({
      ...identity,
      bindingId: reserved.bindingId,
      lifecycleVersion: reserved.lifecycleVersion,
      reason: 'PERMISSION_REVOKED',
    });
    expect(service.revokePushInstallation).toHaveBeenCalledTimes(1);
  });

  it('clears an older pending revocation before reserving a new binding', async () => {
    const pending: PushPendingRevocation = {
      ...identity,
      bindingId: '00000000-0000-4000-8000-000000000113',
      lifecycleVersion: 2,
      reason: 'USER_DISABLED',
    };
    storage.readPendingRevocation.mockResolvedValueOnce(pending);

    await expect(enablePushNotifications()).resolves.toEqual({ status: 'ACTIVE', message: null });

    expect(service.revokePushInstallation.mock.invocationCallOrder[0]).toBeLessThan(
      service.reservePushInstallation.mock.invocationCallOrder[0],
    );
    expect(storage.clearPendingRevocation).toHaveBeenCalledWith(pending, 204);
  });

  it('persists opt-out revocation before clearing the current binding', async () => {
    const currentBinding = {
      bindingId: reserved.bindingId,
      lifecycleVersion: reserved.lifecycleVersion,
    };
    storage.readCurrentBinding.mockResolvedValue(currentBinding);

    await expect(disablePushNotifications()).resolves.toEqual({
      status: 'AUTHORIZED_APP_DISABLED',
      message: null,
    });

    const revocation = {
      ...identity,
      ...currentBinding,
      reason: 'USER_DISABLED',
    };
    expect(storage.setPushOptIn.mock.invocationCallOrder[0]).toBeLessThan(
      storage.savePendingRevocation.mock.invocationCallOrder[0],
    );
    expect(storage.savePendingRevocation.mock.invocationCallOrder[0]).toBeLessThan(
      storage.clearCurrentBindingIfMatches.mock.invocationCallOrder[0],
    );
    expect(storage.savePendingRevocation).toHaveBeenCalledWith(revocation);
    expect(service.revokePushInstallation).toHaveBeenCalledWith(revocation);
    expect(storage.clearPendingRevocation).toHaveBeenCalledWith(revocation, 204);
  });

  it('keeps cleanup pending when capability-only revocation fails', async () => {
    storage.readCurrentBinding.mockResolvedValue({
      bindingId: reserved.bindingId,
      lifecycleVersion: reserved.lifecycleVersion,
    });
    service.revokePushInstallation.mockRejectedValueOnce(new Error('offline'));

    await expect(disablePushNotifications()).resolves.toMatchObject({
      status: 'PENDING_CLEANUP',
    });

    expect(storage.setPushOptIn).toHaveBeenCalledWith(false);
    expect(storage.savePendingRevocation).toHaveBeenCalledTimes(1);
    expect(storage.clearCurrentBindingIfMatches).toHaveBeenCalledTimes(1);
    expect(storage.clearPendingRevocation).not.toHaveBeenCalled();
  });

  it('prepares logout with only a minimal pending capability reference', async () => {
    const currentBinding = {
      bindingId: reserved.bindingId,
      lifecycleVersion: reserved.lifecycleVersion,
    };
    storage.readCurrentBinding.mockResolvedValue(currentBinding);

    await expect(preparePushLogout()).resolves.toEqual({
      ...identity,
      ...currentBinding,
      reason: 'LOGOUT',
    });

    const pending = storage.savePendingRevocation.mock.calls[0]?.[0];
    expect(pending).toEqual({ ...identity, ...currentBinding, reason: 'LOGOUT' });
    expect(Object.keys(pending ?? {}).sort()).toEqual([
      'bindingId',
      'capability',
      'installationId',
      'lifecycleVersion',
      'reason',
    ]);
    expect(storage.savePendingRevocation.mock.invocationCallOrder[0]).toBeLessThan(
      storage.clearCurrentBindingIfMatches.mock.invocationCallOrder[0],
    );
    expect(storage.setPushOptIn).toHaveBeenCalledWith(false);
    expect(service.revokePushInstallation).not.toHaveBeenCalled();
  });

  it('shares one in-flight explicit activation', async () => {
    let resolvePermission!: (state: 'GRANTED') => void;
    device.requestPushPermission.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const first = enablePushNotifications();
    const second = enablePushNotifications();
    await flushMicrotasks();
    expect(device.requestPushPermission).toHaveBeenCalledTimes(1);

    resolvePermission('GRANTED');
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'ACTIVE', message: null },
      { status: 'ACTIVE', message: null },
    ]);
  });

  it('discards a permission callback after the session generation changes', async () => {
    let resolvePermission!: (state: 'GRANTED') => void;
    device.requestPushPermission.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const activation = enablePushNotifications();
    await flushMicrotasks();
    expect(device.requestPushPermission).toHaveBeenCalledTimes(1);
    invalidateSessionGeneration();
    resolvePermission('GRANTED');

    await expect(activation).resolves.toMatchObject({ status: 'ERROR' });
    expect(service.reservePushInstallation).not.toHaveBeenCalled();
    expect(service.activatePushRegistration).not.toHaveBeenCalled();
  });
});
