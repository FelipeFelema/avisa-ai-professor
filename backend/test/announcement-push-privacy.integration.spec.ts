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
    'transports only permitted contextual %s copy and closed intent; logs/ledger exclude content and secrets',
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
          title: 'PERMITTED-ANNOUNCEMENT-TITLE',
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
        // Metadata must come from final authorization, not the earlier claim/event.
        await prisma.classroom.update({
          where: { id: f.classroom.id },
          data: { name: 'Current turma' },
        });
        await prisma.announcement.update({
          where: { id: a.id },
          data: { title: 'Current title' },
        });
        const snapshot = (await service.authorize(row))!;
        const result = await new ExpoPushAdapter().sendAnnouncement(
          snapshot.expoToken,
          {
            announcementId: a.id,
            dispatchId: row.id,
            ttl: snapshot.ttl,
            type: snapshot.type,
            classroomName: snapshot.classroomName,
            announcementTitle: snapshot.announcementTitle,
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
        expect(payload.title).toBe(
          type === 'announcement-created'
            ? 'Novo comunicado • Current turma'
            : 'Comunicado próximo da expiração • Current turma',
        );
        expect(payload.body).toBe(
          type === 'announcement-created'
            ? 'Current title'
            : 'Current title expira em breve.',
        );
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
        const contextualCopy = JSON.stringify({
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        for (const forbidden of [
          'PERMITTED-ANNOUNCEMENT-TITLE',
          'PRIVATE-SCHOOL-BODY',
          f.classroom.name,
          f.author.user.name,
          f.member.user.id,
        ])
          expect(contextualCopy).not.toContain(forbidden);
        const capturedLogs = JSON.stringify(logs.map((log) => log.mock.calls));
        for (const forbidden of [
          'Current turma',
          'Current title',
          'PRIVATE-SCHOOL-BODY',
        ])
          expect(capturedLogs).not.toContain(forbidden);
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
