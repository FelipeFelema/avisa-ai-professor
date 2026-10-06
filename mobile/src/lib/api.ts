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
  if (request?.url?.startsWith('/push/')) return;
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

      if (!tokens) {
        await notifySessionExpired(generation);
        return Promise.reject(error);
      }

      const response = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        {
          refreshToken: tokens.refreshToken,
        },
      );
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();

      const newTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };

      const saved = await saveTokens(newTokens, generation);
      if (!saved || !isSessionGenerationCurrent(generation)) {
        throw new SessionGenerationChangedError();
      }

      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;

      return api(originalRequest);
    } catch {
      if (isSessionGenerationCurrent(generation)) await notifySessionExpired(generation);

      return Promise.reject(error);
    }
  },
);
