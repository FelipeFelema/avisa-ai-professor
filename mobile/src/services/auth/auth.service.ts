import { api } from '@/lib';
import type { AuthUser, LoginRequest, LoginResponse } from '@/types/auth';

interface LoginApiResponse {
  access_token: string;
  refresh_token: string;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginApiResponse>('/auth/login', data);

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}

export async function getProfile(): Promise<AuthUser> {
  const response = await api.get<AuthUser>('/users/profile');

  return response.data;
}
