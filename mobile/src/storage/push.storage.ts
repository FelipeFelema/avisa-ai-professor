import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type {
  PushCurrentBinding,
  PushInstallationIdentity,
  PushPendingRevocation,
} from '@/types/push';

const IDENTITY_KEY = 'push.installation.identity.v1';
const MARKER_KEY = 'push.installation.marker.v1';
const OPT_IN_KEY = 'push.notifications.opt-in.v1';
const BINDING_KEY = 'push.installation.binding.v1';
const PENDING_REVOCATION_KEY = 'push.installation.pending-revocation.v1';
const MARKER_VALUE = 'v1';
const CAPABILITY_BYTES = 32;
const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let mutationQueue: Promise<void> = Promise.resolve();

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export class PushStorageRecoveryError extends Error {
  constructor() {
    super('Push storage is unavailable or requires recovery.');
    this.name = 'PushStorageRecoveryError';
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;

    encoded += BASE64_URL_ALPHABET[first >> 2];
    encoded += BASE64_URL_ALPHABET[((first & 3) << 4) | (second >> 4)];
    if (hasSecond) {
      encoded += BASE64_URL_ALPHABET[((second & 15) << 2) | (third >> 6)];
    }
    if (hasThird) {
      encoded += BASE64_URL_ALPHABET[third & 63];
    }
  }

  return encoded;
}

function isUuidV4(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isCapability(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return false;
  }

  const bytes: number[] = [];
  let accumulator = 0;
  let bitCount = 0;
  for (const character of value) {
    const digit = BASE64_URL_ALPHABET.indexOf(character);
    if (digit < 0) {
      return false;
    }

    accumulator = (accumulator << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((accumulator >> bitCount) & 0xff);
      accumulator &= (1 << bitCount) - 1;
    }
  }

  return (
    bytes.length === CAPABILITY_BYTES &&
    bitCount === 2 &&
    accumulator === 0 &&
    encodeBase64Url(Uint8Array.from(bytes)) === value
  );
}

function isCurrentBinding(value: unknown): value is PushCurrentBinding {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const binding = value as Record<string, unknown>;
  return (
    Object.keys(binding).length === 2 &&
    isUuidV4(binding.bindingId) &&
    Number.isInteger(binding.lifecycleVersion) &&
    Number(binding.lifecycleVersion) >= 1 &&
    Number(binding.lifecycleVersion) <= 2147483647
  );
}

function isPendingRevocation(value: unknown): value is PushPendingRevocation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const pending = value as Record<string, unknown>;
  const keys = ['installationId', 'capability', 'bindingId', 'lifecycleVersion', 'reason'];
  return (
    Object.keys(pending).length === keys.length &&
    keys.every((key) => Object.hasOwn(pending, key)) &&
    isUuidV4(pending.installationId) &&
    isCapability(pending.capability) &&
    isCurrentBinding({
      bindingId: pending.bindingId,
      lifecycleVersion: pending.lifecycleVersion,
    }) &&
    ['USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED'].includes(String(pending.reason))
  );
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, secureStoreOptions);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function asyncGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function asyncSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function asyncDelete(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    throw new PushStorageRecoveryError();
  }
}

async function resetPushStateForNewInstall(): Promise<void> {
  await secureDelete(IDENTITY_KEY);
  await secureDelete(BINDING_KEY);
  await secureDelete(PENDING_REVOCATION_KEY);
  await asyncDelete(OPT_IN_KEY);
}

async function createInstallationIdentity(): Promise<PushInstallationIdentity> {
  const installationId = Crypto.randomUUID();
  const secretBytes = await Crypto.getRandomBytesAsync(CAPABILITY_BYTES);

  if (secretBytes.length !== CAPABILITY_BYTES) {
    throw new PushStorageRecoveryError();
  }

  return {
    installationId,
    capability: encodeBase64Url(secretBytes),
  };
}

function parseInstallationIdentity(value: string): PushInstallationIdentity {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PushStorageRecoveryError();
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 2 ||
    !isUuidV4((parsed as Record<string, unknown>).installationId) ||
    !isCapability((parsed as Record<string, unknown>).capability)
  ) {
    throw new PushStorageRecoveryError();
  }

  return parsed as PushInstallationIdentity;
}

export async function getOrCreatePushIdentity(): Promise<PushInstallationIdentity> {
  const marker = await asyncGet(MARKER_KEY);

  if (marker === null) {
    await resetPushStateForNewInstall();
    const identity = await createInstallationIdentity();
    await secureSet(IDENTITY_KEY, JSON.stringify(identity));
    await asyncSet(MARKER_KEY, MARKER_VALUE);
    return identity;
  }

  if (marker !== MARKER_VALUE) {
    throw new PushStorageRecoveryError();
  }

  const serializedIdentity = await secureGet(IDENTITY_KEY);
  if (serializedIdentity === null) {
    throw new PushStorageRecoveryError();
  }

  return parseInstallationIdentity(serializedIdentity);
}

export async function getPushOptIn(): Promise<boolean> {
  const value = await asyncGet(OPT_IN_KEY);
  return value === 'true';
}

export async function setPushOptIn(enabled: boolean): Promise<void> {
  await serializeMutation(() => asyncSet(OPT_IN_KEY, String(enabled)));
}

export async function readCurrentBinding(): Promise<PushCurrentBinding | null> {
  const serialized = await secureGet(BINDING_KEY);
  if (serialized === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new PushStorageRecoveryError();
  }

  if (!isCurrentBinding(parsed)) {
    throw new PushStorageRecoveryError();
  }

  return parsed;
}

export async function saveCurrentBinding(binding: PushCurrentBinding): Promise<void> {
  if (!isCurrentBinding(binding)) {
    throw new PushStorageRecoveryError();
  }

  await serializeMutation(async () => {
    await secureSet(BINDING_KEY, JSON.stringify(binding));
  });
}

export async function clearCurrentBinding(): Promise<void> {
  await serializeMutation(() => secureDelete(BINDING_KEY));
}

export async function clearCurrentBindingIfMatches(expected: PushCurrentBinding): Promise<boolean> {
  return serializeMutation(async () => {
    const current = await readCurrentBinding();
    if (
      current === null ||
      current.bindingId !== expected.bindingId ||
      current.lifecycleVersion !== expected.lifecycleVersion
    ) {
      return false;
    }
    await secureDelete(BINDING_KEY);
    return true;
  });
}

export async function readPendingRevocation(): Promise<PushPendingRevocation | null> {
  const serialized = await secureGet(PENDING_REVOCATION_KEY);
  if (serialized === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new PushStorageRecoveryError();
  }

  if (!isPendingRevocation(parsed)) {
    throw new PushStorageRecoveryError();
  }

  return parsed;
}

export async function savePendingRevocation(pending: PushPendingRevocation): Promise<void> {
  if (!isPendingRevocation(pending)) {
    throw new PushStorageRecoveryError();
  }

  await serializeMutation(async () => {
    const current = await readPendingRevocation();
    if (
      current &&
      current.installationId === pending.installationId &&
      current.lifecycleVersion >= pending.lifecycleVersion
    ) {
      return;
    }
    await secureSet(PENDING_REVOCATION_KEY, JSON.stringify(pending));
  });
}

export async function clearPendingRevocation(
  expected: PushPendingRevocation,
  responseStatus: number,
): Promise<boolean> {
  if (responseStatus !== 204) {
    return false;
  }

  return serializeMutation(async () => {
    const current = await readPendingRevocation();
    if (current === null || JSON.stringify(current) !== JSON.stringify(expected)) {
      return false;
    }

    await secureDelete(PENDING_REVOCATION_KEY);
    return true;
  });
}
