import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';

type CreateUserOptions = {
  name?: string;
  email: string;
  password: string;
};

type AuthResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  access_token: string;
  refresh_token: string;
};

export async function createAuthenticatedUser(
  app: INestApplication<App>,
  options: CreateUserOptions,
) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      name: options.name ?? 'Test User',
      email: options.email,
      password: options.password ?? '12345678',
    });

  const body = response.body as AuthResponse;

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body,
  };
}
