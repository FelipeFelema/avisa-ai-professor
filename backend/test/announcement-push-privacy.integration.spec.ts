import { ExpoPushAdapter } from '../src/push/expo-push.adapter';
import { AnnouncementsService } from '../src/announcements/announcements.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

describe('business payload and response privacy sentinels', () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });
  it.each(['announcement-created', 'announcement-expiring'] as const)(
    'transports only generic %s copy and closed intent; ledger never duplicates the raw token',
    async (type) => {
      await clearTestDatabase(prisma);
      const previous = { ...process.env };
      Object.assign(process.env, {
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-private-backend-token',
        ANNOUNCEMENT_PUSH_ENABLED: 'true',
        ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
      });
      const logs = [
        jest.spyOn(console, 'log').mockImplementation(() => {}),
        jest.spyOn(console, 'warn').mockImplementation(() => {}),
        jest.spyOn(console, 'error').mockImplementation(() => {}),
      ];
      const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ status: 'ok', id: 'synthetic-private-ticket' }],
          }),
          { status: 200 },
        ),
      );
      try {
        const f = await createAnnouncementPushFixture(prisma);
        const api = new AnnouncementsService(prisma);
        const a = await api.create(f.author.user.id, {
          classroomId: f.classroom.id,
          title: 'PRIVATE-SCHOOL-TITLE',
          content: 'PRIVATE-SCHOOL-BODY',
          durationInDays: 2,
        });
        const service = new AnnouncementPushService(
          prisma,
          new PushRegistrationService(prisma),
        );
        if (type === 'announcement-expiring') {
          const now = new Date();
          await prisma.announcement.update({
            where: { id: a.id },
            data: {
              createdAt: new Date(now.getTime() - 2 * 86400_000),
              expiresAt: new Date(now.getTime() + 86400_000),
            },
          });
          await service.materializeReminder(a.id, now);
        } else await service.materialize(a.id);
        const row = (await service.claim())[0];
        const snapshot = (await service.authorize(row))!;
        const result = await new ExpoPushAdapter().sendAnnouncement(
          snapshot.expoToken,
          {
            announcementId: a.id,
            dispatchId: row.id,
            ttl: snapshot.ttl,
            type: snapshot.type,
          },
        );
        await service.completeSend(snapshot, result);
        const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string) as {
          to: string;
          title: string;
          body: string;
          data: Record<string, unknown>;
        };
        expect(payload.to).toBe(snapshot.expoToken);
        expect(payload.data.type).toBe(type);
        expect(Object.keys(payload.data).sort()).toEqual([
          'announcementId',
          'dispatchId',
          'type',
          'version',
        ]);
        const publicContent = JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: payload.data,
          logs: logs.map((log) => log.mock.calls),
          response: a,
        });
        for (const secret of [
          snapshot.expoToken,
          'synthetic-private-backend-token',
          row.tokenFingerprint,
          row.sessionId,
          row.installationId,
          'synthetic-private-ticket',
        ])
          expect(publicContent).not.toContain(secret);
        const neutralCopy = JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        for (const forbidden of [
          'PRIVATE-SCHOOL-TITLE',
          'PRIVATE-SCHOOL-BODY',
          f.classroom.name,
          f.author.user.name,
          f.member.user.id,
        ])
          expect(neutralCopy).not.toContain(forbidden);
        const ledger = await prisma.announcementPushDispatch.findUnique({
          where: { id: row.id },
        });
        expect(JSON.stringify(ledger)).not.toContain(snapshot.expoToken);
        expect(a).not.toHaveProperty('notificationPending');
      } finally {
        jest.restoreAllMocks();
        process.env = previous;
      }
    },
  );
});
