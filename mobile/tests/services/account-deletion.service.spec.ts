import { AxiosError, AxiosHeaders } from 'axios';
import { api } from '@/lib';
import {
  deleteOwnAccount,
  getAccountDeletionImpact,
  AccountDeletionError,
  getAccountDeletionFeedback,
  verifyAccountDeletionSession,
} from '@/services/auth/account-deletion.service';

jest.mock('@/lib', () => ({ api: { get: jest.fn(), delete: jest.fn() } }));
const impact = {
  role: 'PARENT',
  canDelete: true,
  blockReason: null,
  ownedClassroomsCount: 0,
  announcementsInOwnedClassroomsCount: 0,
  externalMembershipsCount: 0,
  authoredAnnouncementsInOtherClassroomsCount: 0,
};
describe('transient impact transport', () => {
  beforeEach(() => jest.resetAllMocks());
  it('fetches imperatively with cancellation and a no-cache header', async () => {
    const controller = new AbortController();
    jest.mocked(api.get).mockResolvedValue({ data: impact });
    expect(await getAccountDeletionImpact(controller.signal)).toEqual(impact);
    expect(api.get).toHaveBeenCalledWith('/users/account-deletion', {
      signal: controller.signal,
      sessionGeneration: expect.any(Number),
      headers: { 'Cache-Control': 'no-store' },
    });
  });
  it.each([{ ...impact, extra: 'SECRET' }, { ...impact, role: 'INVALID' }, null])(
    'rejects invalid/extra response fields %#',
    async (data) => {
      jest.mocked(api.get).mockResolvedValue({ data });
      await expect(getAccountDeletionImpact()).rejects.toBeInstanceOf(AccountDeletionError);
    },
  );
  it.each([400, 401, 403, 409, 429, 500, 503, undefined])(
    'returns only safe allowlisted feedback for %s',
    async (status) => {
      const config = { headers: new AxiosHeaders(), data: 'SYNTHETIC_SECRET_PASSWORD' };
      const error = new AxiosError(
        'SYNTHETIC_SECRET_PASSWORD',
        undefined,
        config,
        { secret: true },
        status
          ? {
              status,
              statusText: 'Error',
              config,
              headers: {},
              data: { message: 'SYNTHETIC_SECRET_PASSWORD' },
            }
          : undefined,
      );
      jest.mocked(api.get).mockRejectedValue(error);
      let safe: unknown;
      try {
        await getAccountDeletionImpact();
      } catch (caught) {
        safe = caught;
      }
      const feedback = getAccountDeletionFeedback(safe);
      expect(safe).toBeInstanceOf(AccountDeletionError);
      expect(JSON.stringify(safe)).not.toContain('SYNTHETIC_SECRET_PASSWORD');
      expect(Object.keys(feedback).sort()).toEqual(
        status === undefined ? ['message'] : ['message', 'status'],
      );
      expect(
        ['config', 'request', 'response', 'cause'].some((key) => key in (safe as object)),
      ).toBe(false);
      expect(feedback.message).not.toContain('SYNTHETIC_SECRET_PASSWORD');
    },
  );
  it('turns cancellation into a constant error without retaining request state', async () => {
    jest.mocked(api.get).mockRejectedValue(new AxiosError('secret', 'ERR_CANCELED'));
    await expect(getAccountDeletionImpact()).rejects.toThrow('Consulta cancelada.');
  });
});

describe('destructive account transport and read-only verification', () => {
  beforeEach(() => jest.resetAllMocks());

  const request = {
    currentPassword: 'Synthetic current password',
    confirmationPhrase: 'EXCLUIR MINHA CONTA',
  };

  it('sends one closed, no-replay DELETE and accepts only an empty 204', async () => {
    jest.mocked(api.delete).mockResolvedValue({ status: 204, data: undefined });
    await expect(deleteOwnAccount(request)).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledWith('/users/account', {
      data: request,
      noAuthReplay: true,
      sessionGeneration: expect.any(Number),
      headers: { 'Cache-Control': 'no-store' },
    });
    jest.mocked(api.delete).mockResolvedValue({ status: 200, data: {} });
    await expect(deleteOwnAccount(request)).rejects.toMatchObject({ indeterminate: true });
    expect(api.delete).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 'CURRENT_PASSWORD_INVALID', 'currentPassword'],
    [400, 'ACCOUNT_DELETION_CONFIRMATION_MISMATCH', 'confirmationPhrase'],
  ] as const)(
    'sanitizes %s field response without retaining submitted values',
    async (status, code, field) => {
      const config = { headers: new AxiosHeaders(), data: request };
      jest.mocked(api.delete).mockRejectedValue(
        new AxiosError('secret request body', undefined, config, undefined, {
          status,
          statusText: 'Bad Request',
          config,
          headers: {},
          data: { message: code },
        }),
      );

      let caught: unknown;
      try {
        await deleteOwnAccount(request);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AccountDeletionError);
      expect(getAccountDeletionFeedback(caught).field).toBe(field);
      expect(JSON.stringify(caught)).not.toContain(request.currentPassword);
      expect(JSON.stringify(caught)).not.toContain(request.confirmationPhrase);
      expect(
        ['config', 'request', 'response', 'cause'].some((key) => key in (caught as object)),
      ).toBe(false);
    },
  );

  it.each([
    [200, 'valid'],
    [401, 'invalid'],
    [429, 'indeterminate'],
    [500, 'indeterminate'],
  ] as const)(
    'performs a single no-replay read for status %s and returns %s',
    async (status, result) => {
      if (status === 401 || status === 429 || status === 500) {
        const config = { headers: new AxiosHeaders() };
        jest.mocked(api.get).mockRejectedValue(
          new AxiosError('untrusted', undefined, config, undefined, {
            status,
            statusText: 'Error',
            config,
            headers: {},
            data: { message: 'do not expose' },
          }),
        );
      } else {
        jest.mocked(api.get).mockResolvedValue({ status, data: { id: 'must-not-escape' } });
      }

      await expect(verifyAccountDeletionSession()).resolves.toBe(result);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledWith('/users/profile', {
        signal: undefined,
        noAuthReplay: true,
        sessionGeneration: expect.any(Number),
        headers: { 'Cache-Control': 'no-store' },
      });
    },
  );

  it('treats network and transport failures as indeterminate and never resends DELETE', async () => {
    jest.mocked(api.delete).mockRejectedValue(new Error('SYNTHETIC_SECRET_PASSWORD'));
    await expect(deleteOwnAccount(request)).rejects.toMatchObject({
      indeterminate: true,
      message: expect.stringContaining('não foi confirmado'),
    });
    jest.mocked(api.get).mockRejectedValue(new Error('SYNTHETIC_SECRET_PASSWORD'));
    await expect(verifyAccountDeletionSession()).resolves.toBe('indeterminate');
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
