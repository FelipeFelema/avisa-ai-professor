import { api } from '@/lib/api';
import * as pushStorage from '@/storage/push.storage';
import {
  activatePushRegistration,
  getPushInstallationState,
  pushRevocationApi,
  PushServiceError,
  reservePushInstallation,
  revokePushInstallation,
} from '@/services/push/push.service';
import type { PushPendingRevocation } from '@/types/push';

jest.mock('@/storage/push.storage', () => ({
  getOrCreatePushIdentity: jest.fn(),
}));

const identity = {
  installationId: '00000000-0000-4000-8000-000000000111',
  capability: 'A'.repeat(43),
};
const binding = {
  bindingId: '00000000-0000-4000-8000-000000000112',
  lifecycleVersion: 1,
  tokenRevision: 0,
  state: 'RESERVED' as const,
};

describe('push service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(pushStorage.getOrCreatePushIdentity).mockResolvedValue(identity);
  });

  it('uses fixed API paths, private installation headers, and validates reserve/state responses', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: binding } as never);
    const get = jest.spyOn(api, 'get').mockResolvedValue({
      data: {
        available: true,
        state: 'ACTIVE',
        binding: { ...binding, state: 'ACTIVE', tokenRevision: 1 },
        reason: null,
        testAvailableAt: null,
      },
    } as never);

    await expect(reservePushInstallation()).resolves.toEqual(binding);
    expect(post).toHaveBeenCalledWith(
      '/push/installation/reserve',
      {},
      expect.objectContaining({
        headers: {
          'X-Push-Installation': identity.installationId,
          'X-Push-Capability': identity.capability,
        },
        sessionGeneration: expect.any(Number),
      }),
    );
    await expect(getPushInstallationState()).resolves.toMatchObject({ state: 'ACTIVE' });
    expect(get).toHaveBeenCalledWith(
      '/push/installation',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Push-Installation': identity.installationId,
          'X-Push-Capability': identity.capability,
        }),
      }),
    );
  });

  it('sends the real Expo token only in the activation body and never accepts it back', async () => {
    const token = 'ExpoPushToken[synthetic-service-token-01]';
    const put = jest.spyOn(api, 'put').mockResolvedValue({
      data: { ...binding, state: 'ACTIVE', tokenRevision: 1 },
    } as never);

    const result = await activatePushRegistration(binding, 'ANDROID', token);
    expect(result).toMatchObject({
      state: 'ACTIVE',
      tokenRevision: 1,
    });
    expect(put).toHaveBeenCalledWith(
      '/push/installation',
      expect.objectContaining({ expoToken: token, permission: 'GRANTED' }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Push-Capability': identity.capability }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('converts invalid responses and transport failures to safe errors without Axios details', async () => {
    jest.spyOn(api, 'post').mockResolvedValue({
      data: { bindingId: 'private-response-sentinel', expoToken: 'private-token-sentinel' },
    } as never);
    await expect(reservePushInstallation()).rejects.toBeInstanceOf(PushServiceError);

    jest
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('private-token-sentinel private-axios-config'));
    await expect(reservePushInstallation()).rejects.toMatchObject({
      name: 'PushServiceError',
      message: 'Não foi possível concluir a solicitação. Verifique a conexão e tente novamente.',
    });
  });

  it('uses an isolated, bounded capability-only client and clears pending only on HTTP 204', async () => {
    const pending: PushPendingRevocation = {
      ...identity,
      bindingId: binding.bindingId,
      lifecycleVersion: 1,
      reason: 'LOGOUT',
    };
    const remove = jest.spyOn(pushRevocationApi, 'delete').mockResolvedValue({
      status: 204,
    } as never);
    await expect(revokePushInstallation(pending)).resolves.toBeUndefined();

    expect(pushRevocationApi.defaults.timeout).toBe(5000);
    expect(remove).toHaveBeenCalledWith(
      '/push/installation',
      expect.objectContaining({
        noAuthReplay: true,
        retry: false,
        headers: expect.objectContaining({
          'X-Push-Installation': identity.installationId,
          'X-Push-Capability': identity.capability,
        }),
        data: {
          bindingId: binding.bindingId,
          lifecycleVersion: 1,
          reason: 'LOGOUT',
        },
      }),
    );
    expect(remove.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');

    remove.mockResolvedValueOnce({ status: 200 } as never);
    await expect(revokePushInstallation(pending)).rejects.toMatchObject({
      message: 'A desativação ainda não foi confirmada.',
    });
  });

  it('has no hidden authorization or retry interceptors on the logout-only transport', () => {
    expect(pushRevocationApi.interceptors.request.handlers?.filter(Boolean) ?? []).toHaveLength(0);
    expect(pushRevocationApi.interceptors.response.handlers?.filter(Boolean) ?? []).toHaveLength(0);
  });
});
