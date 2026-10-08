import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { addConnectivityListener, api, authApi, setSessionExpiredHandler } from '@/lib';
import * as storage from '@/storage';
import { changePassword, ChangePasswordError } from '@/services/auth';
import { invalidateSessionGeneration } from '@/lib/session-generation';

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
    jest.mocked(storage.saveTokens).mockResolvedValue(true);
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

  it.each([401, 503])(
    'never refreshes, replays or retains an opted-out invite POST on %s',
    async (status) => {
      const previousAdapter = api.defaults.adapter;
      const refresh = jest.spyOn(authApi, 'post');
      const expireSession = jest.fn().mockResolvedValue(undefined);
      setSessionExpiredHandler(expireSession);
      const adapter = jest.fn(
        async (request: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
          throw new AxiosError('untrusted', undefined, request, undefined, {
            status,
            statusText: 'Error',
            config: request,
            headers: {},
            data: {},
          });
        },
      );
      api.defaults.adapter = adapter;
      try {
        await expect(
          api.post(
            '/invite-codes',
            { role: 'PROFESSOR' },
            {
              noAuthReplay: true,
            },
          ),
        ).rejects.toBeInstanceOf(AxiosError);
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
        expect(expireSession).not.toHaveBeenCalled();
        expect(storage.saveTokens).not.toHaveBeenCalled();
        expect(storage.clearTokens).not.toHaveBeenCalled();
        // An ordinary request after reconnection cannot resurrect the failed invite POST.
        adapter.mockImplementationOnce(async (request) => ({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config: request,
        }));
        await api.get('/users/profile');
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(adapter.mock.calls[1][0].method).toBe('get');
      } finally {
        api.defaults.adapter = previousAdapter;
      }
    },
  );

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
    const connectivity = jest.fn();
    const remove = addConnectivityListener(connectivity);

    expect(await fulfilled?.(response)).toBe(response);
    await Promise.resolve();
    expect(connectivity).toHaveBeenCalledTimes(1);
    remove();
  });

  it('reports a server response as a connectivity opportunity without changing its error result', async () => {
    const connectivity = jest.fn();
    const remove = addConnectivityListener(connectivity);
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const request = config();
    const error = new AxiosError('server response', undefined, request);
    error.response = {
      status: 503,
      statusText: 'Unavailable',
      headers: {},
      config: request,
      data: {},
    };

    await expect(rejected?.(error)).rejects.toBe(error);
    await Promise.resolve();
    expect(connectivity).toHaveBeenCalledTimes(1);
    remove();
  });

  it.each([
    ['get', '/push/installation'],
    ['post', '/push/installation/reserve'],
    ['put', '/push/installation'],
    ['post', '/push/installation/test'],
  ])('does not feed push reconciliation from a %s %s success or 429', async (method, url) => {
    const connectivity = jest.fn();
    const remove = addConnectivityListener(connectivity);
    const request = { ...config(), method, url };
    const handlers = responseHandlers();
    const fulfilled = handlers.find((handler) => handler.fulfilled)?.fulfilled;
    const rejected = handlers.find((handler) => handler.rejected)?.rejected;
    try {
      const response = { data: {}, status: 200, config: request } as AxiosResponse;
      expect(await fulfilled?.(response)).toBe(response);
      const error = new AxiosError('rate limited', undefined, request);
      error.response = { ...response, status: 429 };
      await expect(rejected?.(error)).rejects.toBe(error);
      await Promise.resolve();
      expect(connectivity).not.toHaveBeenCalled();
    } finally {
      remove();
    }
  });

  it('reports auth responses as connectivity opportunities and excludes logout and network errors', async () => {
    const handlers = (authApi.interceptors.response as unknown as { handlers: ResponseHandler[] })
      .handlers;
    const fulfilled = handlers.find((handler) => handler.fulfilled)?.fulfilled;
    const rejected = handlers.find((handler) => handler.rejected)?.rejected;
    const connectivity = jest.fn();
    const remove = addConnectivityListener(connectivity);
    try {
      const request = { ...config(), url: '/auth/login', method: 'post' };
      const response = { data: {}, status: 200, config: request } as AxiosResponse;
      expect(await fulfilled?.(response)).toBe(response);
      const error = new AxiosError('server', undefined, request);
      error.response = { ...response, status: 503 };
      await expect(rejected?.(error)).rejects.toBe(error);
      await Promise.resolve();
      expect(connectivity).toHaveBeenCalledTimes(2);
      const networkError = new AxiosError('offline', undefined, request);
      await expect(rejected?.(networkError)).rejects.toBe(networkError);
      const logoutResponse = { ...response, config: { ...request, url: '/auth/logout' } };
      expect(await fulfilled?.(logoutResponse)).toBe(logoutResponse);
      const logoutError = new AxiosError('limited', undefined, logoutResponse.config);
      logoutError.response = { ...logoutResponse, status: 429 };
      await expect(rejected?.(logoutError)).rejects.toBe(logoutError);
      await Promise.resolve();
      expect(connectivity).toHaveBeenCalledTimes(2);
    } finally {
      remove();
    }
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
    expect(storage.saveTokens).toHaveBeenCalledWith(
      {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      },
      expect.any(Number),
    );
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
    expect(storage.clearTokens).not.toHaveBeenCalled();
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

  it('does not refresh/retry an incorrect current password and strips its raw request error', async () => {
    const previousAdapter = api.defaults.adapter;
    const refresh = jest.spyOn(authApi, 'post');
    const body = {
      currentPassword: 'Synthetic old password',
      newPassword: 'Synthetic new password',
      confirmNewPassword: 'Synthetic new password',
    };
    const adapter = jest.fn(async (request: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      throw new AxiosError('untrusted', undefined, request, undefined, {
        status: 400,
        statusText: 'Bad Request',
        config: request,
        headers: {},
        data: { message: 'CURRENT_PASSWORD_INVALID' },
      });
    });
    api.defaults.adapter = adapter;
    try {
      let error: unknown;
      try {
        await changePassword(body);
      } catch (caught) {
        error = caught;
      }
      expect(error instanceof ChangePasswordError && error.field === 'currentPassword').toBe(true);
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
      expect(storage.saveTokens).not.toHaveBeenCalled();
      expect(storage.clearTokens).not.toHaveBeenCalled();
      expect(
        !JSON.stringify(error).includes(body.currentPassword) &&
          !JSON.stringify(error).includes(body.newPassword),
      ).toBe(true);
    } finally {
      api.defaults.adapter = previousAdapter;
    }
  });

  it('expires the session when refreshing a 401 fails', async () => {
    const expireSession = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expireSession);
    jest.spyOn(authApi, 'post').mockRejectedValue(new Error('revoked session'));
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const error = unauthorizedError(config());

    await expect(rejected?.(error)).rejects.toBe(error);
    expect(storage.clearTokens).not.toHaveBeenCalled();
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
    expect(storage.clearTokens).not.toHaveBeenCalled();
    expect(expireSession).toHaveBeenCalledTimes(1);
  });

  it('suppresses a refresh that completes after the session generation was invalidated', async () => {
    let resolveRefresh!: (value: AxiosResponse) => void;
    const refreshResponse = new Promise<AxiosResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest.spyOn(authApi, 'post').mockReturnValue(refreshResponse);
    const previousAdapter = api.defaults.adapter;
    const adapter = jest.fn();
    api.defaults.adapter = adapter;
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const request = config();
    const originalError = unauthorizedError(request);
    const outcome = rejected?.(originalError).catch((error) => error);

    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    invalidateSessionGeneration();
    resolveRefresh({
      data: { access_token: 'late-access', refresh_token: 'late-refresh' },
    } as AxiosResponse);

    await expect(outcome).resolves.toBe(originalError);
    expect(storage.saveTokens).not.toHaveBeenCalled();
    expect(adapter).not.toHaveBeenCalled();
    api.defaults.adapter = previousAdapter;
  });

  it('coalesces concurrent 401 refreshes in the same generation', async () => {
    let resolveRefresh!: (response: AxiosResponse) => void;
    const pending = new Promise<AxiosResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest.spyOn(authApi, 'post').mockReturnValue(pending);
    const previousAdapter = api.defaults.adapter;
    api.defaults.adapter = jest.fn().mockResolvedValue({ data: 'retried', status: 200 });
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    const outcomes = [
      rejected?.(unauthorizedError(config())),
      rejected?.(unauthorizedError(config())),
    ];
    try {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const calls = refresh.mock.calls.length;
      resolveRefresh({
        data: { access_token: 'shared-access', refresh_token: 'shared-refresh' },
      } as AxiosResponse);
      await Promise.all(outcomes);
      expect(calls).toBe(1);
      expect(storage.saveTokens).toHaveBeenCalledTimes(1);
    } finally {
      api.defaults.adapter = previousAdapter;
    }
  });

  it('expires once when shared refresh fails for concurrent requests', async () => {
    const expired = jest.fn().mockResolvedValue(undefined);
    setSessionExpiredHandler(expired);
    jest.spyOn(authApi, 'post').mockRejectedValueOnce(new Error('Synthetic revoked refresh'));
    const rejected = responseHandlers().find((handler) => handler.rejected)?.rejected;
    await Promise.allSettled([
      rejected?.(unauthorizedError(config())),
      rejected?.(unauthorizedError(config())),
    ]);
    expect(authApi.post).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(storage.saveTokens).not.toHaveBeenCalled();
  });
});
