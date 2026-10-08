import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/constants';
import { serializeTokenOperation } from './auth.storage';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export type SessionRevocation = { sid: string; capability: string };

export function parseSessionRevocation(value: unknown): SessionRevocation {
  if (
    !value ||
    typeof value !== 'object' ||
    !('sid' in value) ||
    !('capability' in value) ||
    typeof value.sid !== 'string' ||
    typeof value.capability !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.sid) ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.capability) ||
    Object.keys(value).length !== 2
  )
    throw new Error('SESSION_REVOCATION_STORAGE_INVALID');
  return { sid: value.sid, capability: value.capability };
}

async function readCurrent(): Promise<SessionRevocation | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEYS.sessionRevocation);
  try {
    return raw ? parseSessionRevocation(JSON.parse(raw)) : null;
  } catch {
    throw new Error('SESSION_REVOCATION_STORAGE_INVALID');
  }
}
async function readPending(): Promise<SessionRevocation[]> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEYS.pendingSessionRevocations);
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('SESSION_REVOCATION_STORAGE_INVALID');
  }
  if (!Array.isArray(value)) throw new Error('SESSION_REVOCATION_STORAGE_INVALID');
  return value.map(parseSessionRevocation);
}
function matches(a: SessionRevocation, b: SessionRevocation) {
  return a.sid === b.sid && a.capability === b.capability;
}
async function enqueue(entry: SessionRevocation) {
  const pending = await readPending();
  if (!pending.some((item) => matches(item, entry))) {
    pending.push(entry);
    await SecureStore.setItemAsync(STORAGE_KEYS.pendingSessionRevocations, JSON.stringify(pending));
  }
}

export function saveSessionRevocation(entry: SessionRevocation, generation: number): Promise<void> {
  const minimal = parseSessionRevocation(entry);
  return serializeTokenOperation(async () => {
    if (!isSessionGenerationCurrent(generation))
      throw new Error('SESSION_REVOCATION_GENERATION_CHANGED');
    const previous = await readCurrent();
    if (previous && !matches(previous, minimal)) await enqueue(previous);
    await SecureStore.setItemAsync(STORAGE_KEYS.sessionRevocation, JSON.stringify(minimal));
  });
}
export function enqueueSessionRevocation(entry: SessionRevocation): Promise<void> {
  const minimal = parseSessionRevocation(entry);
  return serializeTokenOperation(() => enqueue(minimal));
}

// Called synchronously BEFORE invalidating the generation. The queued snapshot
// precedes token cleanup/new-account writes in the same storage operation queue.
export function queueCurrentSessionRevocation(generation: number): Promise<boolean> {
  if (!isSessionGenerationCurrent(generation)) return Promise.resolve(true);
  return serializeTokenOperation(async () => {
    const current = await readCurrent();
    if (current) {
      await enqueue(current); // Keep current on a failed durable write.
      await SecureStore.deleteItemAsync(STORAGE_KEYS.sessionRevocation);
    }
    return true;
  });
}

export function pendingSessionRevocations(): Promise<SessionRevocation[]> {
  return serializeTokenOperation(async () => {
    // Recover a crash/write failure between local logout and durable enqueue.
    const current = await readCurrent();
    if (
      current &&
      (!(await SecureStore.getItemAsync(STORAGE_KEYS.accessToken)) ||
        !(await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken)))
    ) {
      await enqueue(current);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.sessionRevocation);
    }
    return readPending();
  });
}

export function acknowledgeSessionRevocation(entry: SessionRevocation): Promise<void> {
  return serializeTokenOperation(async () => {
    const pending = (await readPending()).filter((item) => !matches(item, entry));
    if (pending.length)
      await SecureStore.setItemAsync(
        STORAGE_KEYS.pendingSessionRevocations,
        JSON.stringify(pending),
      );
    else await SecureStore.deleteItemAsync(STORAGE_KEYS.pendingSessionRevocations);
    const current = await readCurrent();
    if (current && matches(current, entry))
      await SecureStore.deleteItemAsync(STORAGE_KEYS.sessionRevocation);
  });
}
