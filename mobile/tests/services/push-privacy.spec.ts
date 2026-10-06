import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '@/lib/api';
import * as pushStorage from '@/storage/push.storage';
import {
  activatePushRegistration,
  pushRevocationApi,
  PushServiceError,
  revokePushInstallation,
  sendPushTest,
} from '@/services/push/push.service';
import type { PushPendingRevocation } from '@/types/push';

jest.mock('@/storage/push.storage', () => ({
  getOrCreatePushIdentity: jest.fn(),
}));

const privateMarkers = {
  installationId: '00000000-0000-4000-8000-000000000681',
  capability: 'synthetic-capability-private-marker-privacy-suite',
  expoToken: 'ExpoPushToken[synthetic-privacy-token-marker]',
  bindingId: '00000000-0000-4000-8000-000000000682',
  backendToken: 'synthetic-backend-bearer-private-marker',
};

const identity = {
  installationId: privateMarkers.installationId,
  capability: privateMarkers.capability,
};

const binding = {
  bindingId: privateMarkers.bindingId,
  lifecycleVersion: 1,
  tokenRevision: 0,
  state: 'RESERVED' as const,
};

function rawAxiosFailure(): AxiosError {
  const url = `/push/installation/test?marker=${encodeURIComponent(privateMarkers.expoToken)}`;
  const config = { url } as InternalAxiosRequestConfig;
  const error = new AxiosError(
    `${privateMarkers.expoToken} ${privateMarkers.capability} ${privateMarkers.backendToken}`,
    'ERR_BAD_RESPONSE',
    config,
  );
  error.response = {
    data: {
      message: `${privateMarkers.expoToken} ${privateMarkers.capability} ${privateMarkers.backendToken}`,
      private: privateMarkers.installationId,
    },
    status: 500,
    statusText: 'Internal Server Error',
    headers: {},
    config,
  };
  return error;
}

describe('push privacy boundaries', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(pushStorage.getOrCreatePushIdentity).mockResolvedValue(identity);
  });

  it('keeps token, capability, installation id, and raw Axios details out of URLs, errors, and logs', async () => {
    const error = rawAxiosFailure();
    const put = jest.spyOn(api, 'put').mockRejectedValue(error);
    const post = jest.spyOn(api, 'post').mockRejectedValue(error);
    const remove = jest.spyOn(pushRevocationApi, 'delete').mockRejectedValue(error);
    const logCalls: unknown[][] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => logCalls.push(args));
    jest.spyOn(console, 'warn').mockImplementation((...args) => logCalls.push(args));
    jest.spyOn(console, 'error').mockImplementation((...args) => logCalls.push(args));

    let activationError: unknown;
    try {
      await activatePushRegistration(binding, 'ANDROID', privateMarkers.expoToken);
    } catch (caught) {
      activationError = caught;
    }
    let testError: unknown;
    try {
      await sendPushTest();
    } catch (caught) {
      testError = caught;
    }
    const pending: PushPendingRevocation = {
      ...identity,
      bindingId: binding.bindingId,
      lifecycleVersion: 1,
      reason: 'LOGOUT',
    };
    let revocationError: unknown;
    try {
      await revokePushInstallation(pending);
    } catch (caught) {
      revocationError = caught;
    }

    expect(activationError).toBeInstanceOf(PushServiceError);
    expect(testError).toMatchObject({
      name: 'PushServiceError',
      message: 'Não foi possível concluir a solicitação. Verifique a conexão e tente novamente.',
    });
    expect(revocationError).toBeInstanceOf(PushServiceError);
    expect(logCalls).toEqual([]);

    const requests = [
      { url: put.mock.calls[0]?.[0], data: put.mock.calls[0]?.[1] },
      { url: post.mock.calls[0]?.[0], data: post.mock.calls[0]?.[1] },
      { url: remove.mock.calls[0]?.[0], data: remove.mock.calls[0]?.[1]?.data },
    ];
    expect(requests.map(({ url }) => url)).toEqual([
      '/push/installation',
      '/push/installation/test',
      '/push/installation',
    ]);
    const publicErrors = JSON.stringify([
      activationError instanceof Error
        ? { name: activationError.name, message: activationError.message }
        : activationError,
      testError instanceof Error ? { name: testError.name, message: testError.message } : testError,
      revocationError instanceof Error
        ? { name: revocationError.name, message: revocationError.message }
        : revocationError,
      logCalls,
    ]);
    for (const marker of Object.values(privateMarkers)) {
      expect(publicErrors).not.toContain(marker);
      expect(JSON.stringify(requests.map(({ url }) => url))).not.toContain(marker);
    }

    const activationBody = requests[0]?.data as Record<string, unknown>;
    expect(activationBody.expoToken).toBe(privateMarkers.expoToken);
    expect(activationBody.bindingId).toBe(binding.bindingId);
    expect(JSON.stringify(activationBody)).not.toContain(privateMarkers.capability);
    expect(JSON.stringify(activationBody)).not.toContain(privateMarkers.installationId);
    const testOptions = post.mock.calls[0]?.[2];
    expect(testOptions?.headers).toMatchObject({
      'X-Push-Installation': privateMarkers.installationId,
      'X-Push-Capability': privateMarkers.capability,
    });
    expect(testOptions?.headers).not.toHaveProperty('Authorization');
    const revocationOptions = remove.mock.calls[0]?.[1];
    expect(revocationOptions?.headers).toMatchObject({
      'X-Push-Installation': privateMarkers.installationId,
      'X-Push-Capability': privateMarkers.capability,
    });
    expect(revocationOptions?.headers).not.toHaveProperty('Authorization');
  });

  it('returns a fixed safe error when a response contains private fields', async () => {
    const privateResponse = {
      bindingId: privateMarkers.bindingId,
      expoToken: privateMarkers.expoToken,
      installationId: privateMarkers.installationId,
      capability: privateMarkers.capability,
    };
    jest.spyOn(api, 'put').mockResolvedValue({ data: privateResponse } as never);

    let caught: unknown;
    try {
      await activatePushRegistration(binding, 'ANDROID', privateMarkers.expoToken);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      name: 'PushServiceError',
      message: 'A resposta do servidor é inválida.',
    });
    for (const marker of Object.values(privateMarkers)) {
      expect(String((caught as Error).message)).not.toContain(marker);
    }
  });
});
