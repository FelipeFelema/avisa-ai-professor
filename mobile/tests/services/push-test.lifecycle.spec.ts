import { getPushRuntimeConfig } from '@/config/push-config';
import { getSessionGeneration } from '@/lib/session-generation';
import { getPushOptIn, readCurrentBinding, readPendingRevocation } from '@/storage/push.storage';
import { readPushPermission } from '@/services/push/push-device.service';
import {
  getPushInstallationState,
  PushServiceError,
  sendPushTest,
} from '@/services/push/push.service';
import { sendPushTestNotification } from '@/services/push/push-lifecycle';

jest.mock('@/config/push-config', () => ({
  getPushRuntimeConfig: jest.fn(),
}));
jest.mock('@/storage/push.storage', () => ({
  getPushOptIn: jest.fn(),
  readCurrentBinding: jest.fn(),
  readPendingRevocation: jest.fn(),
}));
jest.mock('@/services/push/push-device.service', () => ({
  readPushPermission: jest.fn(),
}));
jest.mock('@/services/push/push.service', () => ({
  activatePushRegistration: jest.fn(),
  getPushInstallationState: jest.fn(),
  reservePushInstallation: jest.fn(),
  revokePushInstallation: jest.fn(),
  sendPushTest: jest.fn(),
  PushServiceError: class PushServiceError extends Error {
    status?: number;
    constructor(message: string, options: { status?: number } = {}) {
      super(message);
      this.status = options.status;
    }
  },
}));

const runtime = jest.mocked(getPushRuntimeConfig);
const optedIn = jest.mocked(getPushOptIn);
const binding = jest.mocked(readCurrentBinding);
const pending = jest.mocked(readPendingRevocation);
const permission = jest.mocked(readPushPermission);
const getState = jest.mocked(getPushInstallationState);
const send = jest.mocked(sendPushTest);
const currentBinding = {
  bindingId: '00000000-0000-4000-8000-000000000811',
  lifecycleVersion: 2,
};
const activeState = {
  available: true,
  state: 'ACTIVE' as const,
  binding: { ...currentBinding, tokenRevision: 3, state: 'ACTIVE' as const },
  reason: null,
  testAvailableAt: null,
};

describe('push test lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runtime.mockReturnValue({
      available: true,
      platform: 'ANDROID',
      projectId: '00000000-0000-4000-8000-000000000010',
      reason: null,
    });
    optedIn.mockResolvedValue(true);
    binding.mockResolvedValue(currentBinding);
    pending.mockResolvedValue(null);
    permission.mockResolvedValue('GRANTED');
    getState.mockResolvedValue(activeState);
    send.mockResolvedValue({
      attemptId: '00000000-0000-4000-8000-000000000812',
      status: 'ACCEPTED',
      acceptedAt: '2026-10-05T12:00:00.000Z',
      nextTestAvailableAt: '2026-10-05T12:00:30.000Z',
    });
  });

  it('rereads device permission and sends only for the matching active binding', async () => {
    await expect(sendPushTestNotification(getSessionGeneration())).resolves.toEqual({
      state: 'ACCEPTED',
      message: 'Solicitação aceita para envio. O recebimento depende do dispositivo.',
      nextTestAvailableAt: '2026-10-05T12:00:30.000Z',
    });
    expect(permission).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      sessionGeneration: getSessionGeneration(),
    });
  });

  it('blocks pending cleanup, missing consent, denied permission, and inactive server state', async () => {
    pending.mockResolvedValueOnce({
      installationId: '00000000-0000-4000-8000-000000000813',
      capability: 'A'.repeat(43),
      bindingId: currentBinding.bindingId,
      lifecycleVersion: currentBinding.lifecycleVersion,
      reason: 'LOGOUT',
    });
    await sendPushTestNotification();
    expect(send).not.toHaveBeenCalled();

    pending.mockResolvedValue(null);
    optedIn.mockResolvedValueOnce(false);
    await sendPushTestNotification();
    expect(send).not.toHaveBeenCalled();

    permission.mockResolvedValueOnce('DENIED');
    await sendPushTestNotification();
    expect(send).not.toHaveBeenCalled();

    getState.mockResolvedValueOnce({ ...activeState, state: 'INACTIVE', binding: null });
    await sendPushTestNotification();
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed when configuration is unavailable and blocks the server cooldown', async () => {
    runtime.mockReturnValueOnce({
      available: false,
      platform: null,
      projectId: null,
      reason: 'CONFIGURATION_UNAVAILABLE',
    });
    await sendPushTestNotification();
    expect(send).not.toHaveBeenCalled();

    runtime.mockReturnValue({
      available: true,
      platform: 'ANDROID',
      projectId: '00000000-0000-4000-8000-000000000010',
      reason: null,
    });
    getState.mockResolvedValueOnce({
      ...activeState,
      testAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(sendPushTestNotification()).resolves.toMatchObject({
      state: 'COOLDOWN',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('treats timeout as indeterminate, refreshes only the cooldown, and never resends', async () => {
    const nextTestAvailableAt = new Date(Date.now() + 35_000).toISOString();
    getState
      .mockResolvedValueOnce(activeState)
      .mockResolvedValueOnce({ ...activeState, testAvailableAt: nextTestAvailableAt });
    send.mockRejectedValueOnce(
      new PushServiceError(
        'Não foi possível confirmar o resultado do teste. Aguarde o prazo de segurança antes de tentar novamente.',
        { status: 503 },
      ),
    );

    await expect(sendPushTestNotification()).resolves.toMatchObject({
      state: 'FAILED',
      nextTestAvailableAt,
      message:
        'Não foi possível confirmar o resultado do teste. Aguarde o prazo de segurança antes de tentar novamente.',
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledTimes(2);
  });
});
