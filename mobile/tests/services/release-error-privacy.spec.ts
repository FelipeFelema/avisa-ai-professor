import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getHttpErrorMessage } from '@/lib/http-error';
import { getChangePasswordFeedback, changePassword } from '@/services/auth';
import { api } from '@/lib';

jest.mock('@/lib', () => ({ api: { post: jest.fn() }, authApi: { post: jest.fn() } }));

describe('Release mobile error privacy', () => {
  const marker = 'SYNTHETIC_PRIVATE_PASSWORD_SQL';
  function fault(status: number) {
    const config = {
      headers: new AxiosHeaders({ Authorization: `Bearer ${marker}` }),
      data: { currentPassword: marker },
    } as unknown as InternalAxiosRequestConfig;
    const error = new AxiosError(marker, undefined, config);
    error.response = {
      status,
      statusText: marker,
      headers: {},
      config,
      data: { message: marker, stack: marker },
    };
    return error;
  }
  afterEach(() => jest.clearAllMocks());
  it.each([400, 401, 403, 404, 409, 429, 500, 503])(
    'never displays remote internals through generic HTTP feedback (%i)',
    (status) => {
      expect(getHttpErrorMessage(fault(status))).not.toContain(marker);
    },
  );
  it.each([400, 401, 409, 429, 500, 503])(
    'strips password request/response/cause from service errors (%i)',
    async (status) => {
      jest.mocked(api.post).mockRejectedValueOnce(fault(status));
      let caught: unknown;
      try {
        await changePassword({
          currentPassword: marker,
          newPassword: marker,
          confirmNewPassword: marker,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(JSON.stringify(caught)).not.toContain(marker);
      expect(getChangePasswordFeedback(caught).message).not.toContain(marker);
      expect(caught).not.toHaveProperty('config');
      expect(caught).not.toHaveProperty('cause');
      expect(caught).not.toHaveProperty('response');
    },
  );
});
