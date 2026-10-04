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
