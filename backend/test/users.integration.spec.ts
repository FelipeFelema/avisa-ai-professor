import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { createTestApp } from './helpers/test-app.helper';
import { createTransactionFaultInjector } from './helpers/profile-password.helper';
import { createAdminUserAndLogin } from './helpers/admin-user.helper';

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
    if (role === Role.ADMIN) {
      const provisioned = await createAdminUserAndLogin(app, prisma, {
        email,
        password: testPassword,
        name: 'Perfil Original',
      });
      return {
        email,
        auth: {
          id: provisioned.user.id,
          access_token: provisioned.accessToken,
          refresh_token: provisioned.refreshToken,
          role: Role.ADMIN,
        } satisfies AuthResponse,
      };
    }
    const body: Record<string, string> = {
      name: 'Perfil Original',
      email,
      password: testPassword,
    };

    if (role === Role.PROFESSOR) {
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
    app = (await createTestApp()) as INestApplication<App>;
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

    it('keeps current name and e-mail boundaries and rejects invalid or empty updates', async () => {
      const { auth } = await registerAsRole(Role.PARENT, 'boundaries');
      const domainAtLimit = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`;
      const emailAtLimit = `${`${testPrefix}-boundary`.padEnd(64, 'a')}@${domainAtLimit}`;
      expect(emailAtLimit).toHaveLength(255);

      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ name: 'Ana', email: emailAtLimit })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ name: 'A'.repeat(100) })
        .expect(200);

      for (const invalid of [
        {},
        { name: '   ' },
        { name: 'Jo' },
        { name: 'A'.repeat(101) },
        { name: 'Ana 2' },
        { email: `${'a'.repeat(65)}@${domainAtLimit}` },
      ]) {
        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send(invalid)
          .expect(400);
      }
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
        expect('password' in (response.body as object)).toBe(false);
      },
    );

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'rejects forbidden identity fields for %s',
      async (role) => {
        const { auth } = await registerAsRole(role, 'forbidden');

        for (const forbiddenField of [
          { password: 'new-password' },
          { role: Role.ADMIN },
          { id: 'another-user-id' },
          { nickname: 'not-allowed' },
        ]) {
          await request(app.getHttpServer())
            .patch('/api/v1/users/profile')
            .set('Authorization', `Bearer ${auth.access_token}`)
            .send(forbiddenField)
            .expect(400);
        }
      },
    );

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'returns a normalized no-op without changing updatedAt or sessions for %s',
      async (role) => {
        const { auth } = await registerAsRole(role, 'noop');
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
      },
    );

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'returns 409 for an occupied normalized email for %s',
      async (role) => {
        const target = await registerAsRole(role, 'duplicate-target');
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
      },
    );

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'keeps the initiating session and revokes the other token pair after an email change for %s',
      async (role) => {
        const first = await registerAsRole(role, 'session-a');
        const secondLogin = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', `profile-session-b-${role}-${testPrefix}`)
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
      },
    );

    it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
      'preserves all sessions after a name-only update for %s',
      async (role) => {
        const { auth, email } = await registerAsRole(role, 'name-only');
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', `profile-name-only-${role}-${testPrefix}`)
          .send({ email, password: testPassword })
          .expect(200);
        const before = await prisma.authSession.findMany({
          where: { userId: auth.id },
          select: { id: true, revokedAt: true },
          orderBy: { id: 'asc' },
        });

        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send({ name: 'Nome Atualizado' })
          .expect(200);

        const after = await prisma.authSession.findMany({
          where: { userId: auth.id },
          select: { id: true, revokedAt: true },
          orderBy: { id: 'asc' },
        });
        const sessionsPreserved =
          before.length === 2 &&
          after.length === before.length &&
          after.every((session) => session.revokedAt === null) &&
          after.every((session, index) => session.id === before[index]?.id);
        expect(sessionsPreserved).toBe(true);
      },
    );

    it.each(['after-user-write', 'after-session-revoke'] as const)(
      'rolls back identity and sessions when a transaction fails %s',
      async (faultPoint) => {
        const { auth, email } = await registerAsRole(Role.PARENT, faultPoint);
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .set(
            'X-Forwarded-For',
            `profile-rollback-${faultPoint}-${testPrefix}`,
          )
          .send({ email, password: testPassword })
          .expect(200);
        const beforeIdentity = await prisma.user.findUniqueOrThrow({
          where: { id: auth.id },
          select: { email: true, name: true, updatedAt: true },
        });
        const beforeSessions = await prisma.authSession.findMany({
          where: { userId: auth.id },
          select: { id: true, revokedAt: true },
          orderBy: { id: 'asc' },
        });
        const fault = createTransactionFaultInjector(faultPoint);
        const servicePrisma = app.get<UsersService>(
          UsersService,
        ) as unknown as {
          prisma: PrismaService;
        };
        const originalPrisma = servicePrisma.prisma;
        servicePrisma.prisma = fault.wrapPrisma(prisma);

        try {
          await request(app.getHttpServer())
            .patch('/api/v1/users/profile')
            .set('Authorization', `Bearer ${auth.access_token}`)
            .send({ email: makeEmail(`${faultPoint}-updated`) })
            .expect(500);
          expect(fault.triggered).toBe(true);
        } finally {
          servicePrisma.prisma = originalPrisma;
        }

        const afterIdentity = await prisma.user.findUniqueOrThrow({
          where: { id: auth.id },
          select: { email: true, name: true, updatedAt: true },
        });
        const afterSessions = await prisma.authSession.findMany({
          where: { userId: auth.id },
          select: { id: true, revokedAt: true },
          orderBy: { id: 'asc' },
        });
        const priorStatePreserved =
          afterIdentity.email === beforeIdentity.email &&
          afterIdentity.name === beforeIdentity.name &&
          afterIdentity.updatedAt.getTime() ===
            beforeIdentity.updatedAt.getTime() &&
          afterSessions.length === beforeSessions.length &&
          afterSessions.every(
            (session, index) =>
              session.id === beforeSessions[index]?.id &&
              session.revokedAt?.getTime() ===
                beforeSessions[index]?.revokedAt?.getTime(),
          );
        expect(priorStatePreserved).toBe(true);
      },
    );

    it('rejects an email write if the authenticated sid is revoked before its sensitive transaction work', async () => {
      const { auth } = await registerAsRole(Role.PARENT, 'sid-revoked');
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: auth.id },
        select: { email: true, name: true, updatedAt: true },
      });
      const beforeSessions = await prisma.authSession.findMany({
        where: { userId: auth.id },
        select: { id: true, revokedAt: true },
        orderBy: { id: 'asc' },
      });
      const initiatingSid = tokenSid(auth.access_token);
      const usersService = app.get<UsersService>(UsersService);
      const servicePrisma = usersService as unknown as {
        prisma: PrismaService;
      };
      const originalPrisma = servicePrisma.prisma;
      const sidInvalidation = createTransactionFaultInjector(
        'after-user-write',
        undefined,
        async (tx) => {
          await tx.authSession.update({
            where: { id: initiatingSid },
            data: { revokedAt: new Date() },
          });
        },
      );
      servicePrisma.prisma = sidInvalidation.wrapPrisma(prisma);

      try {
        await request(app.getHttpServer())
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${auth.access_token}`)
          .send({ email: makeEmail('sid-revoked-updated') })
          .expect(401);
      } finally {
        servicePrisma.prisma = originalPrisma;
      }

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: auth.id },
        select: { email: true, name: true, updatedAt: true },
      });
      const afterSessions = await prisma.authSession.findMany({
        where: { userId: auth.id },
        select: { id: true, revokedAt: true },
        orderBy: { id: 'asc' },
      });
      const priorStatePreserved =
        after.email === before.email &&
        after.name === before.name &&
        after.updatedAt.getTime() === before.updatedAt.getTime() &&
        afterSessions.length === beforeSessions.length &&
        afterSessions.every(
          (session, index) =>
            session.id === beforeSessions[index]?.id &&
            session.revokedAt?.getTime() ===
              beforeSessions[index]?.revokedAt?.getTime(),
        );
      expect(priorStatePreserved).toBe(true);
      expect(sidInvalidation.triggered).toBe(false);
    });
  });
});
