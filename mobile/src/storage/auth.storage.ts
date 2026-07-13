import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants';

import type { LoginResponse } from '@/types/auth';

export async function saveTokens(tokens: LoginResponse) {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, tokens.accessToken);

  await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, tokens.refreshToken);
}

export async function getTokens(): Promise<LoginResponse | null> {
  const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken);
}
