import { AxiosError } from 'axios';

import { api } from '@/lib';
import * as authService from '@/services/auth/auth.service';
import type { AuthUser } from '@/types/auth';

jest.mock('@/lib', () => ({
  api: {
    patch: jest.fn(),
    post: jest.fn(),
  },
  authApi: {
    post: jest.fn(),
  },
}));

const mockedApi = jest.mocked(api);

describe('auth service profile update', () => {
  const updatedUser: AuthUser = {
    id: 'user-1',
    name: "João D'Ávila-Silva",
    email: 'joao.silva@example.com',
    role: 'PARENT',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls PATCH /users/profile with a changed-only name payload and returns AuthUser', async () => {
    const request = { name: "João D'Ávila-Silva" };
    mockedApi.patch.mockResolvedValue({ data: updatedUser } as never);

    await expect(authService.updateProfile(request)).resolves.toEqual(updatedUser);

    expect(mockedApi.patch).toHaveBeenCalledTimes(1);
    expect(mockedApi.patch).toHaveBeenCalledWith('/users/profile', request, {
      sessionGeneration: expect.any(Number),
    });
  });

  it('sends both changed fields and never includes role or unrelated profile data', async () => {
    const request = {
      name: "João D'Ávila-Silva",
      email: 'joao.silva@example.com',
    };
    mockedApi.patch.mockResolvedValue({ data: updatedUser } as never);

    await authService.updateProfile(request);

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/users/profile',
      { name: request.name, email: request.email },
      { sessionGeneration: expect.any(Number) },
    );
    expect(mockedApi.patch.mock.calls[0][1]).not.toHaveProperty('role');
  });

  it('propagates an HTTP 409 so the caller can attach the conflict to the email field', async () => {
    const conflict = new AxiosError('request failed', undefined, undefined, undefined, {
      status: 409,
      data: { message: 'Email já está em uso' },
      headers: {},
      config: {} as never,
      statusText: 'Conflict',
    });
    mockedApi.patch.mockRejectedValue(conflict);

    await expect(authService.updateProfile({ email: 'joao.silva@example.com' })).rejects.toBe(
      conflict,
    );

    expect(conflict.response?.status).toBe(409);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/users/profile',
      { email: 'joao.silva@example.com' },
      { sessionGeneration: expect.any(Number) },
    );
  });
});

describe('transient password service', () => {
  const body = {
    currentPassword: 'Synthetic old password',
    newPassword: 'Synthetic new password',
    confirmNewPassword: 'Synthetic new password',
  };
  beforeEach(() => jest.clearAllMocks());
  it('posts the exact three unchanged strings and returns void without retries', async () => {
    mockedApi.post.mockResolvedValue({ data: undefined });
    expect(await authService.changePassword(body)).toBeUndefined();
    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [path, data, config] = mockedApi.post.mock.calls[0];
    expect(path).toBe('/auth/change-password');
    expect(JSON.stringify(data) === JSON.stringify(body)).toBe(true);
    expect(config).toEqual({ sessionGeneration: expect.any(Number) });
  });
  it.each([
    [400, 'CURRENT_PASSWORD_INVALID', 'currentPassword'],
    [400, 'PASSWORD_UNCHANGED', 'newPassword'],
    [400, 'PASSWORD_CONFIRMATION_MISMATCH', 'confirmNewPassword'],
    [409, 'CREDENTIAL_CHANGED', undefined],
    [401, 'untrusted', undefined],
    [429, 'untrusted', undefined],
    [500, 'untrusted', undefined],
    [undefined, 'untrusted', undefined],
  ])(
    'sanitizes %s without retaining raw errors/config/body/cause',
    async (status, message, field) => {
      const raw = Object.assign(new Error(body.currentPassword), {
        isAxiosError: true,
        config: { data: body },
        response: status ? { status, data: { message, password: body.newPassword } } : undefined,
      });
      mockedApi.post.mockRejectedValue(raw);
      let caught: unknown;
      try {
        await authService.changePassword(body);
      } catch (error) {
        caught = error;
      }
      expect(caught instanceof authService.ChangePasswordError).toBe(true);
      const safe = caught as authService.ChangePasswordError;
      expect(safe.field).toBe(field);
      expect(safe.status).toBe(status);
      expect(['config', 'response', 'cause', 'request'].some((key) => key in safe)).toBe(false);
      expect(
        !JSON.stringify(safe).includes(body.currentPassword) &&
          !JSON.stringify(safe).includes(body.newPassword) &&
          !safe.message.includes('untrusted'),
      ).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledTimes(1);
    },
  );
});
