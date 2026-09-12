import { AxiosError, isAxiosError } from 'axios';

const FALLBACK_MESSAGE = 'Não foi possível concluir. Verifique sua conexão e tente novamente.';

export function getHttpErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return FALLBACK_MESSAGE;

  const status = error.response?.status;
  if (status === 400) return 'Confira os dados informados.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para realizar esta ação.';
  if (status === 404) return 'O conteúdo solicitado não foi encontrado.';
  if (status === 409) return 'Este e-mail já está em uso.';
  return FALLBACK_MESSAGE;
}

export function isUnauthorizedError(error: unknown): error is AxiosError {
  return isAxiosError(error) && error.response?.status === 401;
}
