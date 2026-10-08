import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertReleaseTestDatabase,
  createReleaseSecurityFixture,
  cleanupReleaseSecurityFixture,
} from './helpers/release-security.fixture';

describe('Release authorization: server-side victim isolation', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let f: Awaited<ReturnType<typeof createReleaseSecurityFixture>>;
  beforeAll(async () => {
    assertReleaseTestDatabase();
    // Authorization tests isolate the authorization boundary, not the rate budget.
    app = (await createTestApp({
      configureBuilder: (b) =>
        b.overrideGuard(RateLimitGuard).useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    f = await createReleaseSecurityFixture(prisma, app.get(AuthService));
  });
  afterEach(async () => cleanupReleaseSecurityFixture(prisma, f));
  afterAll(async () => app.close());

  async function snapshot() {
    const ids = f.accounts.map((a) => a.id);
    return {
      users: await prisma.user.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
      }),
      classrooms: await prisma.classroom.findMany({
        where: { ownerId: { in: ids } },
        orderBy: { id: 'asc' },
      }),
      memberships: await prisma.userClassroom.findMany({
        where: { userId: { in: ids } },
        orderBy: [{ userId: 'asc' }, { classroomId: 'asc' }],
      }),
      announcements: await prisma.announcement.findMany({
        where: { authorId: { in: ids } },
        orderBy: { id: 'asc' },
      }),
    };
  }

  it.each(['parentA', 'professorA', 'admin'] as const)(
    'never selects another user through profile/password/deletion payloads (%s)',
    async (tag) => {
      const a = f[tag],
        victim = f.parentB;
      const before = await snapshot();
      const profile = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .query({ userId: victim.id, id: victim.id })
        .auth(a.access_token, { type: 'bearer' })
        .expect(200);
      expect((profile.body as { id: string }).id).toBe(a.id);
      for (const [path, body] of [
        [
          '/api/v1/users/profile',
          { name: 'Victim altered', id: victim.id, role: Role.ADMIN },
        ],
        [
          '/api/v1/auth/change-password',
          {
            currentPassword: f.password,
            newPassword: 'Another synthetic password',
            confirmNewPassword: 'Another synthetic password',
            userId: victim.id,
          },
        ],
        [
          '/api/v1/users/account',
          {
            currentPassword: f.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
            userId: victim.id,
          },
        ],
      ] as const) {
        const req = request(app.getHttpServer());
        await (
          path.endsWith('/profile')
            ? req.patch(path)
            : path.endsWith('/account')
              ? req.delete(path)
              : req.post(path)
        )
          .auth(a.access_token, { type: 'bearer' })
          .send(body)
          .expect(400);
      }
      await request(app.getHttpServer())
        .delete('/api/v1/users/account')
        .query({ id: victim.id })
        .auth(a.access_token, { type: 'bearer' })
        .send({
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        })
        .expect(400);
      expect(await snapshot()).toEqual(before);
    },
  );

  it('rejects manual victim classroom IDs and role bypass with no graph mutation', async () => {
    const before = await snapshot();
    for (const a of [f.parentA, f.admin])
      await request(app.getHttpServer())
        .post('/api/v1/classrooms')
        .auth(a.access_token, { type: 'bearer' })
        .send({ name: 'Unauthorized classroom' })
        .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/classrooms/${f.classrooms[1].id}`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${f.classrooms[1].id}/leave`)
      .auth(f.parentA.access_token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${f.classrooms[0].id}/leave`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .expect(409);
    for (const id of [f.absentId, f.invalidId])
      await request(app.getHttpServer())
        .post(`/api/v1/classrooms/${id}/join`)
        .auth(f.parentA.access_token, { type: 'bearer' })
        .expect(404);
    expect(await snapshot()).toEqual(before);
  });

  it('denies foreign classroom content/author mutation including manual and nonexistent IDs', async () => {
    const victim = f.classrooms[1].announcements[0];
    const before = await snapshot();
    for (const a of [f.parentA, f.professorA, f.admin]) {
      const all = await request(app.getHttpServer())
        .get('/api/v1/announcements')
        .auth(a.access_token, { type: 'bearer' })
        .expect(200);
      expect(JSON.stringify(all.body)).not.toContain(victim.id);
      const list = await request(app.getHttpServer())
        .get(`/api/v1/announcements/classrooms/${f.classrooms[1].id}`)
        .auth(a.access_token, { type: 'bearer' })
        .expect(200);
      expect(list.body).toEqual([]);
      for (const id of [victim.id, f.absentId, f.invalidId])
        await request(app.getHttpServer())
          .get(`/api/v1/announcements/${id}`)
          .auth(a.access_token, { type: 'bearer' })
          .expect(404);
      for (const method of ['patch', 'delete'] as const)
        await request(app.getHttpServer())
          [method](`/api/v1/announcements/${victim.id}`)
          .auth(a.access_token, { type: 'bearer' })
          .send(
            method === 'patch'
              ? {
                  title: 'Unauthorized edit',
                  content: 'Victim changed',
                  durationInDays: 1,
                }
              : {},
          )
          .expect(a.role === Role.PROFESSOR ? 404 : 403);
    }
    await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .auth(f.professorA.access_token, { type: 'bearer' })
      .send({
        classroomId: f.classrooms[1].id,
        title: 'Attack',
        content: 'Attack',
        durationInDays: 1,
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .auth(f.professorA.access_token, { type: 'bearer' })
      .send({
        classroomId: f.classrooms[0].id,
        title: 'Attack',
        content: 'Attack',
        durationInDays: 1,
        authorId: f.professorB.id,
      })
      .expect(400);
    expect(await snapshot()).toEqual(before);
  });

  it('membership permits reading but never transfers authorship', async () => {
    const victim = f.classrooms[1].announcements[0];
    await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${f.classrooms[1].id}/join`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .expect(201);
    const before = await snapshot();
    await request(app.getHttpServer())
      .get(`/api/v1/announcements/${victim.id}`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${victim.id}`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .send({ title: 'Attack', content: 'Attack', durationInDays: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/announcements/${victim.id}`)
      .auth(f.professorA.access_token, { type: 'bearer' })
      .expect(404);
    expect(await snapshot()).toEqual(before);
  });

  it('demotion and session revocation deny ADMIN issuance and public ADMIN registration', async () => {
    const before = await prisma.inviteCode.count();
    await prisma.user.update({
      where: { id: f.admin.id },
      data: { role: Role.PARENT },
    });
    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(f.admin.access_token, { type: 'bearer' })
      .send({})
      .expect(403);
    await prisma.user.update({
      where: { id: f.admin.id },
      data: { role: Role.ADMIN },
    });
    await prisma.authSession.update({
      where: { id: f.admin.sid },
      data: { revokedAt: new Date() },
    });
    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(f.admin.access_token, { type: 'bearer' })
      .send({})
      .expect(401);
    const email = `${f.prefix}-attack@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Public admin',
        email,
        password: f.password,
        role: Role.ADMIN,
      })
      .expect(400);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.inviteCode.count()).toBe(before);
  });
});
