import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { UsersService } from '../src/users/users.service';
import {
  cleanupAccountFixture,
  createAccountFixture,
  createBarrier,
} from './helpers/account-deletion.helper';
import { assertSafeTestDatabase } from './helpers/test-database.helper';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import type { SessionRevocationDto } from '../src/auth/dto/session-revocation.dto';
import { createTestApp } from './helpers/test-app.helper';
import {
  createReleaseSecurityFixture,
  cleanupReleaseSecurityFixture,
  assertReleaseTestDatabase,
} from './helpers/release-security.fixture';

type AuthRaceHooks = {
  beforeUserLock?: () => void;
  afterUserLock?: () => void | Promise<void>;
};

function signal() {
  let notify!: () => void;
  return {
    entered: new Promise<void>((resolve) => (notify = resolve)),
    arrive: () => notify(),
  };
}

function instrumentTransactions(
  prisma: PrismaService,
  hooks: AuthRaceHooks,
): PrismaService {
  const wrap = (tx: Prisma.TransactionClient) =>
    new Proxy(tx, {
      get(target, key) {
        if (key !== '$queryRaw')
          return Reflect.get(target, key, target) as unknown;
        const query = Reflect.get(target, key, target) as (
          this: Prisma.TransactionClient,
          ...args: unknown[]
        ) => Promise<unknown>;
        const runQuery = query.bind(target) as (
          ...args: unknown[]
        ) => Promise<unknown>;
        return async (...args: unknown[]) => {
          const sql = Array.isArray(args[0]) ? args[0].join('') : '';
          if (sql.includes('FROM "User"') && sql.includes('FOR UPDATE')) {
            hooks.beforeUserLock?.();
            const result: unknown = await runQuery(...args);
            await hooks.afterUserLock?.();
            return result;
          }
          return runQuery(...args);
        };
      },
    });
  return new Proxy(prisma, {
    get(target, key) {
      if (key !== '$transaction')
        return Reflect.get(target, key, target) as unknown;
      const transaction = Reflect.get(target, key, target) as (
        this: PrismaService,
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) => Promise<unknown>;
      const runTransaction = transaction.bind(target) as (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) => Promise<unknown>;
      return (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) =>
        runTransaction(
          (tx: Prisma.TransactionClient) => work(wrap(tx)),
          options,
        );
    },
  });
}

type AuthResponse = {
  id: string;
  access_token: string;
  refresh_token: string;
};

describe('Auth Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const emailPrefix = `integration-${Date.now()}`;
  const testPassword = '12345678';

  const makeEmail = (label: string) => `${emailPrefix}-${label}@email.com`;

  const deleteTestUsers = async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: emailPrefix,
        },
      },
    });
  };

  const registerUser = (email: string): request.Test =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send({
      name: 'Integration Test User',
      email,
      password: testPassword,
    });

  beforeAll(async () => {
    assertSafeTestDatabase();
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

  it('should register a parent user successfully', async () => {
    const response = await registerUser(makeEmail('register')).expect(201);

    const body = response.body as Record<string, unknown>;

    expect(body).toEqual(
      expect.objectContaining({
        access_token: expect.any(String) as unknown as string,
        refresh_token: expect.any(String) as unknown as string,
        updatedAt: expect.any(String) as unknown as string,
      }),
    );
    expect(body).not.toHaveProperty('sid');
  });

  it('should login with registered user successfully', async () => {
    const email = makeEmail('login');

    await registerUser(email).expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: testPassword,
      })
      .expect(200);

    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      access_token: expect.any(String) as unknown as string,
      refresh_token: expect.any(String) as unknown as string,
    });
    expect(body).not.toHaveProperty('sid');
  });

  it('should not register duplicate email', async () => {
    const email = makeEmail('duplicated');

    await registerUser(email).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicated User',
        email,
        password: testPassword,
      })
      .expect(409);
  });

  it('should not login with wrong password', async () => {
    const email = makeEmail('wrong-password');

    await registerUser(email).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'wrongpassword',
      })
      .expect(401);
  });

  it('should not register invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: '',
        email: 'invalid-email',
        password: '123',
      })
      .expect(400);
  });

  it('creates a session per login and rotates only the matching refresh token', async () => {
    const email = makeEmail('session-rotation');
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', 'session-rotation')
      .send({ name: 'Integration Test User', email, password: testPassword })
      .expect(201);
    const firstRefresh = (registered.body as AuthResponse).refresh_token;
    const userId = (registered.body as AuthResponse).id;

    const firstSessionCount = await prisma.authSession.count({
      where: { userId },
    });
    expect(firstSessionCount).toBe(1);

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', 'session-rotation')
      .send({ refreshToken: firstRefresh })
      .expect(200);
    expect(rotated.body).toEqual({
      access_token: expect.any(String) as unknown as string,
      refresh_token: expect.any(String) as unknown as string,
    });
    expect(rotated.body).not.toHaveProperty('sid');
    expect((rotated.body as AuthResponse).refresh_token).not.toBe(firstRefresh);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', 'session-rotation')
      .send({ refreshToken: firstRefresh })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', 'session-rotation')
      .send({ refreshToken: (rotated.body as AuthResponse).refresh_token })
      .expect(200);

    expect(await prisma.authSession.count({ where: { userId } })).toBe(1);
  });

  it('keeps simultaneous login sessions independently addressable by sid', async () => {
    const email = makeEmail('two-sessions');
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', 'two-sessions')
      .send({ name: 'Integration Test User', email, password: testPassword })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', 'two-sessions-login')
      .send({ email, password: testPassword })
      .expect(200);

    const userId = (registered.body as AuthResponse).id;
    const sessions = await prisma.authSession.findMany({ where: { userId } });
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => session.id)).size).toBe(2);
    expect(sessions.every((session) => session.revokedAt === null)).toBe(true);
  });

  it.each(['login', 'issueTokens', 'refresh'] as const)(
    'rejects a %s that reaches the User lock after account deletion commits',
    async (kind) => {
      const fixture = await createAccountFixture(prisma, {
        role: Role.PARENT,
        empty: true,
      });
      const deletionLock = createBarrier();
      const authLockAttempt = signal();
      const deletion = new AccountDeletionService(
        instrumentTransactions(prisma, {
          afterUserLock: () => deletionLock.pause(),
        }),
      );
      const auth = new AuthService(
        app.get(UsersService),
        app.get(JwtService),
        app.get(ConfigService),
        new AuthSessionService(
          instrumentTransactions(prisma, {
            beforeUserLock: () => authLockAttempt.arrive(),
          }),
        ),
      );
      try {
        let refreshToken: string | undefined;
        if (kind === 'refresh') {
          const seeded = await app.get(AuthService).issueTokens({
            id: fixture.target.id,
            email: fixture.target.email,
            role: fixture.target.role,
          });
          refreshToken = seeded.refresh_token;
        }
        const removing = deletion.deleteOwnAccount(
          fixture.target.id,
          fixture.sessions[0].id,
          {
            currentPassword: fixture.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        await deletionLock.entered;
        const authenticating =
          kind === 'login'
            ? auth.login(fixture.target.email, fixture.password)
            : kind === 'issueTokens'
              ? auth.issueTokens({
                  id: fixture.target.id,
                  email: fixture.target.email,
                  role: fixture.target.role,
                })
              : auth.refreshToken(refreshToken!);
        await authLockAttempt.entered;
        deletionLock.release();
        await removing;
        await expect(authenticating).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(
          await prisma.authSession.count({
            where: { userId: fixture.target.id },
          }),
        ).toBe(0);
      } finally {
        deletionLock.release();
        await cleanupAccountFixture(prisma, fixture);
      }
    },
  );

  it.each(['login', 'issueTokens', 'refresh'] as const)(
    'removes a %s session that commits before account deletion',
    async (kind) => {
      const fixture = await createAccountFixture(prisma, {
        role: Role.PARENT,
        empty: true,
      });
      const authLock = createBarrier();
      const deletionLockAttempt = signal();
      let userLockCount = 0;
      const auth = new AuthService(
        app.get(UsersService),
        app.get(JwtService),
        app.get(ConfigService),
        new AuthSessionService(
          instrumentTransactions(prisma, {
            afterUserLock: () => {
              userLockCount += 1;
              if (userLockCount === 2) return authLock.pause();
            },
          }),
        ),
      );
      const deletion = new AccountDeletionService(
        instrumentTransactions(prisma, {
          beforeUserLock: () => deletionLockAttempt.arrive(),
        }),
      );
      try {
        let refreshToken: string | undefined;
        if (kind === 'refresh') {
          const seeded = await app.get(AuthService).issueTokens({
            id: fixture.target.id,
            email: fixture.target.email,
            role: fixture.target.role,
          });
          refreshToken = seeded.refresh_token;
        }
        const authenticating =
          kind === 'login'
            ? auth.login(fixture.target.email, fixture.password)
            : kind === 'issueTokens'
              ? auth.issueTokens({
                  id: fixture.target.id,
                  email: fixture.target.email,
                  role: fixture.target.role,
                })
              : auth.refreshToken(refreshToken!);
        await authLock.entered;
        const removing = deletion.deleteOwnAccount(
          fixture.target.id,
          kind === 'refresh' ? fixture.sessions[0].id : fixture.sessions[1].id,
          {
            currentPassword: fixture.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        await deletionLockAttempt.entered;
        authLock.release();
        const issued = await authenticating;
        await removing;
        expect(
          await prisma.authSession.count({
            where: { userId: fixture.target.id },
          }),
        ).toBe(0);
        await expect(
          app.get(AuthService).refreshToken(issued.refresh_token),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        await request(app.getHttpServer())
          .get('/api/v1/users/profile')
          .auth(issued.access_token, { type: 'bearer' })
          .expect(401);
      } finally {
        authLock.release();
        await cleanupAccountFixture(prisma, fixture);
      }
    },
  );
});

describe('Release assessment: session boundaries', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof createReleaseSecurityFixture>>;
  beforeAll(async () => {
    assertReleaseTestDatabase();
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    fixture = await createReleaseSecurityFixture(prisma, app.get(AuthService));
  });
  afterEach(async () => cleanupReleaseSecurityFixture(prisma, fixture));
  afterAll(async () => app.close());

  it('logout invalidates preserved access and refresh tokens on the server', async () => {
    const { access_token, refresh_token, sid } = fixture.parentA;
    const capability = await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .auth(access_token, { type: 'bearer' })
      .expect(200);
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send(capability.body as SessionRevocationDto);
    // The replay assertion also reproduces the pre-fix missing endpoint (404).
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(access_token, { type: 'bearer' })
      .expect(401);
    expect(logout.status).toBe(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh_token })
      .expect(401);
    expect(
      (await prisma.authSession.findUniqueOrThrow({ where: { id: sid } }))
        .revokedAt,
    ).not.toBeNull();
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(fixture.parentB.access_token, { type: 'bearer' })
      .expect(200);
  });

  it('revokes one sid idempotently and preserves another session of the same user', async () => {
    const a = fixture.parentA;
    const other = await app.get(AuthService).issueTokens(a);
    const capability = await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .auth(a.access_token, { type: 'bearer' })
      .expect(200);
    expect(Object.keys(capability.body as object).sort()).toEqual([
      'capability',
      'sid',
    ]);
    expect(capability.headers['cache-control']).toBe('no-store');
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send(capability.body as SessionRevocationDto)
        .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(a.access_token, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: a.refresh_token })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(other.access_token, { type: 'bearer' })
      .expect(200);
    await expect(
      app.get(AuthService).refreshToken(other.refresh_token),
    ).resolves.toHaveProperty('access_token');
    expect(
      (await prisma.authSession.findUniqueOrThrow({ where: { id: other.sid } }))
        .revokedAt,
    ).toBeNull();
  });

  it('cannot substitute a foreign sid, gain access, or include session-selection fields', async () => {
    const a = fixture.parentA;
    await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .expect(401);
    const capability = await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .query({ sid: fixture.parentB.sid, userId: fixture.parentB.id })
      .auth(a.access_token, { type: 'bearer' })
      .expect(200);
    const body = capability.body as { sid: string; capability: string };
    expect(body.sid).toBe(a.sid);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ ...body, sid: fixture.parentB.sid })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ ...body, capability: 'A'.repeat(43) })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ ...body, userId: fixture.parentB.id })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(body.capability, { type: 'bearer' })
      .expect(401);
    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: fixture.parentB.sid },
        })
      ).revokedAt,
    ).toBeNull();
  });

  it('a capability survives token rotation and safely revokes after refresh/logout concurrency', async () => {
    const a = fixture.parentA;
    const capability = await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .auth(a.access_token, { type: 'bearer' })
      .expect(200);
    const rotated = await app.get(AuthService).refreshToken(a.refresh_token);
    const [refresh, logout] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.refresh_token }),
      request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send(capability.body as SessionRevocationDto),
    ]);
    expect([200, 401]).toContain(refresh.status);
    expect(logout.status).toBe(204);
    for (const token of [
      a.access_token,
      rotated.access_token,
      ...(refresh.status === 200
        ? [(refresh.body as AuthResponse).access_token]
        : []),
    ])
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .auth(token, { type: 'bearer' })
        .expect(401);
    expect(
      (await prisma.authSession.findUniqueOrThrow({ where: { id: a.sid } }))
        .revokedAt,
    ).not.toBeNull();
  });

  it('acknowledges removed or expired sessions without granting another capability', async () => {
    const capability = await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .auth(fixture.parentA.access_token, { type: 'bearer' })
      .expect(200);
    await prisma.authSession.update({
      where: { id: fixture.parentA.sid },
      data: { expiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/session-revocation')
      .auth(fixture.parentA.access_token, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send(capability.body as SessionRevocationDto)
      .expect(204);
    await prisma.authSession.delete({ where: { id: fixture.parentA.sid } });
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send(capability.body as SessionRevocationDto)
      .expect(204);
  });

  it('allows one concurrent refresh and rejects the losing replay without reviving a sid', async () => {
    const results = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: fixture.parentA.refresh_token }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: fixture.parentA.refresh_token })
      .expect(401);
  });

  it.each([
    'missing-sid',
    'foreign-sid',
    'expired-session',
    'revoked-session',
    'expired-token',
    'wrong-secret',
    'none',
    'HS384',
  ] as const)('rejects %s access tokens', async (kind) => {
    const account = fixture.parentA;
    const payload: Record<string, unknown> = {
      sub: account.id,
      sid: account.sid,
      role: Role.ADMIN,
    };
    if (kind === 'missing-sid') delete payload.sid;
    if (kind === 'foreign-sid') payload.sid = fixture.parentB.sid;
    if (kind === 'expired-session')
      await prisma.authSession.update({
        where: { id: account.sid },
        data: { expiresAt: new Date(0) },
      });
    if (kind === 'revoked-session')
      await prisma.authSession.update({
        where: { id: account.sid },
        data: { revokedAt: new Date() },
      });
    const token = app.get(JwtService).sign(payload, {
      secret:
        kind === 'wrong-secret'
          ? 'synthetic-wrong-secret'
          : app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: kind === 'expired-token' ? -1 : 900,
      algorithm:
        kind === 'none' ? 'none' : kind === 'HS384' ? 'HS384' : 'HS256',
    });
    await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });

  it('uses current database role instead of forged privileged claims', async () => {
    const token = app.get(JwtService).sign(
      { sub: fixture.parentA.id, sid: fixture.parentA.sid, role: Role.ADMIN },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: 900,
      },
    );
    const before = await prisma.inviteCode.count();
    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(403);
    expect(await prisma.inviteCode.count()).toBe(before);
  });

  it('retains no plaintext credentials and sets the documented token TTLs', async () => {
    const a = fixture.parentA;
    const access = app.get(JwtService).decode<{
      iat: number;
      exp: number;
      sid: string;
    }>(a.access_token);
    const refresh = app.get(JwtService).decode<{
      iat: number;
      exp: number;
      jti: string;
    }>(a.refresh_token);
    expect(access.exp - access.iat).toBe(900);
    expect(refresh.exp - refresh.iat).toBe(604800);
    expect(access.sid).toBe(a.sid);
    expect(refresh.jti).toEqual(expect.any(String));
    const session = await prisma.authSession.findUniqueOrThrow({
      where: { id: a.sid },
    });
    expect(session.refreshTokenHash).not.toContain(a.refresh_token);
    expect(a.password).not.toBe(fixture.password);
  });
});
