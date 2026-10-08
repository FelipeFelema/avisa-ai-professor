import { AppState } from 'react-native';
import { api, authApi, addConnectivityListener } from '@/lib/api';
import {
  isSessionGenerationCurrent,
  SessionGenerationChangedError,
} from '@/lib/session-generation';
import {
  parseSessionRevocation,
  saveSessionRevocation,
  enqueueSessionRevocation,
  pendingSessionRevocations,
  acknowledgeSessionRevocation,
} from '@/storage/session-revocation.storage';
export { queueCurrentSessionRevocation } from '@/storage/session-revocation.storage';

export async function ensureSessionRevocation(generation: number): Promise<void> {
  const response = await api.get<unknown>('/auth/session-revocation', {
    sessionGeneration: generation,
  });
  const entry = parseSessionRevocation(response.data);
  if (!isSessionGenerationCurrent(generation)) {
    await enqueueSessionRevocation(entry);
    void flushPendingSessionRevocations();
    throw new SessionGenerationChangedError();
  }
  await saveSessionRevocation(entry, generation);
}

let drain: Promise<boolean> | undefined;
export function flushPendingSessionRevocations(): Promise<boolean> {
  if (drain) return drain;
  drain = (async () => {
    try {
      // A snapshot; entries added by another logout are never deleted by an ACK.
      const pending = await pendingSessionRevocations();
      let complete = true;
      for (const entry of pending) {
        try {
          // No Authorization/header selection, no refresh/replay interceptor.
          const response = await authApi.post('/auth/logout', entry);
          if (response.status !== 204) {
            complete = false;
            continue;
          }
          await acknowledgeSessionRevocation(entry);
        } catch {
          complete = false;
        }
      }
      return complete;
    } catch {
      return false;
    } finally {
      drain = undefined;
    }
  })();
  return drain;
}

export function startSessionRevocationRecovery(): () => void {
  void flushPendingSessionRevocations();
  const disconnect = addConnectivityListener(() =>
    flushPendingSessionRevocations().then(() => undefined),
  );
  let active = AppState.currentState !== 'background';
  const foreground = AppState.addEventListener('change', (state) => {
    active = state === 'active';
    if (active) void flushPendingSessionRevocations();
  });
  // A foreground retry also handles reconnection while signed out, with no
  // authenticated requests to announce connectivity. No request when empty.
  const retry = setInterval(() => {
    if (active) void flushPendingSessionRevocations();
  }, 30_000);
  return () => {
    clearInterval(retry);
    foreground.remove();
    disconnect();
  };
}
