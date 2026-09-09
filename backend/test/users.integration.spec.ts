import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type AuthResponse = {
  id: string;
  access_token: string;
  refresh_token: string;
  role?: string;
};

describe('Users Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `users-integration-${Date.now()}`;
  const testPassword = '12345678';

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
    const email = makeEmail(`${role.toLowerCase()}-${label}`);
    const body: Record<string, string> = {
      name: 'Perfil Original',
      email,
      password: testPassword,
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
      .set('X-Forwarded-For', `profile-${role}-${label}`)
      .send(body)
      .expect(201);

    return {
      email,
      auth: response.body as AuthResponse,
    };
  };

  const tokenSid = (token: string) => {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    ) as { sid: string };
    return payload.sid;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    const httpServer = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpServer.set('trust proxy', true);

    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await deleteTestUsers();
  });

  afterAll(async () => {
    await deleteTestUsers();
    await app.close();
  });

  describe('GET /api/v1/users/profile', () => {
    it('should get user profile with valid token', async () => {
      const email = makeEmail('profile');

      // Register a new user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      // Access the profile endpoint with the token
      const profileResponse = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('id');
      expect((profileResponse.body as Record<string, unknown>).email).toBe(
        email,
      );
      expect((profileResponse.body as Record<string, unknown>).name).toBe(
        'Test User',
      );
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/users/profile', () => {
    it('should update user profile successfully', async () => {
      const email = makeEmail('update');

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Original Name',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      const updateResponse = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect((updateResponse.body as Record<string, unknown>).name).toBe(
        'Updated Name',
      );
    });

    it('should not allow empty name', async () => {
      const email = makeEmail('empty-name');

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'updates name and email with canonical normalization for %s',
      async (role) => {
        const { auth } = await registerAsRole(role, 'normalized');
        const normalizedEmail = makeEmail(
          `normalized-${role.toLowerCase()}-new`,
        );

        const response = await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send({
            name: '  Ana Maria  ',
            email: `  ${normalizedEmail.toUpperCase()}  `,
          })
          .expect(200);

        expect(response.body).toEqual(
          expect.objectContaining({
            name: 'Ana Maria',
            email: normalizedEmail,
            role,
          }),
        );
        expect(response.body).not.toHaveProperty('password');
      },
    );

    it.each([
      ['password', { password: 'new-password' }],
      ['role', { role: Role.ADMIN }],
      ['id', { id: 'another-user-id' }],
      ['unknown', { nickname: 'not-allowed' }],
    ])(
      'rejects forbidden profile field: %s',
      async (_field, forbiddenField) => {
        const { auth } = await registerAsRole(Role.PARENT, 'forbidden');

        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send(forbiddenField)
          .expect(400);
      },
    );

    it('returns a normalized no-op without changing updatedAt or sessions', async () => {
      const { auth } = await registerAsRole(Role.PARENT, 'noop');
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: auth.id },
        select: { email: true, name: true, updatedAt: true },
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({
          name: `  ${before.name} `,
          email: ` ${before.email.toUpperCase()} `,
        })
        .expect(200);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: auth.id },
        select: { email: true, name: true, updatedAt: true },
      });
      expect(response.body).toEqual(
        expect.objectContaining({
          email: before.email,
          name: before.name,
          updatedAt: before.updatedAt.toISOString(),
        }),
      );
      expect(after).toEqual(before);
      expect(
        await prisma.authSession.count({ where: { userId: auth.id } }),
      ).toBe(1);
    });

    it('returns 409 for a duplicate normalized email and leaves the profile unchanged', async () => {
      const target = await registerAsRole(Role.PARENT, 'duplicate-target');
      const duplicate = await registerAsRole(Role.PARENT, 'duplicate-source');

      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${target.auth.access_token}`)
        .send({ email: ` ${duplicate.email.toUpperCase()} ` })
        .expect(409);

      await expect(
        prisma.user.findUniqueOrThrow({
          where: { id: target.auth.id },
          select: { email: true },
        }),
      ).resolves.toEqual({ email: target.email });
    });

    it('keeps the current session and revokes the other access and refresh pair after an email change', async () => {
      const first = await registerAsRole(Role.PARENT, 'session-a');
      const secondLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `profile-session-b-${testPrefix}`)
        .send({ email: first.email, password: testPassword })
        .expect(200);
      const second = secondLogin.body as AuthResponse;
      const firstSid = tokenSid(first.auth.access_token);
      const secondSid = tokenSid(second.access_token);
      const newEmail = makeEmail('session-a-updated').toUpperCase();

      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${first.auth.access_token}`)
        .send({ email: ` ${newEmail} ` })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${first.auth.access_token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', `profile-session-a-refresh-${testPrefix}`)
        .send({ refreshToken: first.auth.refresh_token })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${second.access_token}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', `profile-session-b-refresh-${testPrefix}`)
        .send({ refreshToken: second.refresh_token })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `profile-old-login-${testPrefix}`)
        .send({ email: first.email, password: testPassword })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `profile-new-login-${testPrefix}`)
        .send({ email: ` ${newEmail} `, password: testPassword })
        .expect(200);

      const sessions = await prisma.authSession.findMany({
        where: { userId: first.auth.id },
        select: { id: true, revokedAt: true },
      });
      expect(
        sessions.find((session) => session.id === firstSid)?.revokedAt,
      ).toBeNull();
      expect(
        sessions.find((session) => session.id === secondSid)?.revokedAt,
      ).not.toBeNull();
    });

    it('rolls back the email update and session revocation when the transaction aborts', async () => {
      const { auth, email } = await registerAsRole(Role.PARENT, 'atomicity');
      const transactionSpy = jest
        .spyOn(prisma, '$transaction')
        .mockRejectedValueOnce(
          new Error('simulated profile transaction failure'),
        );

      try {
        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send({ email: makeEmail('atomicity-updated') })
          .expect(500);

        await expect(
          prisma.user.findUniqueOrThrow({
            where: { id: auth.id },
            select: { email: true },
          }),
        ).resolves.toEqual({ email });
        await expect(
          prisma.authSession.findMany({
            where: { userId: auth.id },
            select: { revokedAt: true },
          }),
        ).resolves.toEqual([{ revokedAt: null }]);
      } finally {
        transactionSpy.mockRestore();
      }
    });
  });
});
