import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { api, authApi, setSessionExpiredHandler } from '@/lib';
import * as storage from '@/storage';

jest.mock('@/storage', () => ({
  clearTokens: jest.fn(),
  getTokens: jest.fn(),
  saveTokens: jest.fn(),
}));

describe('API session bridge', () => {
  type RequestHandler = {
    fulfilled?: (config: InternalAxiosRequestConfig) => unknown;
  };
  type ResponseHandler = {
    fulfilled?: (response: AxiosResponse) => unknown;
    rejected?: (error: AxiosError) => Promise<unknown>;
  };

  function requestHandler() {
    return (api.interceptors.request as unknown as { handlers: RequestHandler[] }).handlers.find(
      (handler) => handler.fulfilled,
    )?.fulfilled;
  }

  function responseHandlers() {
    return (api.interceptors.response as unknown as { handlers: ResponseHandler[] }).handlers;
  }

  function unauthorizedError(config?: InternalAxiosRequestConfig, retry = false) {
    if (!config) {
      return new AxiosError('unauthorized');
    }

    config._retry = retry;
    const error = new AxiosError('unauthorized', undefined, config);
    error.response = {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
      data: {},
    };
    return error;
  }

  function config(): InternalAxiosRequestConfig {
    return {
      headers: new AxiosHeaders(),
      method: 'get',
      url: '/protected',
    } as InternalAxiosRequestConfig;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setSessionExpiredHandler(undefined);
    jest.mocked(storage.getTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  afterEach(() => {
    setSessionExpiredHandler(undefined);
    jest.restoreAllMocks();
  });

  it('adds the access token to authenticated requests', async () => {
    const request = config();

    await requestHandler()?.(request);

    expect(request.headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('passes requests through without an Authorization header when no tokens exist', async () => {
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    const request = config();

    const result = await requestHandler()?.(request);

    expect(result).toBe(request);
    expect(request.headers.get('Authorization')).toBeUndefined();
  });

  it('passes successful responses through unchanged', async () => {
    const response = { data: { ok: true }, status: 200 } as AxiosResponse;
    const fulfilled = responseHandlers().find((handler) => handler.fulfilled)?.fulfilled;

    expect(await fulfilled?.(response)).toBe(response);
  });

  it('refreshes tokens, retries a 401 request and returns the retried response', async () => {
    const request = config();
    const refreshed = { access_token: 'new-access', refresh_token: 'new-refresh' };
    const retriedResponse = { data: { ok: true }, status: 200 } as AxiosResponse;
    const refresh = jest
      .spyOn(authApi, 'post')
      .mockResolvedValue({ data: refreshed } as AxiosResponse);
    const previousAdapter = api.defaults.adapter;
    api.defaults.adapter = jest.fn().mockResolvedValue(retriedResponse);
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;

    await expect(rejected?.(unauthorizedError(request))).resolves.toBe(retriedResponse);
    expect(refresh).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh-token' });
    expect(storage.saveTokens).toHaveBeenCalledWith({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(request.headers.get('Authorization')).toBe('Bearer new-access');
    api.defaults.adapter = previousAdapter;
  });

  it('expires the session when a 401 has no tokens to refresh', async () => {
    const expireSession = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expireSession);
    jest.mocked(storage.getTokens).mockResolvedValue(null);
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const error = unauthorizedError(config());

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(expireSession).toHaveBeenCalledTimes(1);
    expect(storage.saveTokens).not.toHaveBeenCalled();
  });

  it('does not retry a request already marked as retried', async () => {
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const error = unauthorizedError(config(), true);

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.getTokens).not.toHaveBeenCalled();
  });

  it('rejects errors without a request config', async () => {
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const error = unauthorizedError();

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.getTokens).not.toHaveBeenCalled();
  });

  it('rejects non-401 responses without refreshing', async () => {
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const request = config();
    const error = unauthorizedError(request);
    error.response = { ...error.response!, status: 403 };

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.getTokens).not.toHaveBeenCalled();
  });

  it('expires the session when refreshing a 401 fails', async () => {
    const expireSession = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expireSession);
    jest.spyOn(authApi, 'post').mockRejectedValue(new Error('revoked session'));
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const error = unauthorizedError(config());

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(expireSession).toHaveBeenCalledTimes(1);
    expect(storage.saveTokens).not.toHaveBeenCalled();
  });

  it('notifies the auth boundary after a revoked refresh clears the device session', async () => {
    const expireSession = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expireSession);
    jest.spyOn(authApi, 'post').mockRejectedValue(new Error('revoked session'));
    const responseError = unauthorizedError(config());
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;

    await expect(rejected?.(responseError)).rejects.toBe(responseError);
    expect(storage.clearTokens).toHaveBeenCalledTimes(1);
    expect(expireSession).toHaveBeenCalledTimes(1);
  });
});
