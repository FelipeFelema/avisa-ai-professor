import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';

type AuthResponse = {
  access_token: string;
  refresh_token: string;
};

describe('Classrooms Integration Tests', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `classrooms-integration-${Date.now()}`;
  const testPassword = '12345678';

  const makeEmail = (label: string) => `${testPrefix}-${label}@email.com`;
  const makeInviteCode = (label: string) => `PROF-${testPrefix}-${label}`;
  const makeClassroomName = (label: string) =>
    `${testPrefix}-${label}`.toUpperCase();

  const deleteTestData = async () => {
    await prisma.userClassroom.deleteMany({
      where: {
        classroom: {
          name: {
            startsWith: testPrefix,
            mode: 'insensitive',
          },
        },
      },
    });

    await prisma.classroom.deleteMany({
      where: {
        name: {
          startsWith: testPrefix,
          mode: 'insensitive',
        },
      },
    });

    await prisma.inviteCode.deleteMany({
      where: {
        code: {
          startsWith: `PROF-${testPrefix}`,
          mode: 'insensitive',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: testPrefix,
          mode: 'insensitive',
        },
      },
    });
  };

  const createProfessorToken = async (label: string) => {
    const inviteCode = makeInviteCode(label);

    await prisma.inviteCode.create({
      data: {
        code: inviteCode,
        role: Role.PROFESSOR,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Professor Integration Test',
        email: makeEmail(label),
        password: testPassword,
        teacherCode: inviteCode,
      })
      .expect(201);

    const body = response.body as AuthResponse;

    return body.access_token;
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

    prisma = app.get(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    await deleteTestData();
  });

  afterAll(async () => {
    await deleteTestData();
    await app.close();
  });

  it('should create classroom with professor authentication', async () => {
    const professorToken = await createProfessorToken('create-classroom');
    const classroomName = makeClassroomName('created');

    const response = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({
        name: classroomName,
      })
      .expect(201);

    const body = response.body as {
      id: string;
      name: string;
      userClassrooms: Array<{
        user: {
          name: string;
        };
      }>;
    };

    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', classroomName);
    expect(body).toHaveProperty('userClassrooms');
    expect(
      body.userClassrooms.some(
        (membership) => membership.user.name === 'Professor Integration Test',
      ),
    ).toBe(true);
  });

  it('should not create classroom without authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .send({
        name: makeClassroomName('without-auth'),
      })
      .expect(401);
  });
});
