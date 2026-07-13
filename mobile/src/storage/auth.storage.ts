import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants';

import type { LoginResponse } from '@/types/auth';

export async function saveTokens(tokens: LoginResponse) {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, tokens.accessToken);

  await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, tokens.refreshToken);
}

export async function getTokens() {}

export async function clearTokens() {}
