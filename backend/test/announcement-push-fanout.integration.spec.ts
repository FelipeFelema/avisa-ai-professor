import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import { AnnouncementsService } from '../src/announcements/announcements.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
  createAnnouncementPushBinding,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

describe('announcement notification durable audience', () => {
  let prisma: PrismaService;
  let service: AnnouncementPushService;
  let previousFlag: string | undefined;
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AnnouncementPushService(
      prisma,
      new PushRegistrationService(prisma),
    );
  });
  beforeEach(async () => {
    await clearTestDatabase(prisma);
    previousFlag = process.env.ANNOUNCEMENT_PUSH_ENABLED;
    process.env.ANNOUNCEMENT_PUSH_ENABLED = 'true';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previousFlag === undefined)
      delete process.env.ANNOUNCEMENT_PUSH_ENABLED;
    else process.env.ANNOUNCEMENT_PUSH_ENABLED = previousFlag;
  });
  afterAll(async () => {
    if (prisma) {
      await clearTestDatabase(prisma);
      await prisma.$disconnect();
    }
  });

  async function publish() {
    const fixture = await createAnnouncementPushFixture(prisma);
    const announcement = await new AnnouncementsService(prisma).create(
      fixture.author.user.id,
      {
        title: 'Synthetic notice',
        content: 'Private synthetic content',
        classroomId: fixture.classroom.id,
        durationInDays: 2,
      },
    );
    return { fixture, announcement };
  }

  it('includes only eligible same-classroom members and never author/outsider', async () => {
    const { fixture, announcement } = await publish();
    await createAnnouncementPushBinding(prisma, fixture.member);
    await service.materialize(announcement.id);
    const dispatches = await prisma.announcementPushDispatch.findMany();
    expect(dispatches).toHaveLength(3);
    expect(new Set(dispatches.map((d) => d.userId))).toEqual(
      new Set([fixture.owner.user.id, fixture.member.user.id]),
    );
    expect(
      await prisma.announcement.findUnique({ where: { id: announcement.id } }),
    ).toMatchObject({ notificationPending: false });
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushDispatch.count()).toBe(3);
  });

  it('excludes revoked and expired sessions and never fills a completed empty snapshot later', async () => {
    const { fixture, announcement } = await publish();
    await prisma.pushRegistration.update({
      where: { id: fixture.ownerBinding.registration.id },
      data: {
        state: 'REVOKED',
        reason: 'USER_DISABLED',
        expoToken: null,
        tokenFingerprint: null,
        platform: null,
      },
    });
    await prisma.authSession.update({
      where: { id: fixture.member.session.id },
      data: { expiresAt: new Date(0) },
    });
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    await prisma.authSession.update({
      where: { id: fixture.member.session.id },
      data: { expiresAt: new Date(Date.now() + 60000) },
    });
    await prisma.userClassroom.create({
      data: {
        userId: fixture.outsider.user.id,
        classroomId: fixture.classroom.id,
      },
    });
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
  });

  it('keeps publication durable after fanout failure and recovers once after restart', async () => {
    const { announcement } = await publish();
    const locks = new PushRegistrationService(prisma);
    jest
      .spyOn(locks, 'withAnnouncementLocks')
      .mockRejectedValueOnce(new Error('synthetic fanout failure'));
    await expect(
      new AnnouncementPushService(prisma, locks).materialize(announcement.id),
    ).rejects.toThrow();
    expect(
      await prisma.announcement.findUnique({ where: { id: announcement.id } }),
    ).toMatchObject({ notificationPending: true });
    await service.materialize(announcement.id);
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
  });

  it('suppresses expired pending publications without changing the saved resource', async () => {
    const { announcement } = await publish();
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { expiresAt: new Date(0) },
    });
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    expect(
      await prisma.announcement.findUnique({ where: { id: announcement.id } }),
    ).toMatchObject({ notificationPending: false });
  });
});
