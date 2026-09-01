import { AxiosError } from 'axios';
import { getHttpErrorMessage } from '@/lib';

describe('HTTP error messages', () => {
  it.each([
    [400, 'Confira os dados informados.'],
    [401, 'Sua sessão expirou. Entre novamente.'],
    [403, 'Você não tem permissão para realizar esta ação.'],
    [404, 'O conteúdo solicitado não foi encontrado.'],
    [409, 'Este e-mail já está em uso.'],
  ])('maps %s to Portuguese feedback', (status, message) => {
    const error = new AxiosError('request failed', undefined, undefined, undefined, {
      status,
      data: {},
      headers: {},
      config: {} as never,
      statusText: '',
    });
    expect(getHttpErrorMessage(error)).toBe(message);
  });
});
