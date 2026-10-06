import { create as createAxios, isAxiosError } from 'axios';
import { api } from '@/lib/api';
import {
  assertSessionGeneration,
  getSessionGeneration,
  type PrivateRequestOptions,
} from '@/lib/session-generation';
import { env } from '@/config';
import {
  activatePushSchema,
  pushBindingViewSchema,
  pushInstallationViewSchema,
  pushTestAcceptedSchema,
} from '@/validations/push.schema';
import type {
  PushCurrentBinding,
  PushInstallationIdentity,
  PushInstallationView,
  PushPendingRevocation,
  PushBindingView,
  PushTestAccepted,
} from '@/types/push';
import { getOrCreatePushIdentity } from '@/storage/push.storage';

const SAFE_CODES = new Set([
  'PUSH_INSTALLATION_PROOF_INVALID',
  'PUSH_BINDING_CONFLICT',
  'PUSH_BINDING_INACTIVE',
  'PUSH_REVISION_CONFLICT',
  'PUSH_TOKEN_CONFLICT',
  'PUSH_UNAVAILABLE',
  'PUSH_OPERATION_FAILED',
  'PUSH_INVALID_REQUEST',
  'PUSH_TEST_RATE_LIMITED',
  'PUSH_TEST_IN_PROGRESS',
  'PUSH_TEST_OUTCOME_UNKNOWN',
  'PUSH_PROVIDER_UNAVAILABLE',
]);

const SAFE_MESSAGES: Record<string, string> = {
  PUSH_INSTALLATION_PROOF_INVALID: 'Não foi possível confirmar este dispositivo.',
  PUSH_BINDING_CONFLICT: 'Este dispositivo ainda está associado a outra sessão.',
  PUSH_BINDING_INACTIVE: 'A reserva expirou. Tente ativar novamente.',
  PUSH_REVISION_CONFLICT: 'O registro mudou. Atualize o estado e tente novamente.',
  PUSH_TOKEN_CONFLICT: 'Este token está associado a outro registro protegido.',
  PUSH_UNAVAILABLE: 'A ativação de notificações está indisponível no momento.',
  PUSH_OPERATION_FAILED: 'Não foi possível atualizar as notificações. Tente novamente.',
  PUSH_INVALID_REQUEST: 'Não foi possível validar esta solicitação.',
};

SAFE_MESSAGES.PUSH_TEST_RATE_LIMITED = 'Aguarde o prazo indicado antes de enviar outro teste.';
SAFE_MESSAGES.PUSH_TEST_IN_PROGRESS = 'Um teste já está em andamento neste dispositivo.';
SAFE_MESSAGES.PUSH_TEST_OUTCOME_UNKNOWN =
  'Não foi possível confirmar o resultado do teste. Aguarde o prazo de segurança antes de tentar novamente.';
SAFE_MESSAGES.PUSH_PROVIDER_UNAVAILABLE =
  'O serviço de notificações não aceitou o teste. Tente novamente mais tarde.';

export class PushServiceError extends Error {
  readonly status?: number;

  constructor(message: string, options: { status?: number } = {}) {
    super(message);
    this.name = 'PushServiceError';
    this.status = options.status;
  }
}

type PushActivationOptions = PrivateRequestOptions & {
  expectedTokenRevision?: number;
};

function safeError(error: unknown): PushServiceError {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const body: unknown = isAxiosError(error) ? error.response?.data : undefined;
  const rawMessage =
    body && typeof body === 'object' && 'message' in body ? body.message : undefined;
  const candidates = Array.isArray(rawMessage) ? rawMessage : [rawMessage];
  const code = candidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && SAFE_CODES.has(candidate),
  );
  const message = code ? SAFE_MESSAGES[code] : fallbackForStatus(status);
  return new PushServiceError(message, { status });
}

function fallbackForStatus(status?: number): string {
  if (status === 401) return 'Entre novamente para atualizar as notificações.';
  if (status === 409) return 'O registro mudou. Atualize o estado e tente novamente.';
  if (status === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  if (status === 503) return 'A ativação de notificações está indisponível no momento.';
  return 'Não foi possível concluir a solicitação. Verifique a conexão e tente novamente.';
}

async function identityHeaders(
  generation: number,
): Promise<{ identity: PushInstallationIdentity; headers: Record<string, string> }> {
  const identity = await getOrCreatePushIdentity();
  assertSessionGeneration(generation);
  return {
    identity,
    headers: {
      'X-Push-Installation': identity.installationId,
      'X-Push-Capability': identity.capability,
    },
  };
}

export async function reservePushInstallation(
  options: PrivateRequestOptions = {},
): Promise<PushBindingView> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  try {
    const { headers } = await identityHeaders(generation);
    const response = await api.post<unknown>(
      '/push/installation/reserve',
      {},
      { ...options, sessionGeneration: generation, headers },
    );
    assertSessionGeneration(generation);
    const binding = pushBindingViewSchema.safeParse(response.data);
    if (!binding.success) throw new PushServiceError('A resposta do servidor é inválida.');
    return binding.data;
  } catch (error) {
    if (error instanceof PushServiceError) throw error;
    throw safeError(error);
  }
}

export async function getPushInstallationState(
  options: PrivateRequestOptions = {},
): Promise<PushInstallationView> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  try {
    const { headers } = await identityHeaders(generation);
    const response = await api.get<unknown>('/push/installation', {
      ...options,
      sessionGeneration: generation,
      headers,
    });
    assertSessionGeneration(generation);
    const view = pushInstallationViewSchema.safeParse(response.data);
    if (!view.success) throw new PushServiceError('A resposta do servidor é inválida.');
    return view.data;
  } catch (error) {
    if (error instanceof PushServiceError) throw error;
    throw safeError(error);
  }
}

export async function sendPushTest(options: PrivateRequestOptions = {}): Promise<PushTestAccepted> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  try {
    const { headers } = await identityHeaders(generation);
    const response = await api.post<unknown>(
      '/push/installation/test',
      {},
      {
        ...options,
        sessionGeneration: generation,
        headers,
        noAuthReplay: true,
        retry: false,
      },
    );
    assertSessionGeneration(generation);
    if (response.status !== 202) {
      throw new PushServiceError('A resposta do servidor é inválida.', {
        status: response.status,
      });
    }
    const result = pushTestAcceptedSchema.safeParse(response.data);
    if (!result.success) {
      throw new PushServiceError('A resposta do servidor é inválida.');
    }
    return result.data;
  } catch (error) {
    if (error instanceof PushServiceError) throw error;
    if (!isAxiosError(error) || !error.response) {
      throw new PushServiceError(SAFE_MESSAGES.PUSH_TEST_OUTCOME_UNKNOWN, {
        status: 503,
      });
    }
    throw safeError(error);
  }
}

export async function activatePushRegistration(
  binding: PushCurrentBinding,
  platform: 'ANDROID' | 'IOS',
  expoToken: string,
  options: PushActivationOptions = {},
): Promise<PushBindingView> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const { expectedTokenRevision = 0, ...requestOptions } = options;
  try {
    const { headers } = await identityHeaders(generation);
    const body = activatePushSchema.parse({
      bindingId: binding.bindingId,
      lifecycleVersion: binding.lifecycleVersion,
      expectedTokenRevision,
      platform,
      expoToken,
      permission: 'GRANTED',
    });
    const response = await api.put<unknown>('/push/installation', body, {
      ...requestOptions,
      sessionGeneration: generation,
      headers,
    });
    assertSessionGeneration(generation);
    const result = pushBindingViewSchema.safeParse(response.data);
    if (!result.success) throw new PushServiceError('A resposta do servidor é inválida.');
    return result.data;
  } catch (error) {
    if (error instanceof PushServiceError) throw error;
    throw safeError(error);
  }
}

export const pushRevocationApi = createAxios({
  baseURL: env.apiUrl,
  timeout: 5000,
});

export async function revokePushInstallation(pending: PushPendingRevocation): Promise<void> {
  try {
    const response = await pushRevocationApi.delete('/push/installation', {
      headers: {
        'X-Push-Installation': pending.installationId,
        'X-Push-Capability': pending.capability,
      },
      noAuthReplay: true,
      retry: false,
      data: {
        bindingId: pending.bindingId,
        lifecycleVersion: pending.lifecycleVersion,
        reason: pending.reason,
      },
    });
    if (response.status !== 204) {
      throw new PushServiceError('A desativação ainda não foi confirmada.', {
        status: response.status,
      });
    }
  } catch (error) {
    if (error instanceof PushServiceError) throw error;
    throw safeError(error);
  }
}
