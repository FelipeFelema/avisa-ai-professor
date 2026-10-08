import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/constants';
import {
  getSessionGeneration,
  invalidateSessionGeneration,
  isSessionGenerationCurrent,
} from '@/lib/session-generation';
import type { LoginResponse } from '@/types/auth';

export interface TokenCleanupOutcome {
  accessTokenRemoved: boolean;
  refreshTokenRemoved: boolean;
  complete: boolean;
}

let tokenOperationQueue: Promise<void> = Promise.resolve();

export function serializeTokenOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = tokenOperationQueue.then(operation, operation);
  tokenOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function saveTokens(
  tokens: LoginResponse,
  generation = getSessionGeneration(),
): Promise<boolean> {
  return serializeTokenOperation(async () => {
    if (!isSessionGenerationCurrent(generation)) return false;

    const writes = await Promise.allSettled([
      SecureStore.setItemAsync(STORAGE_KEYS.accessToken, tokens.accessToken),
      SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, tokens.refreshToken),
    ]);
    if (writes.some((write) => write.status === 'rejected')) {
      await Promise.allSettled([
        SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
        SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
      ]);
      return false;
    }

    return isSessionGenerationCurrent(generation);
  });
}

export async function getTokens(
  generation = getSessionGeneration(),
): Promise<LoginResponse | null> {
  await tokenOperationQueue;
  if (!isSessionGenerationCurrent(generation)) return null;

  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
  ]);
  if (!isSessionGenerationCurrent(generation) || !accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function clearTokens(generation?: number): Promise<TokenCleanupOutcome> {
  const cleanupGeneration = generation ?? invalidateSessionGeneration();
  return serializeTokenOperation(async () => {
    if (!isSessionGenerationCurrent(cleanupGeneration)) {
      return { accessTokenRemoved: false, refreshTokenRemoved: false, complete: false };
    }

    const [access, refresh] = await Promise.allSettled([
      SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
    ]);
    const outcome = {
      accessTokenRemoved: access.status === 'fulfilled',
      refreshTokenRemoved: refresh.status === 'fulfilled',
      complete: access.status === 'fulfilled' && refresh.status === 'fulfilled',
    };
    return outcome;
  });
}
