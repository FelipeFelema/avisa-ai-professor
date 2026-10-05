import { isAxiosError } from 'axios';
import { api } from '@/lib';
import {
  assertSessionGeneration,
  getSessionGeneration,
  isSessionGenerationChangedError,
  type PrivateRequestOptions,
} from '@/lib/session-generation';
import type { TeacherInviteResult } from '@/types/teacher-invite';
import { parseTeacherInviteResponse } from '@/validations/teacherInvite.schema';

export type TeacherInviteErrorFeedback = Readonly<{
  status?: number;
  message: string;
  category: 'invalid' | 'unauthorized' | 'forbidden' | 'unavailable' | 'uncertain';
  uncertain?: boolean;
}>;

export class TeacherInviteError extends Error implements TeacherInviteErrorFeedback {
  readonly status?: number;
  readonly category: TeacherInviteErrorFeedback['category'];
  readonly uncertain?: boolean;

  constructor(feedback: TeacherInviteErrorFeedback) {
    super(feedback.message);
    this.name = 'TeacherInviteError';
    this.status = feedback.status;
    this.category = feedback.category;
    this.uncertain = feedback.uncertain;
  }
}

const messages = {
  invalid: 'Não foi possível validar a resposta. Tente gerar outro convite.',
  unauthorized: 'Entre novamente para continuar.',
  forbidden: 'Seu perfil não tem autorização para gerar convites.',
  unavailable: 'Não foi possível gerar o convite. Tente novamente mais tarde.',
  uncertain:
    'Não foi possível confirmar se o convite foi criado. Nenhuma repetição automática foi feita.',
} as const;

function safeError(error: unknown): TeacherInviteError {
  if (isSessionGenerationChangedError(error)) throw error;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401)
    return new TeacherInviteError({
      status,
      category: 'unauthorized',
      message: messages.unauthorized,
    });
  if (status === 403)
    return new TeacherInviteError({ status, category: 'forbidden', message: messages.forbidden });
  if (status === 400)
    return new TeacherInviteError({
      status,
      category: 'invalid',
      message: 'Não foi possível gerar o convite. Confira sua sessão e tente novamente.',
    });
  if (status && status >= 500)
    return new TeacherInviteError({
      status,
      category: 'uncertain',
      uncertain: true,
      message: messages.uncertain,
    });
  if (isAxiosError(error) && error.response)
    return new TeacherInviteError({
      status,
      category: 'unavailable',
      message: messages.unavailable,
    });
  return new TeacherInviteError({
    category: 'uncertain',
    uncertain: true,
    message: messages.uncertain,
  });
}

export function getTeacherInviteFeedback(error: unknown): TeacherInviteErrorFeedback {
  if (error instanceof TeacherInviteError) {
    return {
      status: error.status,
      category: error.category,
      uncertain: error.uncertain,
      message: messages[error.category],
    };
  }
  return { category: 'uncertain', uncertain: true, message: messages.uncertain };
}

export async function createTeacherInvite(
  options: PrivateRequestOptions = {},
): Promise<TeacherInviteResult> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  try {
    const response = await api.post<unknown>(
      '/invite-codes',
      { role: 'PROFESSOR' },
      {
        ...options,
        sessionGeneration: generation,
        noAuthReplay: true,
      },
    );
    assertSessionGeneration(generation);
    const parsed = parseTeacherInviteResponse(response.data);
    if (!parsed.success)
      throw new TeacherInviteError({
        category: 'uncertain',
        uncertain: true,
        message: messages.uncertain,
      });
    return parsed.data;
  } catch (error) {
    throw safeError(error);
  }
}
