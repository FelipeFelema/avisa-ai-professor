import { create, InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config';
import { getTokens } from '@/storage';

export const api = create({
  baseURL: env.apiUrl,
  timeout: 10000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const tokens = await getTokens();

  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  return config;
});
