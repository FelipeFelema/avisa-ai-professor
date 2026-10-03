import { INestApplication, HttpException, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  hashPassword,
  verifyPassword,
} from '../src/common/security/password-hasher';
import { createTestApp } from './helpers/test-app.helper';
import { assertSafeTestDatabase } from './helpers/test-database.helper';
import {
  createSyntheticProfileUser,
  createDeterministicBarrier,
  createTransactionFaultInjector,
  PROFILE_PASSWORD_TEST_PASSWORD,
} from './helpers/profile-password.helper';

const nextPassword = '😀'.repeat(30) + ' changed';
const body = {
  currentPassword: PROFILE_PASSWORD_TEST_PASSWORD,
  newPassword: nextPassword,
  confirmNewPassword: nextPassword,
};

describe('password change production HTTP/PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ids: string[] = [];
  const limiter = { canActivate: jest.fn(() => true) };
  beforeAll(async () => {
    assertSafeTestDatabase();
    app = (await createTestApp({
      configureBuilder: (builder) => {
        builder.overrideGuard(RateLimitGuard).useValue(limiter);
      },
    })) as INestApplication<App>;
    prisma = app.get<PrismaService>(PrismaService);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    limiter.canActivate.mockReturnValue(true);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });
  async function fixture(role: Role = Role.PARENT, scrypt = false) {
    const user = await createSyntheticProfileUser(prisma, { role });
    ids.push(user.id);
    if (scrypt)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(PROFILE_PASSWORD_TEST_PASSWORD) },
      });
    const auth = app.get<AuthService>(AuthService);
    const first = await auth.login(user.email, PROFILE_PASSWORD_TEST_PASSWORD);
    const second = await auth.login(user.email, PROFILE_PASSWORD_TEST_PASSWORD);
    return { user, first, second };
  }
  const change = (token: string, payload: unknown = body) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .auth(token, { type: 'bearer' })
      .send(payload as object);
  async function state(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const sessions = await prisma.authSession.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });
    return JSON.stringify({ user, sessions });
  }
  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'changes %s credentials, preserves initiator and revokes all others',
    async (role) => {
      const { user, first, second } = await fixture(role, role === Role.ADMIN);
      const initiating = await prisma.authSession.findUniqueOrThrow({
        where: { id: first.sid },
      });
      const response = await change(first.access_token);
      expect(response.status).toBe(204);
      expect(response.text === '').toBe(true);
      const after = await prisma.authSession.findUniqueOrThrow({
        where: { id: first.sid },
      });
      expect(JSON.stringify(after) === JSON.stringify(initiating)).toBe(true);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role,
      ).toBe(role);
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/users/profile')
            .auth(first.access_token, { type: 'bearer' })
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/users/profile')
            .auth(second.access_token, { type: 'bearer' })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app.getHttpServer())
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: second.refresh_token })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app.getHttpServer())
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: first.refresh_token })
        ).status,
      ).toBe(200);
      const auth = app.get<AuthService>(AuthService);
      let oldRejected = false;
      try {
        await auth.login(user.email, PROFILE_PASSWORD_TEST_PASSWORD);
      } catch {
        oldRejected = true;
      }
      expect(oldRejected).toBe(true);
      const current = await auth.login(user.email, nextPassword);
      expect(Boolean(current.sid)).toBe(true);
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(
        await verifyPassword(nextPassword.slice(0, -1) + 'X', stored.password),
      ).toBe(false);
    },
  );
  it('rejects the complete raw-type/extra/exact/boundary matrix without writes or leaked values', async () => {
    const { user, first } = await fixture();
    const before = await state(user.id);
    const invalid: unknown[] = [];
    for (const field of Object.keys(body))
      for (const value of [undefined, null, '', 123456, {}, []])
        invalid.push({ ...body, [field]: value });
    for (const extra of ['id', 'userId', 'sid', 'role', 'extra'])
      invalid.push({ ...body, [extra]: 'untrusted' });
    for (const size of [5, 73])
      invalid.push({
        ...body,
        newPassword: '😀'.repeat(size),
        confirmNewPassword: '😀'.repeat(size),
      });
    invalid.push(
      { ...body, currentPassword: 'Synthetic incorrect' },
      {
        ...body,
        newPassword: body.currentPassword,
        confirmNewPassword: body.currentPassword,
      },
      { ...body, confirmNewPassword: nextPassword + ' ' },
    );
    for (const payload of invalid) {
      const response = await change(first.access_token, payload);
      expect(response.status).toBe(400);
      expect(
        !response.text.includes(PROFILE_PASSWORD_TEST_PASSWORD) &&
          !response.text.includes(nextPassword),
      ).toBe(true);
      expect((await state(user.id)) === before).toBe(true);
    }
  });
  it.each([6, 72])(
    'accepts %i Unicode code points through HTTP',
    async (size) => {
      const { first } = await fixture();
      const password = '😀'.repeat(size);
      expect(
        (
          await change(first.access_token, {
            ...body,
            newPassword: password,
            confirmNewPassword: password,
          })
        ).status,
      ).toBe(204);
    },
  );
  it('returns 401 for missing/revoked/expired or foreign sid and 429 when limited', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/change-password')
          .send(body)
      ).status,
    ).toBe(401);
    const { first, second } = await fixture();
    await prisma.authSession.update({
      where: { id: second.sid },
      data: { revokedAt: new Date() },
    });
    expect((await change(second.access_token)).status).toBe(401);
    await prisma.authSession.update({
      where: { id: first.sid },
      data: { expiresAt: new Date(0) },
    });
    expect((await change(first.access_token)).status).toBe(401);
    const active = await fixture();
    limiter.canActivate.mockImplementationOnce(() => {
      throw new HttpException('Limite de requisições excedido', 429);
    });
    expect((await change(active.first.access_token)).status).toBe(429);
  });
  it.each(['after-user-write', 'after-session-revoke'] as const)(
    'rolls back real work %s with sanitized 500',
    async (point) => {
      const { user, first } = await fixture();
      const before = await state(user.id);
      const credential = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      const sensitive = [
        body.currentPassword,
        body.newPassword,
        credential.password,
        first.access_token,
      ];
      const fault = createTransactionFaultInjector(
        point,
        new Error(sensitive.join(' ')),
      );
      const failureApp = (await createTestApp({
        prismaFactory: () => fault.wrapPrisma(new PrismaService()),
      })) as INestApplication<App>;
      const diagnostics = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        const response = await request(failureApp.getHttpServer())
          .post('/api/v1/auth/change-password')
          .auth(first.access_token, { type: 'bearer' })
          .send(body);
        expect(response.status).toBe(500);
        expect(fault.triggered).toBe(true);
        expect((await state(user.id)) === before).toBe(true);
        const observed = response.text + JSON.stringify(diagnostics.mock.calls);
        expect(sensitive.every((value) => !observed.includes(value))).toBe(
          true,
        );
      } finally {
        diagnostics.mockRestore();
        await failureApp.close();
      }
    },
  );
  it('enforces the real ten-attempt rate limit on the protected endpoint', async () => {
    const { user, first } = await fixture();
    const before = await state(user.id);
    const limitedApp = (await createTestApp()) as INestApplication<App>;
    try {
      for (let attempt = 0; attempt < 11; attempt++) {
        const response = await request(limitedApp.getHttpServer())
          .post('/api/v1/auth/change-password')
          .auth(first.access_token, { type: 'bearer' })
          .send({ ...body, currentPassword: 'Synthetic incorrect' });
        expect(response.status).toBe(attempt < 10 ? 400 : 429);
      }
      expect((await state(user.id)) === before).toBe(true);
    } finally {
      await limitedApp.close();
    }
  });
  it('allows only one concurrent operation over the same snapshot (409)', async () => {
    const { user, first } = await fixture();
    const sessions = app.get<AuthSessionService>(AuthSessionService);
    const original = sessions.withUserLock.bind(
      sessions,
    ) as AuthSessionService['withUserLock'];
    const barrier = createDeterministicBarrier(2);
    jest
      .spyOn(sessions, 'withUserLock')
      .mockImplementation(async (id, operation) => {
        await barrier.wait();
        return original(id, operation);
      });
    const result = await Promise.all([
      change(first.access_token),
      change(first.access_token),
    ]);
    expect(result.map((r) => r.status).sort()).toEqual([204, 409]);
    expect(
      await verifyPassword(
        nextPassword,
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .password,
      ),
    ).toBe(true);
  });
  it('rejects an old-snapshot login after a committed change without creating a late session', async () => {
    const { user, first } = await fixture();
    const sessions = app.get<AuthSessionService>(AuthSessionService);
    const original = sessions.withUserLock.bind(
      sessions,
    ) as AuthSessionService['withUserLock'];
    const arrived = createDeterministicBarrier(2);
    const release = createDeterministicBarrier(2);
    jest
      .spyOn(sessions, 'withUserLock')
      .mockImplementationOnce(async (id, operation) => {
        await arrived.wait();
        await release.wait();
        return original(id, operation);
      });
    const login = app
      .get<AuthService>(AuthService)
      .login(user.email, PROFILE_PASSWORD_TEST_PASSWORD)
      .then(
        () => false,
        () => true,
      );
    await arrived.wait();
    try {
      expect((await change(first.access_token)).status).toBe(204);
    } finally {
      release.release();
    }
    expect(await login).toBe(true);
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
      2,
    );
  });
  it.each(['revoked', 'expired', 'foreign'] as const)(
    'revalidates %s initiating sid after expensive preparation',
    async (kind) => {
      const { user, first } = await fixture();
      const sessions = app.get<AuthSessionService>(AuthSessionService);
      const original = sessions.withUserLock.bind(
        sessions,
      ) as AuthSessionService['withUserLock'];
      const other = kind === 'foreign' ? await fixture() : undefined;
      jest
        .spyOn(sessions, 'withUserLock')
        .mockImplementationOnce(async (id, operation) => {
          await prisma.authSession.update({
            where: { id: first.sid },
            data:
              kind === 'revoked'
                ? { revokedAt: new Date() }
                : kind === 'expired'
                  ? { expiresAt: new Date(0) }
                  : { userId: other!.user.id },
          });
          return original(id, operation);
        });
      const snapshot = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect((await change(first.access_token)).status).toBe(401);
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(
        after.password === snapshot.password &&
          after.updatedAt.getTime() === snapshot.updatedAt.getTime(),
      ).toBe(true);
    },
  );
  it('a refresh that started earlier never revives a revoked sid', async () => {
    const { first, second } = await fixture();
    const sessions = app.get<AuthSessionService>(AuthSessionService);
    const original = sessions.rotate.bind(
      sessions,
    ) as AuthSessionService['rotate'];
    const arrived = createDeterministicBarrier(2);
    const release = createDeterministicBarrier(2);
    jest.spyOn(sessions, 'rotate').mockImplementationOnce(async (...args) => {
      await arrived.wait();
      await release.wait();
      return original(...args);
    });
    const refreshing = app
      .get<AuthService>(AuthService)
      .refreshToken(second.refresh_token);
    await arrived.wait();
    try {
      expect((await change(first.access_token)).status).toBe(204);
    } finally {
      release.release();
    }
    const tokens = await refreshing;
    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: second.sid },
        })
      ).revokedAt !== null,
    ).toBe(true);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/users/profile')
          .auth(tokens.access_token, { type: 'bearer' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: tokens.refresh_token })
      ).status,
    ).toBe(401);
  });
});
