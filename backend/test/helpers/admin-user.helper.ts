import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { App } from 'supertest/types';
import request from 'supertest';
import { hashPassword } from '../../src/common/security/password-hasher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { assertSafeTestDatabase } from './test-database.helper';

type AdminAuthResponse = {
  id: string;
  name: string;
  email: string;
  role: Role;
  access_token: string;
  refresh_token: string;
};

export async function createAdminUserAndLogin(
  app: INestApplication<App>,
  prisma: PrismaService,
  options: { email: string; password: string; name?: string },
) {
  assertSafeTestDatabase();

  const id = randomUUID();
  const passwordHash = await hashPassword(options.password);
  const user = await prisma.user.create({
    data: {
      id,
      name: options.name ?? 'Synthetic ADMIN integration fixture',
      email: options.email.trim().toLowerCase(),
      password: passwordHash,
      role: Role.ADMIN,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: options.email, password: options.password })
    .expect(200);
  const body = response.body as AdminAuthResponse;

  return {
    user,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}
