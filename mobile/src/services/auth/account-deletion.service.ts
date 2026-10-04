import { isAxiosError } from 'axios';

import { api } from '@/lib';
import {
  assertSessionGeneration,
  getSessionGeneration,
  isSessionGenerationChangedError,
} from '@/lib/session-generation';
import type {
  AccountDeletionFeedback,
  AccountDeletionImpact,
  DeleteAccountRequest,
} from '@/types/auth';
import { accountDeletionImpactSchema } from '@/validations/deleteAccount.schema';

const fallback = 'Não foi possível consultar o impacto. Tente novamente.';
const indeterminateMessage =
  'O resultado ainda não foi confirmado. Verifique sua sessão; não repita a exclusão automaticamente.';

export type AccountDeletionSessionVerification = 'valid' | 'invalid' | 'indeterminate';

export class AccountDeletionError extends Error implements AccountDeletionFeedback {
  readonly status?: number;
  readonly field?: keyof DeleteAccountRequest;
  readonly indeterminate?: boolean;

  constructor(feedback: AccountDeletionFeedback) {
    super(feedback.message);
    this.name = 'AccountDeletionError';
    this.status = feedback.status;
    this.field = feedback.field;
    this.indeterminate = feedback.indeterminate;
  }
}

export function getAccountDeletionFeedback(error: unknown): AccountDeletionFeedback {
  if (error instanceof AccountDeletionError) {
    const feedback: AccountDeletionFeedback = { message: error.message };
    if (error.status !== undefined) feedback.status = error.status;
    if (error.field !== undefined) feedback.field = error.field;
    if (error.indeterminate !== undefined) feedback.indeterminate = error.indeterminate;
    return feedback;
  }
  return { message: fallback };
}

function responseMessages(error: unknown): unknown[] {
  if (!isAxiosError(error)) return [];
  const data: unknown = error.response?.data;
  if (!data || typeof data !== 'object' || !('message' in data)) return [];
  const message = data.message;
  return Array.isArray(message) ? message : [message];
}

function deletionFeedback(error: unknown): AccountDeletionFeedback {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const messages = responseMessages(error);

  if (status === 400) {
    if (messages.includes('CURRENT_PASSWORD_INVALID')) {
      return { status, field: 'currentPassword', message: 'A senha atual está incorreta.' };
    }
    if (messages.includes('ACCOUNT_DELETION_CONFIRMATION_MISMATCH')) {
      return {
        status,
        field: 'confirmationPhrase',
        message: 'Digite exatamente EXCLUIR MINHA CONTA.',
      };
    }
    return { status, message: 'Confira os campos e confirme novamente.' };
  }
  if (status === 401) {
    return { status, message: 'A sessão precisa ser verificada antes de continuar.' };
  }
  if (status === 409 && messages.includes('LAST_ADMIN_REQUIRED')) {
    return {
      status,
      message: 'A exclusão está bloqueada para preservar o acesso da última conta ADMIN.',
    };
  }
  if (status === 409 && messages.includes('CREDENTIAL_CHANGED')) {
    return {
      status,
      message: 'Sua credencial mudou. Consulte o resumo e informe a senha atual novamente.',
    };
  }
  if (status === 429) {
    return {
      status,
      indeterminate: true,
      message: 'O limite de tentativas foi atingido. Verifique a sessão antes de continuar.',
    };
  }
  if (status !== undefined && status >= 500) {
    return { status, indeterminate: true, message: indeterminateMessage };
  }
  return { status, indeterminate: true, message: indeterminateMessage };
}

export async function getAccountDeletionImpact(
  signal?: AbortSignal,
  sessionGeneration = getSessionGeneration(),
): Promise<AccountDeletionImpact> {
  try {
    const response = await api.get<unknown>('/users/account-deletion', {
      signal,
      sessionGeneration,
      headers: { 'Cache-Control': 'no-store' },
    });
    assertSessionGeneration(sessionGeneration);
    const result = accountDeletionImpactSchema.safeParse(response.data);
    if (!result.success) throw new AccountDeletionError({ message: fallback });
    return result.data;
  } catch (error) {
    if (isSessionGenerationChangedError(error) || error instanceof AccountDeletionError)
      throw error;
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const message =
      isAxiosError(error) && error.code === 'ERR_CANCELED'
        ? 'Consulta cancelada.'
        : status === 401
          ? 'Sua sessão terminou. Entre novamente.'
          : status === 429
            ? 'Muitas consultas. Aguarde um momento e tente novamente.'
            : fallback;
    throw new AccountDeletionError({ status, message });
  }
}

export async function deleteOwnAccount(
  request: DeleteAccountRequest,
  sessionGeneration = getSessionGeneration(),
): Promise<void> {
  try {
    const response = await api.delete<unknown>('/users/account', {
      data: {
        currentPassword: request.currentPassword,
        confirmationPhrase: request.confirmationPhrase,
      },
      noAuthReplay: true,
      sessionGeneration,
      headers: { 'Cache-Control': 'no-store' },
    });
    assertSessionGeneration(sessionGeneration);
    if (response.status !== 204) {
      throw new AccountDeletionError({ indeterminate: true, message: indeterminateMessage });
    }
  } catch (error) {
    if (isSessionGenerationChangedError(error) || error instanceof AccountDeletionError)
      throw error;
    throw new AccountDeletionError(deletionFeedback(error));
  }
}

export async function verifyAccountDeletionSession(
  sessionGeneration = getSessionGeneration(),
  signal?: AbortSignal,
): Promise<AccountDeletionSessionVerification> {
  try {
    const response = await api.get<unknown>('/users/profile', {
      signal,
      noAuthReplay: true,
      sessionGeneration,
      headers: { 'Cache-Control': 'no-store' },
    });
    assertSessionGeneration(sessionGeneration);
    return response.status >= 200 && response.status < 300 ? 'valid' : 'indeterminate';
  } catch (error) {
    if (isSessionGenerationChangedError(error)) throw error;
    if (isAxiosError(error) && error.response?.status === 401) return 'invalid';
    return 'indeterminate';
  }
}
