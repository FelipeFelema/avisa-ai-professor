import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { AnnouncementsService } from '../src/announcements/announcements.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertReleaseTestDatabase,
  createReleaseSecurityFixture,
  cleanupReleaseSecurityFixture,
} from './helpers/release-security.fixture';

describe('Release error privacy', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let f: Awaited<ReturnType<typeof createReleaseSecurityFixture>>;
  const marker = 'SYNTHETIC_PRIVATE_INPUT';
  beforeAll(async () => {
    assertReleaseTestDatabase();
    app = (await createTestApp()) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    f = await createReleaseSecurityFixture(prisma, app.get(AuthService));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupReleaseSecurityFixture(prisma, f);
  });
  afterAll(async () => app.close());

  it.each([
    '/auth/login',
    '/auth/register',
    '/classrooms',
    '/announcements',
    '/push/installation/reserve',
  ])(
    'never reflects malformed JSON or parser internals at %s',
    async (path) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1' + path)
        .set('Content-Type', 'application/json')
        .send(`{"password":"${marker}",`)
        .expect(400);
      expect(JSON.stringify(response.body)).not.toMatch(
        /SYNTHETIC_PRIVATE_INPUT|SyntaxError|position|JSON at|stack|Prisma|SELECT/,
      );
    },
  );

  it('sanitizes unexpected persistence failures in both HTTP and logs', async () => {
    const fault = new Error(`Prisma SELECT password=${marker}`);
    jest
      .spyOn(app.get(AnnouncementsService), 'findAll')
      .mockRejectedValueOnce(fault);
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const response = await request(app.getHttpServer())
      .get('/api/v1/announcements')
      .auth(f.parentA.access_token, { type: 'bearer' })
      .expect(500);
    expect(JSON.stringify(response.body)).not.toMatch(
      /SYNTHETIC_PRIVATE_INPUT|Prisma|SELECT|stack/,
    );
    const rendered = log.mock.calls
      .map((args) =>
        args
          .map((a) => (a instanceof Error ? a.message : JSON.stringify(a)))
          .join(' '),
      )
      .join(' ');
    expect(rendered).not.toContain(marker);
    expect(rendered).not.toContain('Prisma');
  });
});
