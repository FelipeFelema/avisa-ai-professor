import { api, authApi } from '@/lib';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/types/auth';

interface AuthApiResponse {
  access_token: string;
  refresh_token: string;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await authApi.post<AuthApiResponse>('/auth/login', data);

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}

export async function getProfile(): Promise<AuthUser> {
  const response = await api.get<AuthUser>('/users/profile');

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
