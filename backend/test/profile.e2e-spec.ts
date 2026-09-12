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
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix } },
    });
  };

  const registerParent = async (label: string) => {
    const email = makeEmail(label);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `profile-e2e-register-${label}`)
      .send({ name: 'Perfil de Teste', email, password })
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

  it('keeps the initiating session active while revoking the other device after normalized email change', async () => {
    const first = await registerParent('device-a');
    const secondResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', 'profile-e2e-login-device-b')
      .send({ email: ` ${first.email.toUpperCase()} `, password })
      .expect(200);
    const second = secondResponse.body as AuthResponse;
    const newEmail = makeEmail('device-a-updated').toUpperCase();

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
        role: Role.PARENT,
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', 'profile-e2e-refresh-device-a')
      .send({ refreshToken: first.refresh_token })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${second.access_token}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', 'profile-e2e-refresh-device-b')
      .send({ refreshToken: second.refresh_token })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', 'profile-e2e-login-new-email')
      .send({ email: ` ${newEmail} `, password })
      .expect(200);
  });

  it('rejects password, role, id and unknown fields through the production-like validation boundary', async () => {
    const user = await registerParent('forbidden-fields');

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
  });
});
