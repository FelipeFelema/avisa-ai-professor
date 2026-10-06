import { api } from '@/lib/api';
import * as pushStorage from '@/storage/push.storage';
import { getSessionGeneration } from '@/lib/session-generation';
import { sendPushTest } from '@/services/push/push.service';
import { PushServiceError } from '@/services/push/push.service';

jest.mock('@/storage/push.storage', () => ({
  getOrCreatePushIdentity: jest.fn(),
}));

const identity = {
  installationId: '00000000-0000-4000-8000-000000000611',
  capability: 'A'.repeat(43),
};
const accepted = {
  attemptId: '00000000-0000-4000-8000-000000000612',
  status: 'ACCEPTED' as const,
  acceptedAt: '2026-10-05T12:00:00.000Z',
  nextTestAvailableAt: '2026-10-05T12:00:30.000Z',
};

describe('push test API service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(pushStorage.getOrCreatePushIdentity).mockResolvedValue(identity);
  });

  it('posts an empty body with installation proof, no auth replay, and no retry', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({
      status: 202,
      data: accepted,
    } as never);

    await expect(sendPushTest()).resolves.toEqual(accepted);
    expect(post).toHaveBeenCalledWith(
      '/push/installation/test',
      {},
      expect.objectContaining({
        noAuthReplay: true,
        retry: false,
        sessionGeneration: getSessionGeneration(),
        headers: {
          'X-Push-Installation': identity.installationId,
          'X-Push-Capability': identity.capability,
        },
      }),
    );
  });

  it('requires HTTP 202 and a closed safe response shape', async () => {
    jest.spyOn(api, 'post').mockResolvedValue({
      status: 200,
      data: accepted,
    } as never);
    await expect(sendPushTest()).rejects.toBeInstanceOf(PushServiceError);

    jest.spyOn(api, 'post').mockResolvedValue({
      status: 202,
      data: { ...accepted, providerTicketId: 'private-ticket-sentinel' },
    } as never);
    await expect(sendPushTest()).rejects.toBeInstanceOf(PushServiceError);
  });

  it('maps timeout and server errors without exposing tokens or raw Axios details', async () => {
    jest
      .spyOn(api, 'post')
      .mockRejectedValue(new Error('ExpoPushToken[private] private-config raw cause'));

    await expect(sendPushTest()).rejects.toMatchObject({
      name: 'PushServiceError',
      message:
        'Não foi possível confirmar o resultado do teste. Aguarde o prazo de segurança antes de tentar novamente.',
    });
  });
});
