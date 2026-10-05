import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { ClassroomsService } from '../src/classrooms/classrooms.service';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAdminUserAndLogin } from './helpers/admin-user.helper';

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
      .set('X-Forwarded-For', `classrooms-${testPrefix}-${label}`)
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
      .set('X-Forwarded-For', `classrooms-parent-${testPrefix}-${label}`)
      .send({
        name: 'Parent Integration Test',
        email: makeEmail(label),
        password: testPassword,
      })
      .expect(201);

    return (response.body as AuthResponse).access_token;
  };

  const createAdminToken = async (label: string) => {
    const auth = await createAdminUserAndLogin(app, prisma, {
      email: makeEmail(`admin-${label}`),
      password: testPassword,
      name: 'Admin Integration Test',
    });
    return auth.accessToken;
  };

  const createClassroom = async (professorToken: string, label: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ name: makeClassroomName(label) })
      .expect(201);

    return (response.body as { id: string }).id;
  };

  const createClassroomWithName = async (
    professorToken: string,
    name: string,
  ) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ name })
      .expect(201);

    return (response.body as { id: string }).id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);

    const httpServer = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    httpServer.set('trust proxy', true);

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
      ownerId: string;
      members: Array<{ id: string; name: string }>;
      createdAt: string;
      updatedAt: string;
    };

    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', classroomName);
    expect(body).toEqual(
      expect.objectContaining({
        ownerId: expect.any(String) as unknown as string,
        members: [
          expect.objectContaining({
            id: expect.any(String) as unknown as string,
            name: 'Professor Integration Test',
          }),
        ],
        createdAt: expect.any(String) as unknown as string,
        updatedAt: expect.any(String) as unknown as string,
      }),
    );
    expect(body).not.toHaveProperty('userClassrooms');
  });

  it('should not create classroom without authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/classrooms')
      .send({
        name: makeClassroomName('without-auth'),
      })
      .expect(401);
  });

  it('should return contract-shaped members for join and leave', async () => {
    const ownerToken = await createProfessorToken('join-leave-owner');
    const parentToken = await createParentToken('join-leave-parent');
    const classroomId = await createClassroom(ownerToken, 'join-leave');

    const joined = await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${classroomId}/join`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);
    expect(joined.body).toEqual(
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ name: 'Parent Integration Test' }),
        ]) as unknown as Array<Record<string, unknown>>,
        createdAt: expect.any(String) as unknown as string,
        updatedAt: expect.any(String) as unknown as string,
      }),
    );
    expect(joined.body).not.toHaveProperty('userClassrooms');

    const left = await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${classroomId}/leave`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(left.body).toEqual(
      expect.objectContaining({
        members: [
          expect.objectContaining({ name: 'Professor Integration Test' }),
        ],
      }),
    );
    expect(left.body).not.toHaveProperty('userClassrooms');
  });

  describe('GET /api/v1/classrooms search contract', () => {
    const availableRequest = (token: string, search?: string) => {
      const result = request(app.getHttpServer()).get('/api/v1/classrooms');
      const withSearch =
        search === undefined ? result : result.query({ search });

      return withSearch.set('Authorization', `Bearer ${token}`);
    };

    it('matches literal, case-insensitive substrings and keeps my classrooms unfiltered', async () => {
      const ownerToken = await createProfessorToken('search-fixture-owner');
      const parentToken = await createParentToken('search-fixture-parent');
      const names = {
        math6: `${testPrefix} Matemática 6º A`,
        math7: `${testPrefix} Matemática 7º B`,
        portuguese: `${testPrefix} Português 6º A`,
        associated: `${testPrefix} Matemática associada`,
        percent: `${testPrefix} Valor 10% real`,
        underscore: `${testPrefix} Sub_nome`,
        backslash: `${testPrefix} Caminho\\Turma`,
      };
      const ids = {
        math6: await createClassroomWithName(ownerToken, names.math6),
        math7: await createClassroomWithName(ownerToken, names.math7),
        portuguese: await createClassroomWithName(ownerToken, names.portuguese),
        associated: await createClassroomWithName(ownerToken, names.associated),
        percent: await createClassroomWithName(ownerToken, names.percent),
        underscore: await createClassroomWithName(ownerToken, names.underscore),
        backslash: await createClassroomWithName(ownerToken, names.backslash),
      };

      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${ids.associated}/join`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(201);

      const idsFor = async (search?: string) => {
        const response = await availableRequest(parentToken, search).expect(
          200,
        );
        return (response.body as Array<{ id: string }>).map(({ id }) => id);
      };

      expect(new Set(await idsFor('matemática'))).toEqual(
        new Set([ids.math6, ids.math7]),
      );
      expect(new Set(await idsFor('MATEMÁTICA'))).toEqual(
        new Set([ids.math6, ids.math7]),
      );
      expect(new Set(await idsFor('  Matemática  '))).toEqual(
        new Set([ids.math6, ids.math7]),
      );
      expect(await idsFor('matematica')).toEqual([]);
      expect(new Set(await idsFor('6º A'))).toEqual(
        new Set([ids.math6, ids.portuguese]),
      );
      expect(await idsFor('%')).toEqual([ids.percent]);
      expect(await idsFor('_')).toEqual([ids.underscore]);
      expect(await idsFor('\\')).toEqual([ids.backslash]);

      const unfiltered = new Set([
        ids.math6,
        ids.math7,
        ids.portuguese,
        ids.percent,
        ids.underscore,
        ids.backslash,
      ]);
      expect(new Set(await idsFor())).toEqual(unfiltered);
      expect(new Set(await idsFor('   '))).toEqual(unfiltered);

      const myClassroomsResponse = await request(app.getHttpServer())
        .get('/api/v1/classrooms/my')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);
      expect(myClassroomsResponse.body).toEqual([
        expect.objectContaining({ id: ids.associated }),
      ]);
    });

    it('accepts every existing authenticated role without changing list authorization', async () => {
      const ownerToken = await createProfessorToken('search-role-owner');
      const classroomId = await createClassroomWithName(
        ownerToken,
        `${testPrefix} Role Access`,
      );
      const tokens = [
        await createParentToken('search-role-parent'),
        await createProfessorToken('search-role-professor'),
        await createAdminToken('search-role-admin'),
      ];

      for (const token of tokens) {
        const response = await availableRequest(token, 'role access').expect(
          200,
        );
        expect(response.body).toEqual([
          expect.objectContaining({ id: classroomId }),
        ]);
      }
    });

    it('accepts 80 normalized code points and rejects 81 before invoking the list service', async () => {
      const parentToken = await createParentToken('search-length-parent');
      const service = app.get(ClassroomsService);
      const findAvailable = jest.spyOn(service, 'findAvailableClassrooms');

      try {
        await availableRequest(parentToken, `  ${'A'.repeat(80)}  `).expect(
          200,
        );
        findAvailable.mockClear();

        await availableRequest(parentToken, 'A'.repeat(81)).expect(400);
        expect(findAvailable).not.toHaveBeenCalled();
      } finally {
        findAvailable.mockRestore();
      }
    });

    it.each([
      [
        'repeated values',
        'repeat',
        '/api/v1/classrooms?search=mat&search=port',
      ],
      [
        'bracket notation under the simple parser',
        'bracket',
        '/api/v1/classrooms?search%5B%5D=mat',
      ],
      [
        'unknown query fields',
        'extra',
        '/api/v1/classrooms?search=mat&extra=value',
      ],
    ])('rejects %s as a closed query contract', async (_case, label, path) => {
      const parentToken = await createParentToken(`search-${label}`);

      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(400);
    });

    it('keeps missing and invalid sessions at the existing 401 boundary', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/classrooms')
        .query({ search: 'mat' })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/classrooms')
        .query({ search: 'mat' })
        .set('Authorization', 'Bearer invalid-session')
        .expect(401);
    });
  });

  describe('classroom summary list endpoints', () => {
    it('should return active expiration data without changing search or membership behavior', async () => {
      const ownerToken = await createProfessorToken('summary-owner');
      const parentToken = await createParentToken('summary-parent');
      const activeClassroomId = await createClassroom(
        ownerToken,
        'summary-active',
      );
      const emptyClassroomId = await createClassroom(
        ownerToken,
        'summary-empty',
      );

      const announcementResponse = await request(app.getHttpServer())
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Comunicado ativo',
          content: 'Conteúdo do comunicado ativo',
          durationInDays: 7,
          classroomId: activeClassroomId,
        })
        .expect(201);

      const announcement = announcementResponse.body as {
        id: string;
        title: string;
        createdAt: string;
        expiresAt: string;
      };

      const myClassroomsResponse = await request(app.getHttpServer())
        .get('/api/v1/classrooms/my')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const myClassrooms = myClassroomsResponse.body as Array<{
        id: string;
        lastAnnouncement: {
          id: string;
          title: string;
          createdAt: string;
          expiresAt: string;
        } | null;
      }>;
      const activeSummary = myClassrooms.find(
        (classroom) => classroom.id === activeClassroomId,
      );
      const emptySummary = myClassrooms.find(
        (classroom) => classroom.id === emptyClassroomId,
      );

      expect(activeSummary?.lastAnnouncement).toEqual({
        id: announcement.id,
        title: announcement.title,
        createdAt: announcement.createdAt,
        expiresAt: announcement.expiresAt,
      });
      expect(emptySummary?.lastAnnouncement).toBeNull();

      const availableResponse = await request(app.getHttpServer())
        .get('/api/v1/classrooms')
        .query({ search: 'SUMMARY-ACTIVE' })
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      const availableClassrooms = availableResponse.body as Array<{
        id: string;
        lastAnnouncement: {
          id: string;
          expiresAt: string;
        } | null;
      }>;

      expect(availableClassrooms).toHaveLength(1);
      expect(availableClassrooms[0]).toMatchObject({
        id: activeClassroomId,
      });
      expect(availableClassrooms[0]?.lastAnnouncement).toMatchObject({
        id: announcement.id,
        expiresAt: announcement.expiresAt,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${activeClassroomId}/join`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(201);

      const availableAfterJoin = await request(app.getHttpServer())
        .get('/api/v1/classrooms')
        .query({ search: 'SUMMARY-ACTIVE' })
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(availableAfterJoin.body).toEqual([]);
    });
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
