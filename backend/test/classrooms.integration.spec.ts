import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          startsWith: testPrefix,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    await prisma.classroomDeletionReceipt.deleteMany({
      where: { ownerId: { in: testUsers.map((user) => user.id) } },
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

  const createParentToken = async (label: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Parent Integration Test',
        email: makeEmail(label),
        password: testPassword,
      })
      .expect(201);

    return (response.body as AuthResponse).access_token;
  };

  const createClassroom = async (professorToken: string, label: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ name: makeClassroomName(label) })
      .expect(201);

    return (response.body as { id: string }).id;
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

  describe('DELETE /api/v1/classrooms/:id', () => {
    it('should return 204 and atomically cascade memberships and announcements', async () => {
      const ownerLabel = 'delete-owner';
      const ownerToken = await createProfessorToken(ownerLabel);
      const parentToken = await createParentToken('delete-parent');
      const classroomId = await createClassroom(ownerToken, 'delete-cascade');

      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${classroomId}/join`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Comunicado de exclusão',
          content: 'Conteúdo que deve ser removido em cascata',
          durationInDays: 7,
          classroomId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204)
        .expect((response) => {
          expect(response.text).toBe('');
        });

      expect(
        await prisma.classroom.findUnique({ where: { id: classroomId } }),
      ).toBeNull();
      expect(await prisma.userClassroom.count({ where: { classroomId } })).toBe(
        0,
      );
      expect(await prisma.announcement.count({ where: { classroomId } })).toBe(
        0,
      );

      const owner = await prisma.user.findUnique({
        where: { email: makeEmail(ownerLabel) },
        select: { id: true },
      });
      expect(
        await prisma.classroomDeletionReceipt.findUnique({
          where: { classroomId },
        }),
      ).toMatchObject({ classroomId, ownerId: owner?.id });
    });

    it('should return 204 on a repeated DELETE by the same owner', async () => {
      const ownerToken = await createProfessorToken('delete-retry');
      const classroomId = await createClassroom(ownerToken, 'delete-retry');

      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      expect(
        await prisma.classroomDeletionReceipt.count({ where: { classroomId } }),
      ).toBe(1);
    });

    it('should enforce anonymous, non-owner, parent and absent-classroom authorization responses', async () => {
      const ownerToken = await createProfessorToken('delete-auth-owner');
      const nonOwnerToken = await createProfessorToken('delete-auth-non-owner');
      const parentToken = await createParentToken('delete-auth-parent');
      const classroomId = await createClassroom(ownerToken, 'delete-auth');

      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${classroomId}/join`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${classroomId}/join`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${classroomId}`)
        .expect(401);
      await request(app.getHttpServer())
        .delete(`/api/v1/classrooms/${randomUUID()}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });

    it('should make concurrent same-owner DELETE requests return 204 once each', async () => {
      const ownerToken = await createProfessorToken('delete-concurrent');
      const classroomId = await createClassroom(
        ownerToken,
        'delete-concurrent',
      );

      const responses = await Promise.all([
        request(app.getHttpServer())
          .delete(`/api/v1/classrooms/${classroomId}`)
          .set('Authorization', `Bearer ${ownerToken}`),
        request(app.getHttpServer())
          .delete(`/api/v1/classrooms/${classroomId}`)
          .set('Authorization', `Bearer ${ownerToken}`),
      ]);

      expect(responses.map((response) => response.status)).toEqual([204, 204]);
      expect(
        await prisma.classroomDeletionReceipt.count({ where: { classroomId } }),
      ).toBe(1);
    });

    it('should keep classroom data and receipt unchanged when the deletion transaction aborts', async () => {
      const ownerToken = await createProfessorToken('delete-rollback');
      const classroomId = await createClassroom(ownerToken, 'delete-rollback');
      const transactionSpy = jest
        .spyOn(prisma, '$transaction')
        .mockRejectedValue(new Error('simulated transaction failure'));

      try {
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/classrooms/${classroomId}`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(response.status).toBe(500);
        expect(
          await prisma.classroom.findUnique({ where: { id: classroomId } }),
        ).not.toBeNull();
        expect(
          await prisma.classroomDeletionReceipt.findUnique({
            where: { classroomId },
          }),
        ).toBeNull();
      } finally {
        transactionSpy.mockRestore();
      }
    });
  });
});
