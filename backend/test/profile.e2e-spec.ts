import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app.helper';

type AuthResponse = {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
};

describe('Profile self-service (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testPrefix = `profile-e2e-${Date.now()}`;
  const password = '12345678';

  const makeEmail = (label: string) => `${testPrefix}-${label}@example.com`;

  const deleteTestUsers = async () => {
    await prisma.inviteCode.deleteMany({
      where: { code: { startsWith: `PROFILE-${testPrefix}` } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix } },
    });
  };

  const registerAsRole = async (role: Role, label: string) => {
    const email = makeEmail(label);
    const body: Record<string, string> = {
      name: 'Perfil de Teste',
      email,
      password,
    };
    if (role !== Role.PARENT) {
      const code = `PROFILE-${testPrefix}-${role}-${label}`;
      await prisma.inviteCode.create({
        data: {
          code,
          role,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      body.teacherCode = code;
    }
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `profile-e2e-register-${label}`)
      .send(body)
      .expect(201);

    return response.body as AuthResponse;
  };

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
    const httpServer = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpServer.set('trust proxy', true);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await deleteTestUsers();
  });

  afterAll(async () => {
    await deleteTestUsers();
    await app.close();
  });

  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'keeps the initiating session active while revoking the other device for %s',
    async (role) => {
      const first = await registerAsRole(role, `device-a-${role}`);
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `profile-e2e-login-device-b-${role}`)
        .send({ email: ` ${first.email.toUpperCase()} `, password })
        .expect(200);
      const second = secondResponse.body as AuthResponse;
      const newEmail = makeEmail(`device-a-updated-${role}`).toUpperCase();

      const update = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${first.access_token}`)
        .send({ name: '  Nome Atualizado ', email: ` ${newEmail} ` })
        .expect(200);

      expect(update.body).toEqual(
        expect.objectContaining({
          id: first.id,
          name: 'Nome Atualizado',
          email: newEmail.toLowerCase(),
          role,
        }),
      );

      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${first.access_token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', `profile-e2e-refresh-device-a-${role}`)
        .send({ refreshToken: first.refresh_token })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${second.access_token}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', `profile-e2e-refresh-device-b-${role}`)
        .send({ refreshToken: second.refresh_token })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `profile-e2e-login-new-email-${role}`)
        .send({ email: ` ${newEmail} `, password })
        .expect(200);
    },
  );

  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'rejects password, role, id and unknown fields for %s',
    async (role) => {
      const user = await registerAsRole(role, `forbidden-fields-${role}`);

      for (const forbiddenField of [
        { password: 'new-password' },
        { role: Role.ADMIN },
        { id: 'different-user-id' },
        { displayName: 'unknown' },
      ]) {
        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${user.access_token}`)
          .send(forbiddenField)
          .expect(400);
      }
    },
  );
});
