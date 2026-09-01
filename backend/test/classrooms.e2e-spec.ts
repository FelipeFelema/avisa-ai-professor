import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app.helper';

type AuthResponse = {
  access_token: string;
};

describe('Classrooms deletion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testPrefix = `classrooms-e2e-${Date.now()}`;
  const testPassword = '12345678';
  const makeEmail = (label: string) => `${testPrefix}-${label}@email.com`;
  const makeInviteCode = (label: string) => `PROF-${testPrefix}-${label}`;

  const deleteTestData = async () => {
    const testUsers = await prisma.user.findMany({
      where: {
        email: { startsWith: testPrefix, mode: 'insensitive' },
      },
      select: { id: true },
    });
    const userIds = testUsers.map((user) => user.id);

    await prisma.userClassroom.deleteMany({
      where: {
        classroom: { name: { startsWith: testPrefix, mode: 'insensitive' } },
      },
    });
    await prisma.classroom.deleteMany({
      where: { name: { startsWith: testPrefix, mode: 'insensitive' } },
    });
    await prisma.classroomDeletionReceipt.deleteMany({
      where: { ownerId: { in: userIds } },
    });
    await prisma.inviteCode.deleteMany({
      where: {
        code: { startsWith: `PROF-${testPrefix}`, mode: 'insensitive' },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: testPrefix, mode: 'insensitive' } },
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
        name: 'Professor E Test',
        email: makeEmail(label),
        password: testPassword,
        teacherCode: inviteCode,
      })
      .expect(201);

    return (response.body as AuthResponse).access_token;
  };

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await deleteTestData();
  });

  afterAll(async () => {
    await deleteTestData();
    await app.close();
  });

  it('should return an empty 204 for the owner and make a retry idempotent', async () => {
    const ownerToken = await createProfessorToken('owner-delete');
    const classroom = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `${testPrefix}-DELETE` })
      .expect(201);
    const classroomId = (classroom.body as { id: string }).id;

    await request(app.getHttpServer())
      .delete(`/api/v1/classrooms/${classroomId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204)
      .expect((response) => expect(response.text).toBe(''));

    await request(app.getHttpServer())
      .delete(`/api/v1/classrooms/${classroomId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
  });

  it('should reject an anonymous classroom deletion with 401', async () => {
    const ownerToken = await createProfessorToken('anonymous-delete');
    const classroom = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `${testPrefix}-ANONYMOUS` })
      .expect(201);
    const classroomId = (classroom.body as { id: string }).id;

    await request(app.getHttpServer())
      .delete(`/api/v1/classrooms/${classroomId}`)
      .expect(401);
  });
});
