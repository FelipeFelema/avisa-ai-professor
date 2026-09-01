import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
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
      .expect(201);

    const body = response.body as Record<string, unknown>;

    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
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
      .expect(201);
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
      .expect(201);

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
      .expect(201);

    const userId = (registered.body as AuthResponse).id;
    const sessions = await prisma.authSession.findMany({ where: { userId } });
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => session.id)).size).toBe(2);
    expect(sessions.every((session) => session.revokedAt === null)).toBe(true);
  });
});
