import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';

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
});
