import { AxiosError, create, InternalAxiosRequestConfig } from 'axios';

import { clearTokens, getTokens, saveTokens } from '@/storage';

import { env } from '@/config';

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
  const tokens = await getTokens();

  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const tokens = await getTokens();

      if (!tokens) {
        return Promise.reject(error);
      }

      const response = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        {
          refreshToken: tokens.refreshToken,
        },
      );

      const newTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };

      await saveTokens(newTokens);

      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;

      return api(originalRequest);
    } catch {
      await clearTokens();

      return Promise.reject(error);
    }
  },
);
