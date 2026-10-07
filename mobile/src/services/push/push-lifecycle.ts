import { getPushRuntimeConfig, type PushRuntimeConfig } from '@/config/push-config';
import {
  getOrCreatePushIdentity,
  getPushOptIn,
  readCurrentBinding,
  readPendingRevocation,
  saveCurrentBinding,
  clearCurrentBindingIfMatches,
  savePendingRevocation,
  clearPendingRevocation,
  setPushOptIn,
} from '@/storage/push.storage';
import type { PushCurrentBinding, PushPendingRevocation } from '@/types/push';
import {
  getExpoPushToken,
  readPushPermission,
  requestPushPermission,
  type PushPermissionState,
} from './push-device.service';
import {
  activatePushRegistration,
  getPushInstallationState,
  reservePushInstallation,
  revokePushInstallation,
  sendPushTest,
  PushServiceError,
} from './push.service';
import { rememberPushTestAttempt } from './push-presentation';
import {
  assertSessionGeneration,
  getSessionGeneration,
  isSessionGenerationCurrent,
  SessionGenerationChangedError,
} from '@/lib/session-generation';

export type PushUiStatus =
  | 'LOADING'
  | 'NOT_REQUESTED'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'REGISTERING'
  | 'ACTIVE'
  | 'AUTHORIZED_APP_DISABLED'
  | 'ERROR'
  | 'RECOVERY'
  | 'PENDING_CLEANUP';

export type PushLifecycleSnapshot = {
  status: PushUiStatus;
  message: string | null;
  testAvailableAt?: string;
};

export type PushTestLifecycleResult = {
  state: 'ACCEPTED' | 'COOLDOWN' | 'FAILED';
  message: string;
  nextTestAvailableAt: string | null;
};

type PushLifecycleListener = (result: PushLifecycleSnapshot, sessionGeneration: number) => void;

const MESSAGE: Record<string, string> = {
  SDK_UNAVAILABLE: 'Não foi possível consultar a permissão do dispositivo. Tente novamente.',
  TOKEN_UNAVAILABLE: 'Não foi possível obter um token de notificações. Tente novamente.',
  PERMISSION_REQUIRED: 'Ative a permissão de notificações nas configurações do dispositivo.',
  CONFIGURATION_UNAVAILABLE: 'Notificações não estão configuradas para esta build.',
  DEVICE_UNAVAILABLE: 'Notificações estão disponíveis somente em um dispositivo compatível.',
  UNAVAILABLE: 'Notificações indisponíveis neste dispositivo.',
  RECOVERY: 'O armazenamento privado de notificações precisa ser recuperado.',
  PENDING_CLEANUP: 'A desativação será concluída quando houver conexão.',
  GENERIC: 'Não foi possível atualizar as notificações. Tente novamente.',
};

const grantedStates = new Set<PushPermissionState>(['GRANTED', 'PROVISIONAL', 'EPHEMERAL']);
let activationFlight: Promise<PushLifecycleSnapshot> | null = null;
let activationFlightGeneration: number | null = null;
let activationFlightIntent: number | null = null;
let pushIntentGeneration = 0;
let testFlight: Promise<PushTestLifecycleResult> | null = null;
let testFlightSessionGeneration: number | null = null;
let optOutInMemory = false;
const lifecycleListeners = new Set<PushLifecycleListener>();

function snapshot(
  status: PushUiStatus,
  message: string | null = null,
  testAvailableAt?: string | null,
): PushLifecycleSnapshot {
  return {
    status,
    message,
    ...(testAvailableAt ? { testAvailableAt } : {}),
  };
}

export function subscribePushLifecycle(listener: PushLifecycleListener): () => void {
  lifecycleListeners.add(listener);
  return () => lifecycleListeners.delete(listener);
}

function publishLifecycle(
  result: PushLifecycleSnapshot,
  sessionGeneration: number,
): PushLifecycleSnapshot {
  for (const listener of lifecycleListeners) {
    try {
      listener(result, sessionGeneration);
    } catch {
      // A status observer must not change the push operation result.
    }
  }
  return result;
}

function unavailableMessage(config: PushRuntimeConfig): string {
  return MESSAGE[config.reason ?? 'UNAVAILABLE'] ?? MESSAGE.UNAVAILABLE;
}

function safeMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && MESSAGE[code]) return MESSAGE[code];
  }
  if (error instanceof PushServiceError) return error.message;
  return MESSAGE.GENERIC;
}

function mapPermission(permission: PushPermissionState): PushLifecycleSnapshot | null {
  if (permission === 'UNAVAILABLE') return snapshot('UNAVAILABLE', MESSAGE.UNAVAILABLE);
  if (permission === 'DENIED') {
    return snapshot(
      'DENIED',
      'A permissão foi recusada. Você pode alterá-la nas configurações do dispositivo.',
    );
  }
  if (permission === 'NOT_REQUESTED') return snapshot('NOT_REQUESTED');
  return null;
}

async function removePendingAfterAck(pending: PushPendingRevocation): Promise<boolean> {
  await revokePushInstallation(pending);
  const removed = await clearPendingRevocation(pending, 204);
  await clearCurrentBindingIfMatches({
    bindingId: pending.bindingId,
    lifecycleVersion: pending.lifecycleVersion,
  });
  return removed;
}

export async function flushPendingPushRevocation(): Promise<boolean> {
  const pending = await readPendingRevocation();
  if (!pending) return true;
  try {
    return await removePendingAfterAck(pending);
  } catch {
    return false;
  }
}

export async function getPushLifecycleSnapshot(
  expectedGeneration?: number,
): Promise<PushLifecycleSnapshot> {
  const config = getPushRuntimeConfig();
  if (!config.available) return snapshot('UNAVAILABLE', unavailableMessage(config));

  try {
    const optedIn = await getPushOptIn();
    const pending = await readPendingRevocation();
    if (pending) return snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP);
    const permission = await readPushPermission();
    const permissionSnapshot = mapPermission(permission);
    if (permissionSnapshot) return permissionSnapshot;
    if (!optedIn || optOutInMemory) return snapshot('AUTHORIZED_APP_DISABLED');

    if (expectedGeneration !== undefined) assertSessionGeneration(expectedGeneration);
    const state = await getPushInstallationState(
      expectedGeneration === undefined ? {} : { sessionGeneration: expectedGeneration },
    );
    if (!state.available) return snapshot('UNAVAILABLE', MESSAGE.CONFIGURATION_UNAVAILABLE);
    if (state.state === 'ACTIVE') {
      return snapshot('ACTIVE', null, state.testAvailableAt);
    }
    if (state.state === 'RESERVED') {
      return snapshot('ERROR', 'A ativação não foi concluída. Tente ativar novamente.');
    }
    return snapshot('ERROR', 'O vínculo não está ativo. Tente ativar novamente.');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'PushStorageRecoveryError'
    ) {
      return snapshot('RECOVERY', MESSAGE.RECOVERY);
    }
    return snapshot('ERROR', safeMessage(error));
  }
}

async function registerWithGrantedPermission(
  config: PushRuntimeConfig,
  generation: number,
  intentGeneration: number,
): Promise<PushLifecycleSnapshot> {
  if (!config.available || !config.platform) {
    return snapshot('UNAVAILABLE', unavailableMessage(config));
  }
  assertCurrentIntent(generation, intentGeneration);

  const permission = await readPushPermission();
  const permissionSnapshot = mapPermission(permission);
  if (permission === 'DENIED') {
    return revokeForPermissionLoss(generation, intentGeneration);
  }
  if (permissionSnapshot) return permissionSnapshot;
  if (!grantedStates.has(permission)) return snapshot('DENIED');

  const pending = await readPendingRevocation();
  if (pending && !(await removePendingAfterAck(pending))) {
    return snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP);
  }

  const identity = await getOrCreatePushIdentity();
  assertCurrentIntent(generation, intentGeneration);
  const expoToken = await getExpoPushToken();
  assertCurrentIntent(generation, intentGeneration);
  const binding = await reservePushInstallation({ sessionGeneration: generation });
  assertCurrentIntent(generation, intentGeneration);

  const currentBinding: PushCurrentBinding = {
    bindingId: binding.bindingId,
    lifecycleVersion: binding.lifecycleVersion,
  };
  try {
    await saveCurrentBinding(currentBinding);
  } catch {
    const revoke: PushPendingRevocation = {
      ...identity,
      ...currentBinding,
      reason: 'PERMISSION_REVOKED',
    };
    try {
      await savePendingRevocation(revoke);
      await removePendingAfterAck(revoke);
    } catch {
      // A failed private-store write cannot make this reservation eligible.
    }
    return snapshot('RECOVERY', MESSAGE.RECOVERY);
  }

  assertCurrentIntent(generation, intentGeneration);
  try {
    await activateWithCurrentRevision(
      currentBinding,
      config.platform,
      expoToken,
      binding.tokenRevision,
      generation,
      intentGeneration,
    );
    assertCurrentIntent(generation, intentGeneration);
    return snapshot('ACTIVE');
  } catch (error) {
    if (
      !(error instanceof PushServiceError && error.status === 409) &&
      isSessionGenerationCurrent(generation) &&
      intentGeneration === pushIntentGeneration
    ) {
      try {
        const state = await getPushInstallationState({ sessionGeneration: generation });
        if (
          state.state === 'ACTIVE' &&
          state.binding?.bindingId === currentBinding.bindingId &&
          state.binding.lifecycleVersion === currentBinding.lifecycleVersion
        ) {
          return snapshot('ACTIVE');
        }
      } catch {
        // Preserve an honest error state if the activation outcome is still unknown.
      }
    }
    return snapshot('ERROR', safeMessage(error));
  }
}

function assertCurrentIntent(generation: number, intentGeneration: number): void {
  assertSessionGeneration(generation);
  if (intentGeneration !== pushIntentGeneration) {
    throw new SessionGenerationChangedError();
  }
}

async function activateWithCurrentRevision(
  binding: PushCurrentBinding,
  platform: 'ANDROID' | 'IOS',
  expoToken: string,
  expectedTokenRevision: number,
  generation: number,
  intentGeneration: number,
): Promise<void> {
  try {
    await activatePushRegistration(binding, platform, expoToken, {
      sessionGeneration: generation,
      expectedTokenRevision,
    });
  } catch (error) {
    if (!(error instanceof PushServiceError) || error.status !== 409) throw error;
    assertCurrentIntent(generation, intentGeneration);
    const state = await getPushInstallationState({ sessionGeneration: generation });
    assertCurrentIntent(generation, intentGeneration);
    if (
      state.state !== 'ACTIVE' ||
      state.binding?.bindingId !== binding.bindingId ||
      state.binding.lifecycleVersion !== binding.lifecycleVersion
    ) {
      throw error;
    }
    const currentExpoToken = await getExpoPushToken();
    assertCurrentIntent(generation, intentGeneration);
    await activatePushRegistration(binding, platform, currentExpoToken, {
      sessionGeneration: generation,
      expectedTokenRevision: state.binding.tokenRevision,
    });
  }
}

async function queueBindingRevocation(reason: PushPendingRevocation['reason']): Promise<boolean> {
  const existing = await readPendingRevocation();
  if (existing && !(await removePendingAfterAck(existing))) return false;
  const binding = await readCurrentBinding();
  if (!binding) return true;
  const identity = await getOrCreatePushIdentity();
  const pending: PushPendingRevocation = { ...identity, ...binding, reason };
  await savePendingRevocation(pending);
  await clearCurrentBindingIfMatches(binding);
  try {
    await revokePushInstallation(pending);
  } catch {
    return false;
  }
  const removed = await clearPendingRevocation(pending, 204);
  await clearCurrentBindingIfMatches(binding);
  return removed;
}

async function revokeForPermissionLoss(
  generation: number,
  intentGeneration: number,
): Promise<PushLifecycleSnapshot> {
  optOutInMemory = true;
  const cleanupIntent = ++pushIntentGeneration;
  try {
    await setPushOptIn(false);
    assertCurrentIntent(generation, cleanupIntent);
    const completed = await queueBindingRevocation('PERMISSION_REVOKED');
    if (!completed) return snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP);
    return mapPermission('DENIED') ?? snapshot('DENIED');
  } catch (error) {
    return snapshot(
      error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'PushStorageRecoveryError'
        ? 'RECOVERY'
        : 'PENDING_CLEANUP',
      error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'PushStorageRecoveryError'
        ? MESSAGE.RECOVERY
        : MESSAGE.PENDING_CLEANUP,
    );
  }
}

async function runActivation(
  explicitIntent: boolean,
  expectedGeneration?: number,
): Promise<PushLifecycleSnapshot> {
  const requestedGeneration = expectedGeneration ?? getSessionGeneration();
  if (activationFlight) {
    if (
      activationFlightGeneration === requestedGeneration &&
      activationFlightIntent === pushIntentGeneration
    ) {
      return activationFlight;
    }
    const preceding = activationFlight;
    return preceding
      .catch(() => snapshot('ERROR', MESSAGE.GENERIC))
      .then(() => runActivation(explicitIntent, requestedGeneration));
  }
  if (explicitIntent) optOutInMemory = false;
  const intentGeneration = explicitIntent ? ++pushIntentGeneration : pushIntentGeneration;
  activationFlightGeneration = requestedGeneration;
  activationFlightIntent = intentGeneration;
  const operation = (async () => {
    const generation = requestedGeneration;
    const config = getPushRuntimeConfig();
    if (!config.available) return snapshot('UNAVAILABLE', unavailableMessage(config));

    try {
      if (explicitIntent) {
        await setPushOptIn(true);
        optOutInMemory = false;
      } else if (!(await getPushOptIn()) || optOutInMemory) {
        return await getPushLifecycleSnapshot(generation);
      }
      assertCurrentIntent(generation, intentGeneration);

      const permission = explicitIntent
        ? await requestPushPermission()
        : await readPushPermission();
      const permissionSnapshot = mapPermission(permission);
      if (permission === 'DENIED') {
        return revokeForPermissionLoss(generation, intentGeneration);
      }
      if (permissionSnapshot) return permissionSnapshot;
      if (!grantedStates.has(permission)) return snapshot('DENIED');
      return await registerWithGrantedPermission(config, generation, intentGeneration);
    } catch (error) {
      return snapshot(
        error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'PushStorageRecoveryError'
          ? 'RECOVERY'
          : 'ERROR',
        safeMessage(error),
      );
    }
  })();
  activationFlight = operation
    .then((result) => publishLifecycle(result, requestedGeneration))
    .finally(() => {
      activationFlight = null;
      activationFlightGeneration = null;
      activationFlightIntent = null;
    });
  return activationFlight;
}

export function enablePushNotifications(): Promise<PushLifecycleSnapshot> {
  return runActivation(true);
}

export function reconcilePushNotifications(
  expectedGeneration?: number,
): Promise<PushLifecycleSnapshot> {
  return (async () => {
    const generation = expectedGeneration ?? getSessionGeneration();
    if (!isSessionGenerationCurrent(generation)) return snapshot('ERROR', MESSAGE.GENERIC);
    if (!(await flushPendingPushRevocation())) {
      return publishLifecycle(snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP), generation);
    }
    if (!isSessionGenerationCurrent(generation)) return snapshot('ERROR', MESSAGE.GENERIC);
    return runActivation(false, generation);
  })();
}

export function sendPushTestNotification(
  expectedGeneration?: number,
): Promise<PushTestLifecycleResult> {
  const generation = expectedGeneration ?? getSessionGeneration();
  if (testFlight) {
    if (testFlightSessionGeneration === generation) return testFlight;
    return Promise.resolve({
      state: 'FAILED',
      message: MESSAGE.GENERIC,
      nextTestAvailableAt: null,
    });
  }

  const intentGeneration = pushIntentGeneration;
  const operation = (async (): Promise<PushTestLifecycleResult> => {
    let knownAvailability: string | null = null;
    try {
      if (!isSessionGenerationCurrent(generation)) {
        throw new SessionGenerationChangedError();
      }
      const config = getPushRuntimeConfig();
      if (!config.available) {
        return {
          state: 'FAILED',
          message: unavailableMessage(config),
          nextTestAvailableAt: null,
        };
      }
      const pending = await readPendingRevocation();
      assertCurrentIntent(generation, intentGeneration);
      if (pending) {
        return {
          state: 'FAILED',
          message: MESSAGE.PENDING_CLEANUP,
          nextTestAvailableAt: null,
        };
      }
      const optedIn = await getPushOptIn();
      assertCurrentIntent(generation, intentGeneration);
      if (!optedIn || optOutInMemory) {
        return {
          state: 'FAILED',
          message: 'Ative as notificações neste dispositivo antes de enviar um teste.',
          nextTestAvailableAt: null,
        };
      }
      const localBinding = await readCurrentBinding();
      assertCurrentIntent(generation, intentGeneration);
      if (!localBinding) {
        return {
          state: 'FAILED',
          message: 'Ative as notificações neste dispositivo antes de enviar um teste.',
          nextTestAvailableAt: null,
        };
      }
      const permission = await readPushPermission();
      assertCurrentIntent(generation, intentGeneration);
      if (!grantedStates.has(permission)) {
        const permissionState = mapPermission(permission);
        return {
          state: 'FAILED',
          message:
            permissionState?.message ??
            'Permita notificações nas configurações do dispositivo antes de enviar um teste.',
          nextTestAvailableAt: null,
        };
      }
      const serverState = await getPushInstallationState({
        sessionGeneration: generation,
      });
      assertCurrentIntent(generation, intentGeneration);
      knownAvailability = serverState.testAvailableAt;
      if (!serverState.available) {
        return {
          state: 'FAILED',
          message: MESSAGE.CONFIGURATION_UNAVAILABLE,
          nextTestAvailableAt: knownAvailability,
        };
      }
      if (
        serverState.state !== 'ACTIVE' ||
        serverState.binding?.bindingId !== localBinding.bindingId ||
        serverState.binding.lifecycleVersion !== localBinding.lifecycleVersion
      ) {
        return {
          state: 'FAILED',
          message: 'O vínculo deste dispositivo não está ativo. Atualize as notificações.',
          nextTestAvailableAt: knownAvailability,
        };
      }
      if (knownAvailability && Date.parse(knownAvailability) > Date.now()) {
        return {
          state: 'COOLDOWN',
          message: 'Aguarde o prazo indicado antes de enviar outro teste.',
          nextTestAvailableAt: knownAvailability,
        };
      }

      assertCurrentIntent(generation, intentGeneration);
      const accepted = await sendPushTest({ sessionGeneration: generation });
      assertCurrentIntent(generation, intentGeneration);
      rememberPushTestAttempt(accepted.attemptId);
      return {
        state: 'ACCEPTED',
        message: 'Solicitação aceita para envio. O recebimento depende do dispositivo.',
        nextTestAvailableAt: accepted.nextTestAvailableAt,
      };
    } catch (error) {
      if (!isSessionGenerationCurrent(generation)) {
        return {
          state: 'FAILED',
          message: MESSAGE.GENERIC,
          nextTestAvailableAt: knownAvailability,
        };
      }
      if (error instanceof PushServiceError && error.status === 429) {
        try {
          const latest = await getPushInstallationState({
            sessionGeneration: generation,
          });
          knownAvailability = latest.testAvailableAt;
        } catch {
          // Keep the last server value; never retry the send after a rate limit.
        }
      } else if (error instanceof PushServiceError && error.status === 503) {
        try {
          const latest = await getPushInstallationState({
            sessionGeneration: generation,
          });
          knownAvailability = latest.testAvailableAt;
        } catch {
          // The timeout remains indeterminate and is never resent automatically.
        }
      }
      return {
        state: 'FAILED',
        message: safeMessage(error),
        nextTestAvailableAt: knownAvailability,
      };
    }
  })();

  testFlightSessionGeneration = generation;
  testFlight = operation.finally(() => {
    testFlight = null;
    testFlightSessionGeneration = null;
  });
  return testFlight;
}

export async function disablePushNotifications(): Promise<PushLifecycleSnapshot> {
  const generation = getSessionGeneration();
  optOutInMemory = true;
  ++pushIntentGeneration;
  try {
    await setPushOptIn(false);
    const pending = await readPendingRevocation();
    if (pending) {
      if (!(await removePendingAfterAck(pending))) {
        return publishLifecycle(snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP), generation);
      }
    }
    const binding = await readCurrentBinding();
    if (!binding) {
      const permission = await readPushPermission();
      return publishLifecycle(
        permission === 'GRANTED' || permission === 'PROVISIONAL' || permission === 'EPHEMERAL'
          ? snapshot('AUTHORIZED_APP_DISABLED')
          : snapshot('NOT_REQUESTED'),
        generation,
      );
    }
    const complete = await queueBindingRevocation('USER_DISABLED');
    return publishLifecycle(
      complete
        ? snapshot('AUTHORIZED_APP_DISABLED')
        : snapshot('PENDING_CLEANUP', MESSAGE.PENDING_CLEANUP),
      generation,
    );
  } catch {
    return publishLifecycle(snapshot('RECOVERY', MESSAGE.RECOVERY), generation);
  }
}

export async function preparePushLogout(): Promise<PushPendingRevocation | null> {
  optOutInMemory = true;
  ++pushIntentGeneration;
  let pending: PushPendingRevocation | null = null;
  try {
    await setPushOptIn(false);
  } catch {
    // Continue with a capability-only best-effort cleanup after auth is invalidated.
  }
  try {
    const existing = await readPendingRevocation();
    const binding = await readCurrentBinding();
    if (existing && (!binding || existing.lifecycleVersion >= binding.lifecycleVersion)) {
      pending = existing;
      if (binding) await clearCurrentBindingIfMatches(binding);
      return pending;
    }
    if (!binding) return existing;
    const identity = await getOrCreatePushIdentity();
    pending = { ...identity, ...binding, reason: 'LOGOUT' };
    try {
      await savePendingRevocation(pending);
      pending = (await readPendingRevocation()) ?? pending;
    } finally {
      await clearCurrentBindingIfMatches(binding).catch(() => false);
    }
    return pending;
  } catch {
    return pending;
  }
}

export async function completePushLogoutCleanup(
  pending: PushPendingRevocation | null,
): Promise<void> {
  if (!pending) return;
  try {
    await removePendingAfterAck(pending);
  } catch {
    // The pending capability-only revocation remains available for the next session.
  }
}
