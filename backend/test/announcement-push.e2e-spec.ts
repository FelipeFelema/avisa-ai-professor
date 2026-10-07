import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import { AnnouncementPushWorker } from '../src/push/announcement-push.worker';
import { AnnouncementRemindersWorker } from '../src/push/announcement-reminders.worker';
import { ExpoPushAdapter } from '../src/push/expo-push.adapter';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

describe('announcement HTTP publication, reminders and authorized detail', () => {
  let app: INestApplication<App>, prisma: PrismaService;
  let previous: NodeJS.ProcessEnv;
  const send = jest
    .fn<
      ReturnType<ExpoPushAdapter['sendAnnouncement']>,
      Parameters<ExpoPushAdapter['sendAnnouncement']>
    >()
    .mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic-ticket' });
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    previous = { ...process.env };
    Object.assign(process.env, {
      EXPO_PUSH_ENABLED: 'true',
      EXPO_PUSH_ACCESS_TOKEN: 'synthetic-only-access-token',
      ANNOUNCEMENT_PUSH_ENABLED: 'true',
      ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'false',
    });
    app = (await createTestApp({
      configureBuilder: (builder) => {
        builder.overrideProvider(ExpoPushAdapter).useValue({
          sendAnnouncement: send,
          getReceipts: jest.fn().mockResolvedValue({}),
        });
        builder.overrideProvider(AnnouncementPushWorker).useValue({});
        builder.overrideProvider(AnnouncementRemindersWorker).useValue({});
      },
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    send
      .mockReset()
      .mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic-ticket' });
    process.env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED = 'false';
    await clearTestDatabase(prisma);
  });
  afterAll(async () => {
    if (prisma) await clearTestDatabase(prisma);
    if (app) await app.close();
    process.env = previous;
  });
  function jwt(actor: {
    user: { id: string; email: string; role: string };
    session: { id: string };
  }) {
    return app.get(JwtService).sign(
      {
        sub: actor.user.id,
        sid: actor.session.id,
        email: actor.user.email,
        role: actor.user.role,
      },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }
  async function publish() {
    const f = await createAnnouncementPushFixture(prisma);
    const response = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .auth(jwt(f.author), { type: 'bearer' })
      .send({
        title: 'Private school title',
        content: 'Private school body',
        classroomId: f.classroom.id,
        durationInDays: 7,
      })
      .expect(201);
    const { id } = response.body as { id: string };
    expect(response.body).not.toHaveProperty('notificationPending');
    expect(send).not.toHaveBeenCalled();
    return { f, id };
  }
  it('publication -> correct installations -> one submission each -> normal authorized detail', async () => {
    const { f, id } = await publish();
    const worker = new AnnouncementPushWorker(
      prisma,
      app.get(AnnouncementPushService),
      app.get(ExpoPushAdapter),
    );
    await worker.tick();
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(2);
    const tokens = new Set(send.mock.calls.map((call) => call[0]));
    expect(tokens).toEqual(
      new Set([
        f.ownerBinding.registration.expoToken,
        f.memberBinding.registration.expoToken,
      ]),
    );
    expect(tokens.has(f.authorBinding.registration.expoToken!)).toBe(false);
    expect(tokens.has(f.outsiderBinding.registration.expoToken!)).toBe(false);
    await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${id}`)
      .auth(jwt(f.author), { type: 'bearer' })
      .send({
        title: 'Updated synthetic notice',
        content: 'Updated synthetic content',
        durationInDays: 7,
      })
      .expect(200);
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    expect(
      await prisma.announcement.findUnique({ where: { id } }),
    ).toMatchObject({ notificationPending: false });
    await request(app.getHttpServer())
      .get(`/api/v1/announcements/${id}`)
      .auth(jwt(f.member), { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/announcements/${id}`)
      .auth(jwt(f.outsider), { type: 'bearer' })
      .expect(404);
    await prisma.userClassroom.delete({
      where: {
        userId_classroomId: {
          userId: f.member.user.id,
          classroomId: f.classroom.id,
        },
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/announcements/${id}`)
      .auth(jwt(f.member), { type: 'bearer' })
      .expect(404);
    await worker.onModuleDestroy();
  });
  it.each(['expired', 'deleted'])(
    'a payload id never bypasses %s resource authorization',
    async (kind) => {
      const { f, id } = await publish();
      if (kind === 'deleted')
        await prisma.announcement.delete({ where: { id } });
      else
        await prisma.announcement.update({
          where: { id },
          data: { expiresAt: new Date(0) },
        });
      await request(app.getHttpServer())
        .get(`/api/v1/announcements/${id}`)
        .auth(jwt(f.member), { type: 'bearer' })
        .expect(404);
    },
  );
  it.each([
    { notificationPending: true },
    { recipientIds: ['synthetic-recipient'] },
  ])('rejects client-controlled internal fanout fields', async (extra) => {
    const f = await createAnnouncementPushFixture(prisma);
    await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .auth(jwt(f.author), { type: 'bearer' })
      .send({
        title: 'Synthetic',
        content: 'Synthetic',
        classroomId: f.classroom.id,
        durationInDays: 7,
        ...extra,
      })
      .expect(400);
    expect(await prisma.announcement.count()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
  it('provider failure cannot undo publication or duplicate an uncertain submission', async () => {
    const { id } = await publish();
    send.mockRejectedValue(new Error('synthetic timeout'));
    const worker = new AnnouncementPushWorker(
      prisma,
      app.get(AnnouncementPushService),
      app.get(ExpoPushAdapter),
    );
    await worker.tick();
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      await prisma.announcement.findUnique({ where: { id } }),
    ).not.toBeNull();
    expect(
      await prisma.announcementPushDispatch.count({
        where: { state: 'UNKNOWN' },
      }),
    ).toBe(2);
    await worker.onModuleDestroy();
    send.mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic-ticket' });
  });
  it('accepted HTTP followed by persistence failure remains unreplayable after restart', async () => {
    await publish();
    const service = app.get(AnnouncementPushService);
    const fail = jest
      .spyOn(service, 'completeSend')
      .mockRejectedValueOnce(new Error('synthetic persistence failure'));
    const worker = new AnnouncementPushWorker(
      prisma,
      service,
      app.get(ExpoPushAdapter),
    );
    try {
      await expect(worker.tick()).rejects.toThrow(
        'ANNOUNCEMENT_PUSH_DISPATCH_FAILED',
      );
      await worker.onModuleDestroy();
      await service.expire(new Date(Date.now() + 15001));
      const restarted = new AnnouncementPushWorker(
        prisma,
        service,
        app.get(ExpoPushAdapter),
      );
      await restarted.tick();
      await restarted.onModuleDestroy();
      expect(send).toHaveBeenCalledTimes(2);
      expect(
        await prisma.announcementPushDispatch.count({
          where: { state: 'UNKNOWN' },
        }),
      ).toBe(1);
    } finally {
      fail.mockRestore();
      await worker.onModuleDestroy();
    }
  });
  it('reminder reuses mocked transport and ordinary GET authorization with no second submission', async () => {
    const { f, id } = await publish();
    const service = app.get(AnnouncementPushService);
    const worker = new AnnouncementPushWorker(
      prisma,
      service,
      app.get(ExpoPushAdapter),
    );
    await worker.tick();
    send.mockClear();
    process.env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED = 'true';
    const now = new Date();
    // Synthetic clock setup only on the guarded test DB, not a runtime edit endpoint.
    await prisma.announcement.update({
      where: { id },
      data: {
        createdAt: new Date(now.getTime() - 2 * 86400_000),
        expiresAt: new Date(now.getTime() + 86400_000),
      },
    });
    const selector = new AnnouncementRemindersWorker(prisma, service);
    await selector.tick(now);
    await worker.tick();
    await selector.tick(now);
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      send.mock.calls.every(
        (call) =>
          call[1].type === 'announcement-expiring' &&
          call[1].announcementId === id,
      ),
    ).toBe(true);
    expect(new Set(send.mock.calls.map((call) => call[0]))).toEqual(
      new Set([
        f.ownerBinding.registration.expoToken,
        f.memberBinding.registration.expoToken,
      ]),
    );
    await request(app.getHttpServer())
      .get('/api/v1/announcements/' + id)
      .auth(jwt(f.member), { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/announcements/' + id)
      .auth(jwt(f.outsider), { type: 'bearer' })
      .expect(404);
    await prisma.userClassroom.delete({
      where: {
        userId_classroomId: {
          userId: f.member.user.id,
          classroomId: f.classroom.id,
        },
      },
    });
    await request(app.getHttpServer())
      .get('/api/v1/announcements/' + id)
      .auth(jwt(f.member), { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/announcements/' + id)
      .expect(401);
    await Promise.all([worker.onModuleDestroy(), selector.onModuleDestroy()]);
  });
});
