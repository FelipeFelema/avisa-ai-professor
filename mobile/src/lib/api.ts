import { AxiosError, create, InternalAxiosRequestConfig } from 'axios';

import { clearTokens, getTokens, saveTokens } from '@/storage';

import { env } from '@/config';
import {
  getSessionGeneration,
  invalidateSessionGeneration,
  isSessionGenerationCurrent,
  SessionGenerationChangedError,
} from '@/lib/session-generation';

type SessionExpiredHandler = (generation: number) => void | Promise<void>;
type ConnectivityListener = () => void | Promise<void>;

let sessionExpiredHandler: SessionExpiredHandler | undefined;
const connectivityListeners = new Set<ConnectivityListener>();

export function addConnectivityListener(listener: ConnectivityListener): () => void {
  connectivityListeners.add(listener);
  return () => connectivityListeners.delete(listener);
}

function notifyConnectivityAvailable(request?: { url?: string }): void {
  // Push responses must not trigger the reconciliation that produced them, including 429s.
  if (request?.url?.startsWith('/push/') || request?.url === '/auth/logout') return;
  for (const listener of connectivityListeners) {
    void Promise.resolve()
      .then(listener)
      .catch(() => undefined);
  }
}

export function setSessionExpiredHandler(handler?: SessionExpiredHandler) {
  sessionExpiredHandler = handler;
}

async function notifySessionExpired(generation: number) {
  if (!isSessionGenerationCurrent(generation)) return;
  if (sessionExpiredHandler) await sessionExpiredHandler(generation);
  else await clearTokens(invalidateSessionGeneration());
}

export const api = create({
  baseURL: env.apiUrl,
  timeout: 10000,
});

export const authApi = create({
  baseURL: env.apiUrl,
  timeout: 10000,
});

authApi.interceptors.response.use(
  (response) => {
    notifyConnectivityAvailable(response.config);
    return response;
  },
  (error: AxiosError) => {
    if (error.response) notifyConnectivityAvailable(error.config);
    return Promise.reject(error);
  },
);

// One rotation and one token write per generation. A stale completion cannot
// overwrite another account's refresh or clear its in-flight operation.
let refreshFlight: { generation: number; promise: Promise<string> } | undefined;

function refreshSession(generation: number): Promise<string> {
  if (refreshFlight?.generation === generation) return refreshFlight.promise;
  const promise = (async () => {
    try {
      const tokens = await getTokens(generation);
      if (!isSessionGenerationCurrent(generation) || !tokens)
        throw new SessionGenerationChangedError();
      const response = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refreshToken: tokens.refreshToken },
      );
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
      const saved = await saveTokens(
        {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
        },
        generation,
      );
      if (!saved || !isSessionGenerationCurrent(generation))
        throw new SessionGenerationChangedError();
      return response.data.access_token;
    } catch (error) {
      if (isSessionGenerationCurrent(generation)) await notifySessionExpired(generation);
      throw error;
    } finally {
      if (refreshFlight?.generation === generation) refreshFlight = undefined;
    }
  })();
  refreshFlight = { generation, promise };
  return promise;
}

// Atach the access token to every authenticated request.
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const generation = config.sessionGeneration ?? getSessionGeneration();
  config.sessionGeneration = generation;
  if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();

  const tokens = await getTokens(generation);
  if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();

  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    notifyConnectivityAvailable(response.config);
    return response;
  },

  async (error: AxiosError) => {
    if (error.response) notifyConnectivityAvailable(error.config);
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const generation = originalRequest.sessionGeneration ?? getSessionGeneration();
    if (!isSessionGenerationCurrent(generation)) {
      return Promise.reject(new SessionGenerationChangedError());
    }

    if (originalRequest.noAuthReplay || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const tokens = await getTokens(generation);
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();

      const sentAuthorization = originalRequest.headers.Authorization;
      // A delayed 401 may have used the token rotated by another request.
      const accessToken =
        tokens && sentAuthorization && sentAuthorization !== `Bearer ${tokens.accessToken}`
          ? tokens.accessToken
          : await refreshSession(generation);
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return api(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  },
);
