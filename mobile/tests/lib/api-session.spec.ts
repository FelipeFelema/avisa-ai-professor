import { AxiosError, AxiosHeaders } from 'axios';

import { api, authApi, setSessionExpiredHandler } from '@/lib';
import * as storage from '@/storage';

jest.mock('@/storage', () => ({
  clearTokens: jest.fn(),
  getTokens: jest.fn(),
  saveTokens: jest.fn(),
}));

describe('API session bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSessionExpiredHandler(undefined);
    jest.mocked(storage.getTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('notifies the auth boundary after a revoked refresh clears the device session', async () => {
    const expireSession = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expireSession);
    jest.spyOn(authApi, 'post').mockRejectedValue(new Error('revoked session'));

    const responseError = new AxiosError('unauthorized', undefined, {
      headers: new AxiosHeaders(),
      _retry: false,
    });
    responseError.response = {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: responseError.config!,
      data: {},
    };

    const rejected = (
      api.interceptors.response as unknown as {
        handlers: Array<{ rejected?: (error: unknown) => Promise<unknown> }>;
      }
    ).handlers.find((handler) => handler.rejected)?.rejected;

    await expect(rejected?.(responseError)).rejects.toBe(responseError);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(expireSession).toHaveBeenCalledTimes(1);
  });
});
