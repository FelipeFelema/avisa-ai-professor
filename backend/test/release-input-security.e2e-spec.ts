import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertReleaseTestDatabase,
  createReleaseSecurityFixture,
  cleanupReleaseSecurityFixture,
} from './helpers/release-security.fixture';

describe('Release input and abuse boundary', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let f: Awaited<ReturnType<typeof createReleaseSecurityFixture>>;
  beforeAll(async () => {
    assertReleaseTestDatabase();
    app = (await createTestApp()) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    f = await createReleaseSecurityFixture(prisma, app.get(AuthService));
  });
  afterEach(async () => cleanupReleaseSecurityFixture(prisma, f));
  afterAll(async () => app.close());

  it.each([
    [
      'post',
      '/auth/register',
      {
        name: 'Synthetic User',
        email: 'synthetic@example.com',
        password: '12345678',
        role: 'ADMIN',
      },
    ],
    [
      'post',
      '/auth/login',
      { email: 'synthetic@example.com', password: '12345678', id: 'victim' },
    ],
    [
      'post',
      '/auth/change-password',
      {
        currentPassword: { nested: 'bad' },
        newPassword: 'another123',
        confirmNewPassword: 'another123',
      },
    ],
    ['post', '/classrooms', { name: 'x'.repeat(81) }],
    [
      'post',
      '/announcements',
      {
        title: 'x'.repeat(121),
        content: 'Content',
        classroomId: 'not-uuid',
        durationInDays: 999,
      },
    ],
    ['post', '/invite-codes', { role: 'ADMIN' }],
    [
      'post',
      '/push/installation/reserve',
      { installationId: 'not-uuid', userId: 'victim' },
    ],
  ] as const)(
    'rejects extra/malformed/oversized fields at %s %s',
    async (method, path, body) => {
      const beforeUsers = await prisma.user.count();
      const beforeAnnouncements = await prisma.announcement.count();
      const token =
        path === '/invite-codes'
          ? f.admin.access_token
          : f.professorA.access_token;
      await request(app.getHttpServer())
        [method]('/api/v1' + path)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
      expect(await prisma.user.count()).toBe(beforeUsers);
      expect(await prisma.announcement.count()).toBe(beforeAnnouncements);
    },
  );

  it('rejects repeated/extra query fields and prevents object search coercion', async () => {
    for (const query of [
      'search=a&search=b',
      'search[private]=a',
      'search=' + 'x'.repeat(81),
      'ownerId=' + f.professorB.id,
    ]) {
      await request(app.getHttpServer())
        .get('/api/v1/classrooms?' + query)
        .auth(f.parentA.access_token, { type: 'bearer' })
        .expect(400);
    }
  });

  it('enforces 100KB general and 2KB push parser budgets', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ password: 'x'.repeat(110000) })
      .expect(413);
    await request(app.getHttpServer())
      .post('/api/v1/push/installation/reserve')
      .send({ padding: 'x'.repeat(2200) })
      .expect(413);
  });

  it('limits invalid logout capabilities using the real guard without revoking any session', async () => {
    for (let i = 0; i < 11; i++) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({ sid: f.parentA.sid, capability: 'A'.repeat(43) });
      expect([401, 429]).toContain(response.status);
      if (i === 10) expect(response.status).toBe(429);
    }
    expect(
      (
        await prisma.authSession.findUniqueOrThrow({
          where: { id: f.parentA.sid },
        })
      ).revokedAt,
    ).toBeNull();
  });

  it('cannot evade the real IP budget by spoofing X-Forwarded-For without trusted proxy', async () => {
    // Real configureApp leaves Express trust proxy disabled.
    for (let i = 0; i < 11; i++) {
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({
          email: 'absent@example.com',
          password: 'Synthetic wrong password',
        });
      expect([401, 429]).toContain(r.status);
      if (i === 10) expect(r.status).toBe(429);
    }
  });
});
