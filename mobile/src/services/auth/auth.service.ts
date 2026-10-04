import { api, authApi } from '@/lib';
import { isAxiosError } from 'axios';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
  ChangePasswordFeedback,
} from '@/types/auth';
import {
  assertSessionGeneration,
  getSessionGeneration,
  isSessionGenerationChangedError,
  type PrivateRequestOptions,
} from '@/lib/session-generation';

interface AuthApiResponse {
  access_token: string;
  refresh_token: string;
}

const indeterminateMessage =
  'Não foi possível confirmar o resultado. Verifique sua conexão e tente entrar com a nova senha antes de repetir a troca.';

export class ChangePasswordError extends Error implements ChangePasswordFeedback {
  readonly status?: number;
  readonly field?: keyof ChangePasswordRequest;
  readonly indeterminate?: boolean;

  constructor(feedback: ChangePasswordFeedback) {
    super(feedback.message);
    this.name = 'ChangePasswordError';
    this.status = feedback.status;
    this.field = feedback.field;
    this.indeterminate = feedback.indeterminate;
  }
}

export function getChangePasswordFeedback(error: unknown): ChangePasswordFeedback {
  if (error instanceof ChangePasswordError)
    return {
      status: error.status,
      message: error.message,
      field: error.field,
      indeterminate: error.indeterminate,
    };
  return { message: indeterminateMessage, indeterminate: true };
}

function sanitizePasswordError(error: unknown): ChangePasswordError {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  const message: unknown =
    data && typeof data === 'object' && 'message' in data ? data.message : undefined;
  const messages = Array.isArray(message) ? message : [message];
  const fieldMessages: Record<string, { field: keyof ChangePasswordRequest; message: string }> = {
    CURRENT_PASSWORD_INVALID: {
      field: 'currentPassword',
      message: 'A senha atual está incorreta.',
    },
    PASSWORD_UNCHANGED: {
      field: 'newPassword',
      message: 'A nova senha deve ser diferente da atual.',
    },
    PASSWORD_CONFIRMATION_MISMATCH: {
      field: 'confirmNewPassword',
      message: 'A confirmação deve ser igual à nova senha.',
    },
    'Informe a senha atual.': { field: 'currentPassword', message: 'Informe a senha atual.' },
    'A senha atual deve ser uma string.': {
      field: 'currentPassword',
      message: 'Informe a senha atual.',
    },
    'A nova senha deve ser uma string.': {
      field: 'newPassword',
      message: 'Informe uma nova senha válida.',
    },
    'A nova senha deve ter de 6 a 72 caracteres.': {
      field: 'newPassword',
      message: 'A nova senha deve ter de 6 a 72 caracteres.',
    },
    'Confirme a nova senha.': { field: 'confirmNewPassword', message: 'Confirme a nova senha.' },
    'A confirmação deve ser uma string.': {
      field: 'confirmNewPassword',
      message: 'Confirme a nova senha.',
    },
  };
  if (status === 400) {
    for (const value of messages) {
      if (typeof value === 'string' && Object.hasOwn(fieldMessages, value))
        return new ChangePasswordError({ status, ...fieldMessages[value] });
    }
    return new ChangePasswordError({ status, message: 'Confira os campos e tente novamente.' });
  }
  if (status === 401)
    return new ChangePasswordError({ status, message: 'Entre novamente para alterar sua senha.' });
  if (status === 409 && messages.includes('CREDENTIAL_CHANGED'))
    return new ChangePasswordError({
      status,
      message:
        'Sua credencial mudou durante a solicitação. Revise e informe a senha atual novamente.',
    });
  if (status === 429)
    return new ChangePasswordError({
      status,
      message: 'Muitas tentativas. Aguarde um momento antes de tentar novamente.',
    });
  if (status === 500)
    return new ChangePasswordError({
      status,
      message: 'Não foi possível alterar a senha. Tente novamente mais tarde.',
    });
  return new ChangePasswordError({ status, message: indeterminateMessage, indeterminate: true });
}

export async function changePassword(
  data: ChangePasswordRequest,
  options: PrivateRequestOptions = {},
): Promise<void> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  try {
    await api.post<void>(
      '/auth/change-password',
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmNewPassword: data.confirmNewPassword,
      },
      { ...options, sessionGeneration: generation },
    );
    assertSessionGeneration(generation);
  } catch (error) {
    if (isSessionGenerationChangedError(error)) throw error;
    throw sanitizePasswordError(error);
  }
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await authApi.post<AuthApiResponse>('/auth/login', data);

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}

export async function getProfile(options: PrivateRequestOptions = {}): Promise<AuthUser> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.get<AuthUser>('/users/profile', {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function updateProfile(
  data: UpdateProfileRequest,
  options: PrivateRequestOptions = {},
): Promise<AuthUser> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.patch<AuthUser>('/users/profile', data, {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await authApi.post<AuthApiResponse>('/auth/register', data);

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}

export async function refresh(refreshToken: string): Promise<LoginResponse> {
  const response = await authApi.post<AuthApiResponse>('/auth/refresh', { refreshToken });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}
