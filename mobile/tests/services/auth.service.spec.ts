import { AxiosError } from 'axios';

import { api } from '@/lib';
import * as authService from '@/services/auth/auth.service';
import type { AuthUser } from '@/types/auth';

jest.mock('@/lib', () => ({
  api: {
    patch: jest.fn(),
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
    expect(mockedApi.patch).toHaveBeenCalledWith('/users/profile', request);
  });

  it('sends both changed fields and never includes role or unrelated profile data', async () => {
    const request = {
      name: "João D'Ávila-Silva",
      email: 'joao.silva@example.com',
    };
    mockedApi.patch.mockResolvedValue({ data: updatedUser } as never);

    await authService.updateProfile(request);

    expect(mockedApi.patch).toHaveBeenCalledWith('/users/profile', {
      name: request.name,
      email: request.email,
    });
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
    expect(mockedApi.patch).toHaveBeenCalledWith('/users/profile', {
      email: 'joao.silva@example.com',
    });
  });
});
