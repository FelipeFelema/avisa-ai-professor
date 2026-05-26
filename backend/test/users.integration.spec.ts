import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';

type AuthResponse = {
  access_token: string;
  refresh_token: string;
};

describe('Users Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `users-integration-${Date.now()}`;
  const testPassword = '12345678';

  const makeEmail = (label: string) => `${testPrefix}-${label}@example.com`;

  const deleteTestUsers = async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix } },
    });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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

  describe('GET /api/users/profile', () => {
    it('should get user profile with valid token', async () => {
      const email = makeEmail('profile');

      // Register a new user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      // Access the profile endpoint with the token
      const profileResponse = await request(app.getHttpServer())
        .get('/api/users/profile')
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
      await request(app.getHttpServer()).get('/api/users/profile').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const email = makeEmail('update');

      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Original Name',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      const updateResponse = await request(app.getHttpServer())
        .patch('/api/users/profile')
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
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email,
          password: testPassword,
        });

      const accessToken = (registerResponse.body as AuthResponse).access_token;

      await request(app.getHttpServer())
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });
});
